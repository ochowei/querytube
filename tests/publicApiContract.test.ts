import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { toPublicSearchRun } from '../server/publicApiMapper.ts';
import { createPublicApiRouter, PUBLIC_API_BASE_PATH } from '../server/publicApi.ts';
import { runFixture } from './helpers/publicApiFixture.ts';
import { checkSchema, contract, responseSchema, validate } from './helpers/publicApiSchema.ts';
import { fakePublicStore } from './helpers/publicApiFirestore.ts';

const userPath = '/api/public/users/{userId}';
const listPath = `${userPath}/search-runs`;
const detailPath = `${listPath}/{runId}`;
const conveniencePath = `${userPath}/query-sets/{querySetId}/search-runs`;
let nextClient = 0;

async function setupHttp(t: test.TestContext) {
  const client = ++nextClient;
  const uid = `public-contract-${client}`;
  const store = fakePublicStore(uid);
  const app = express();
  // Give each fixture a distinct limiter client; production limiter itself is unchanged.
  app.set('trust proxy', 'loopback');
  app.use(PUBLIC_API_BASE_PATH, createPublicApiRouter(store.service));
  const server = await new Promise<Server>((resolve, reject) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    listener.once('error', reject);
  });
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  t.mock.method(console, 'warn', () => {});
  async function request(schemaPath: string, options: { id?: string; querySetId?: string; query?: string; status?: number } = {}) {
    const path = schemaPath.replace('{userId}', uid).replace('{runId}', options.id ?? runFixture.id)
      .replace('{querySetId}', options.querySetId ?? 'deleted-set');
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}${path}${options.query ?? ''}`, {
      headers: { 'X-Forwarded-For': `192.0.2.${client}` }, // No bearer token.
    });
    assert.equal(response.status, options.status ?? 200, `GET ${path}`);
    assert.match(response.headers.get('content-type') ?? '', /application\/json/);
    const body = await response.json();
    validate(responseSchema(schemaPath, response.status), body);
    return body;
  }
  return { ...store, request };
}

test('v1 preserves established paths, operation IDs, and consumer field guarantees', () => {
  assert.equal(PUBLIC_API_BASE_PATH, '/api/public');
  assert.equal(contract.openapi, '3.1.0');
  assert.match(contract.info.version, /^1\./);
  assert.deepEqual(contract.security, []);
  for (const [path, id] of [
    [listPath, 'listPublicSearchRuns'], [detailPath, 'getPublicSearchRunDetails'],
    [conveniencePath, 'listPublicSearchRunsByQuerySet'],
  ]) assert.equal(contract.paths[path].get.operationId, id);
  // Verify production uses the same mounted router exercised by HTTP tests,
  // without importing app.ts (which initializes Firebase and unrelated auth).
  assert.match(readFileSync(new URL('../server/app.ts', import.meta.url), 'utf8'),
    /app\.use\(PUBLIC_API_BASE_PATH, createPublicApiRouter\(firestoreService\)\)/);
  const schemas = contract.components.schemas;
  for (const [name, required] of Object.entries({
    PublicSearchRunSummary: ['id', 'status', 'queryCount', 'successfulQueries', 'failedQueries', 'totalResults', 'startedAt', 'createdAt', 'visibility'],
    PublicSearchRun: ['id', 'status', 'queryCount', 'successfulQueries', 'failedQueries', 'totalResults', 'inputYaml', 'startedAt', 'createdAt', 'visibility', 'queryResults'],
    QueryResult: ['id', 'sourceQueryId', 'query', 'status', 'resultCount', 'startedAt', 'completedAt', 'videos'],
    Video: ['videoId', 'title', 'channelId', 'channelTitle', 'publishedAt', 'description', 'url', 'thumbnailUrl'],
  })) {
    for (const field of required) assert.ok(schemas[name].required.includes(field), `${name}.${field} lost its guarantee`);
  }
  for (const field of ['videoId', 'title', 'url']) assert.equal(schemas.Video.properties[field].type, 'string');
  for (const name of ['PublicSearchRunSummary', 'PublicSearchRun']) {
    assert.equal(schemas[name].properties.id.type, 'string');
    for (const field of ['querySetId', 'querySetName', 'completedAt']) {
      assert.deepEqual(schemas[name].properties[field].type, ['string', 'null']);
      assert.ok(!schemas[name].required.includes(field), `${name}.${field} must remain optional`);
    }
    assert.deepEqual(schemas[name].properties.status.enum, ['running', 'completed', 'partial', 'failed']);
    assert.deepEqual(schemas[name].properties.visibility.enum, ['public']);
  }
  for (const field of ['relevanceLanguage', 'regionCode', 'errorCode', 'errorMessage']) {
    assert.deepEqual(schemas.QueryResult.properties[field].type, ['string', 'null']);
    assert.ok(!schemas.QueryResult.required.includes(field), `QueryResult.${field} must remain optional`);
  }
  assert.equal(schemas.PublicSearchRun.properties.queryResults.type, 'array');
  assert.equal(schemas.PublicSearchRun.properties.queryResults.items.$ref, '#/components/schemas/QueryResult');
  assert.equal(schemas.QueryResult.properties.videos.type, 'array');
  assert.equal(schemas.QueryResult.properties.videos.items.$ref, '#/components/schemas/Video');
  assert.deepEqual(schemas.QueryResult.properties.status.enum, ['success', 'failed']);
  assert.ok(!schemas.PublicSearchRun.required.includes('results'));
  const limit = contract.paths[listPath].get.parameters.find((p: any) => p.name === 'limit');
  assert.equal(limit.required, false);
  assert.deepEqual([limit.schema.default, limit.schema.minimum, limit.schema.maximum], [50, 1, 100]);
});

test('all OpenAPI schemas, refs, and response examples use validated vocabulary', () => {
  for (const schema of Object.values(contract.components.schemas)) checkSchema(schema);
  for (const [path, item] of Object.entries<any>(contract.paths)) {
    for (const parameter of item.get.parameters) checkSchema(parameter.schema);
    for (const [status, response] of Object.entries<any>(item.get.responses)) {
      const content = response.content['application/json'];
      checkSchema(content.schema);
      if (content.example) validate(responseSchema(path, Number(status)), content.example);
    }
    assert.ok(item.get.responses[503], `Missing actual service error for ${path}`);
  }
});

test('v1 optional fields can be absent/null and additive fields are tolerated', () => {
  const detail = toPublicSearchRun(runFixture);
  validate(responseSchema(detailPath), detail);
  for (const key of ['querySetId', 'querySetName', 'completedAt'] as const) delete detail[key];
  for (const key of ['relevanceLanguage', 'regionCode', 'errorCode', 'errorMessage'] as const) delete detail.queryResults[0][key];
  Object.assign(detail, { futureOptionalField: 'ignored by existing consumers' });
  Object.assign(detail.queryResults[0].videos[0], { futureVideoField: true });
  validate(responseSchema(detailPath), detail);
  validate(responseSchema(listPath), { items: [], futurePageMetadata: null });
  // Unknown additions pass, but established fields/types must still fail when broken.
  const missingId = structuredClone(detail) as any;
  delete missingId.id;
  assert.throws(() => validate(responseSchema(detailPath), missingId), /id: required/);
  const invalidVideo = structuredClone(detail);
  Object.assign(invalidVideo.queryResults[0].videos[0], { videoId: 123 });
  assert.throws(() => validate(responseSchema(detailPath), invalidVideo), /videoId/);
  assert.throws(() => validate(contract.components.schemas.PublicSearchRun, { ...detail, visibility: 'private' }), /enum/);
  assert.throws(() => checkSchema({ type: 'string', nullable: true }), /Unsupported contract keyword/);
});

test('legacy empty metadata and empty results remain valid without weakening populated formats', () => {
  const detail = toPublicSearchRun(runFixture);
  const query = detail.queryResults[0];
  query.startedAt = query.completedAt = '';
  Object.assign(query.videos[0], { title: '', publishedAt: '', thumbnailUrl: '' });
  validate(responseSchema(detailPath), detail);
  query.videos[0].publishedAt = 'invalid date';
  assert.throws(() => validate(responseSchema(detailPath), detail), /publishedAt/);
  query.videos = [];
  validate(responseSchema(detailPath), detail);
  detail.queryResults = [];
  validate(responseSchema(detailPath), detail);
});

test('anonymous HTTP detail exposes stable YouTube sources and handles legacy URL/title defaults', async (t) => {
  const { request, records, user } = await setupHttp(t);
  const detail = await request(detailPath);
  assert.equal(detail.id, runFixture.id);
  const sources = detail.queryResults.flatMap((q: any) => q.videos.map(({ videoId, url, title }: any) => ({ videoId, url, title })));
  assert.deepEqual(sources, [{ videoId: 'dQw4w9WgXcQ', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'Video title' }]);
  assert.equal('outputYaml' in detail, false);
  const video = records.get(`${user}/searchRuns/${runFixture.id}/queryResults/query-one/videos/dQw4w9WgXcQ`)!;
  for (const key of ['videoId', 'url', 'title', 'publishedAt', 'thumbnailUrl']) delete video[key];
  const query = records.get(`${user}/searchRuns/${runFixture.id}/queryResults/query-one`)!;
  delete query.startedAt;
  delete query.completedAt;
  const legacy = await request(detailPath);
  assert.equal(legacy.queryResults[0].videos[0].videoId, 'dQw4w9WgXcQ');
  assert.equal(legacy.queryResults[0].videos[0].url, sources[0].url);
  assert.equal(legacy.queryResults[0].videos[0].title, '');
  assert.equal(legacy.queryResults[0].videos[0].publishedAt, '');
});

test('HTTP lists preserve cap/default/parsing/order/filter and convenience semantics without cursors', async (t) => {
  const { request, addRun, reads } = await setupHttp(t);
  for (let i = 0; i < 105; i++) {
    addRun(`run-${i}`, { startedAt: new Date(Date.UTC(2026, 9, 2, 0, i)).toISOString(), querySetId: 'private-set' });
  }
  addRun('secret', { visibility: 'private' });
  addRun('unset-visibility', { visibility: undefined });
  for (const [query, count] of [
    ['', 50], ['?limit=invalid', 50], ['?limit=', 50], ['?limit=0', 1],
    ['?limit=-2', 1], ['?limit=999', 100], ['?limit=2.5', 2], ['?limit=2suffix', 2],
  ] as const) {
    const body = await request(listPath, { query });
    assert.equal(body.items.length, count);
    assert.equal(body.items[0].id, 'run-104');
    assert.equal(body.items[0].visibility, 'public');
    assert.equal('inputYaml' in body.items[0], false);
    assert.equal('queryResults' in body.items[0], false);
    assert.equal('nextCursor' in body, false);
    assert.equal('total' in body, false);
  }
  const all = await request(listPath, { query: '?limit=100' });
  assert.ok(all.items.every((run: any, i: number) => !i || all.items[i - 1].startedAt >= run.startedAt));
  const filtered = await request(listPath, { query: '?querySetId=%20deleted-set%20' });
  assert.deepEqual(filtered.items.map((r: any) => r.id), [runFixture.id]);
  const convenience = await request(conveniencePath);
  assert.deepEqual(convenience, filtered);
  const privateAssociation = await request(listPath, { query: '?querySetId=private-set&limit=2' });
  assert.deepEqual(privateAssociation, await request(conveniencePath, { querySetId: 'private-set', query: '?limit=2' }));
  assert.deepEqual((await request(listPath, { query: '?querySetId=unknown-set' })).items, []);
  assert.ok(reads.every((path) => !path.includes('/querySets')), 'Search Run visibility must not consult Query Set publication');
});

test('HTTP reads honor current visibility, missing records, and storage failure after cached reads', async (t) => {
  const { request, records, user, setUnavailable } = await setupHttp(t);
  await request(detailPath);
  await request(listPath);
  records.get(`${user}/searchRuns/${runFixture.id}`)!.visibility = 'private';
  await request(detailPath, { status: 404 });
  assert.deepEqual((await request(listPath)).items, []);
  await request(detailPath, { id: 'missing-run', status: 404 });
  records.get(`${user}/searchRuns/${runFixture.id}`)!.visibility = 'public';
  await request(detailPath);
  setUnavailable();
  for (const path of [detailPath, listPath, conveniencePath, `${userPath}/query-sets`, `${userPath}/query-sets/{querySetId}`]) {
    await request(path, { querySetId: 'public-set', status: 503 });
  }
});

test('existing Query Set public paths still match OpenAPI and do not expose private records', async (t) => {
  const { request } = await setupHttp(t);
  const list = await request(`${userPath}/query-sets`);
  assert.deepEqual(list.items.map((item: any) => item.id), ['public-set']);
  assert.equal('rawYaml' in list.items[0], false);
  const detail = await request(`${userPath}/query-sets/{querySetId}`, { querySetId: 'public-set' });
  assert.equal(detail.rawYaml, 'queries: []');
  assert.equal('publicApiEnabled' in detail, false);
  for (const querySetId of ['private-set', 'missing-set']) {
    await request(`${userPath}/query-sets/{querySetId}`, { querySetId, status: 404 });
  }
});

test('HTTP limiter rejects requests with the documented 429 error response', async (t) => {
  const { request } = await setupHttp(t);
  for (let i = 0; i < 100; i++) await request(listPath);
  await request(listPath, { status: 429 });
});
