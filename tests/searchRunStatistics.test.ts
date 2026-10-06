import assert from 'node:assert/strict';
import test from 'node:test';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { load } from 'js-yaml';
import app, { encryptSecret } from '../server/app.ts';
import { adminAuth } from '../server/firebaseAdmin.ts';
import { FirestoreService } from '../server/firestoreService.ts';
import { fakePublicStore } from './helpers/publicApiFirestore.ts';

const clientFetch = globalThis.fetch;
let nextUid = 0;

// Emulate Firestore's REST document hierarchy, retaining the actual wire fields.
// Reads and writes run through the real service, not mocked service methods.
async function setup(t: test.TestContext) {
  const uid = `snapshot-test-${++nextUid}`;
  const records = new Map<string, any>();
  const calls: URL[] = [];
  let viewCount = '9007199254740993';
  const oldKey = process.env.USER_API_KEY_ENCRYPTION_KEY;
  process.env.USER_API_KEY_ENCRYPTION_KEY = 'snapshot-test-encryption';
  const encrypted = encryptSecret('snapshot-test-api-key');
  t.after(() => {
    if (oldKey === undefined) delete process.env.USER_API_KEY_ENCRYPTION_KEY;
    else process.env.USER_API_KEY_ENCRYPTION_KEY = oldKey;
  });
  t.mock.method(adminAuth, 'verifyIdToken', async () => ({ uid }));
  t.mock.method(console, 'log', () => {});
  t.mock.method(globalThis, 'fetch', async (input: string | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    calls.push(url);
    if (url.pathname.endsWith('/integrations/youtube')) return Response.json({ fields: {
      encryptedApiKey: { stringValue: encrypted.encryptedApiKey },
      iv: { stringValue: encrypted.iv }, authTag: { stringValue: encrypted.authTag },
    } });
    if (url.hostname === 'www.googleapis.com') {
      assert.equal(url.searchParams.get('key'), 'snapshot-test-api-key');
      if (url.pathname.endsWith('/search')) return Response.json({ items: [
        { id: { videoId: 'video' }, snippet: { title: 'Historical video' } },
      ] });
      assert.equal(url.pathname, '/youtube/v3/videos');
      return Response.json({ items: [{ id: 'video', statistics: { viewCount, likeCount: '0' } }] });
    }
    assert.equal(url.hostname, 'firestore.googleapis.com');
    const path = decodeURIComponent(url.pathname.split('/documents/')[1]);
    if (init.method === 'PATCH') {
      const { fields } = JSON.parse(String(init.body));
      records.set(path, { ...records.get(path), ...fields });
      return Response.json({});
    }
    if (records.has(path)) return Response.json({ name: path, fields: records.get(path) });
    const documents = [...records.entries()].filter(([key]) => key.startsWith(`${path}/`) && !key.slice(path.length + 1).includes('/'))
      .map(([name, fields]) => ({ name, fields }));
    return Response.json({ documents });
  });
  const server = await new Promise<Server>((resolve, reject) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    listener.once('error', reject);
  });
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  async function search(stream = false) {
    const response = await clientFetch(`${baseUrl}/api/youtube/search${stream ? '?stream=true' : ''}`, {
      method: 'POST', headers: { Authorization: `Bearer ${uid}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ yaml: 'version: 1\nqueries:\n  - id: first\n    q: test\n  - id: second\n    q: overlap\n' }),
    });
    assert.equal(response.status, 200);
    if (!stream) return { result: await response.json(), events: [] };
    const events = (await response.text()).split('\n\n').filter((event) => event.startsWith('data: '))
      .map((event) => JSON.parse(event.slice(6)));
    return { result: events.find((event) => event.type === 'complete'), events };
  }
  return { uid, records, calls, search, setViewCount: (value: string) => { viewCount = value; } };
}

for (const stream of [false, true]) {
  test(`new Search Run saves immutable statistics through ${stream ? 'SSE' : 'JSON'} and cold history reads`, async (t) => {
    const { uid, records, calls, search, setViewCount } = await setup(t);
    const { result, events } = await search(stream);
    const snapshot = result.data.results[0].videos[0].statistics;
    assert.equal(snapshot.viewCount, '9007199254740993');
    assert.equal(snapshot.likeCount, '0');
    assert.equal(snapshot.commentCount, null);
    assert.ok(Number.isFinite(Date.parse(snapshot.fetchedAt)));
    assert.deepEqual(result.data.results[1].videos[0].statistics, snapshot);
    assert.deepEqual((load(result.outputYaml) as any).results[0].videos[0].statistics, snapshot);
    for (const event of events.filter((event) => event.type === 'query_success')) {
      assert.deepEqual(event.result.videos[0].statistics, snapshot);
    }
    assert.equal(calls.filter((url) => url.pathname === '/youtube/v3/videos').length, 1);
    const root = `users/${uid}/searchRuns/${result.runId}`;
    const oldRecords = structuredClone([...records.entries()]);
    for (const query of ['first', 'second']) {
      assert.deepEqual(records.get(`${root}/queryResults/${query}/videos/video`).statistics, { mapValue: { fields: {
        viewCount: { stringValue: snapshot.viewCount }, likeCount: { stringValue: '0' },
        commentCount: { nullValue: null }, fetchedAt: { stringValue: snapshot.fetchedAt },
      } } });
    }
    // Copy durable wire records to a new run ID, avoiding the process-local cache.
    const coldId = 'cold-history';
    for (const [path, fields] of oldRecords) records.set(path.replace(result.runId, coldId), fields);
    const service = new FirestoreService('test', '(default)');
    const beforeRead = calls.length;
    const cold = await service.getSearchRunDetails('token', uid, coldId);
    assert.deepEqual(cold!.queryResults[0].videos![0].statistics, snapshot);
    assert.deepEqual((load(cold!.outputYaml) as any).results[0].videos[0].statistics, snapshot);
    assert.ok(calls.slice(beforeRead).every((url) => url.hostname === 'firestore.googleapis.com'));
    // Decode the actual durable fields independently for the Admin SDK reader.
    const decode = (fields: any): any => Object.fromEntries(Object.entries(fields).map(([key, value]: [string, any]) => [key,
      'mapValue' in value ? decode(value.mapValue.fields) : 'nullValue' in value ? null : value.stringValue ?? Number(value.integerValue),
    ]));
    const admin = fakePublicStore(uid);
    for (const [path, fields] of oldRecords) admin.records.set(path, decode(fields));
    admin.records.get(root)!.visibility = 'public';
    const publicDetail = await admin.service.getPublicSearchRunDetails(uid, result.runId);
    const adminDetail = await admin.service.loadSearchRunDetailsFromFirestore(uid, result.runId);
    assert.deepEqual(adminDetail!.queryResults[0].videos![0].statistics, snapshot);
    assert.deepEqual((load(adminDetail!.outputYaml) as any).results[0].videos[0].statistics, snapshot);
    assert.deepEqual(publicDetail!.queryResults[0].videos[0].statistics, snapshot);
    setViewCount('9999999999999999');
    const newer = await search(stream);
    assert.notEqual(newer.result.runId, result.runId);
    assert.equal(newer.result.data.results[0].videos[0].statistics.viewCount, '9999999999999999');
    for (const [path, fields] of oldRecords) assert.deepEqual(records.get(path), fields, 'later execution does not rewrite old documents');
    assert.deepEqual((await service.getSearchRunDetails('token', uid, coldId))!.queryResults[0].videos![0].statistics, snapshot);
  });
}

test('legacy owner history, Admin history and YAML load without snapshots or YouTube requests', async (t) => {
  const { uid, records, calls, search } = await setup(t);
  const { result } = await search();
  for (const [path, fields] of [...records.entries()]) {
    const copy = structuredClone(fields);
    delete copy.statistics;
    records.set(path.replace(result.runId, 'legacy'), copy);
  }
  const beforeRead = calls.length;
  const detail = await new FirestoreService('test', '(default)').getSearchRunDetails('token', uid, 'legacy');
  assert.ok(detail);
  for (const query of detail.queryResults) assert.equal('statistics' in query.videos![0], false);
  assert.equal('statistics' in (load(detail.outputYaml) as any).results[0].videos[0], false);
  assert.ok(calls.slice(beforeRead).every((url) => url.hostname === 'firestore.googleapis.com'));
  const admin = fakePublicStore(`${uid}-admin`);
  // Use the fixture's actual run ID rather than assuming an identifier format.
  const runPath = [...admin.records.keys()].find((path) => path.includes('/searchRuns/') && path.split('/').length === 4)!;
  const loaded = await admin.service.loadSearchRunDetailsFromFirestore(`${uid}-admin`, runPath.split('/').at(-1)!);
  assert.ok(loaded);
  assert.equal('statistics' in loaded.queryResults[0].videos![0], false);
  assert.equal('statistics' in (load(loaded.outputYaml) as any).results[0].videos[0], false);
});
