import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import test, { before, after } from 'node:test';
import app, { encryptSecret, decryptSecret } from '../server/app.ts';
import { adminAuth, firebaseProjectId, firestoreDatabaseId } from '../server/firebaseAdmin.ts';

const clientFetch = globalThis.fetch;
const settingsPath = '/api/settings/youtube-api-key';
const encryptionKey = 'credential-regression-test-secret';
const missingKey = {
  error: 'YOUTUBE_API_KEY_REQUIRED',
  message: 'Configure your YouTube API key before running a search.',
};
let server: Server;
let baseUrl: string;
let nextUid = 0;

before(async () => {
  server = await new Promise<Server>((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  });
});

type OutboundCall = { url: URL; init: RequestInit };

function setup(t: test.TestContext, respond: (call: OutboundCall) => Response | Promise<Response> = () => new Response(null, { status: 404 })) {
  const uid = `credential-test-${++nextUid}`;
  const calls: OutboundCall[] = [];
  const originalKey = process.env.USER_API_KEY_ENCRYPTION_KEY;
  process.env.USER_API_KEY_ENCRYPTION_KEY = encryptionKey;
  t.after(() => {
    if (originalKey === undefined) delete process.env.USER_API_KEY_ENCRYPTION_KEY;
    else process.env.USER_API_KEY_ENCRYPTION_KEY = originalKey;
  });
  t.mock.method(adminAuth, 'verifyIdToken', async (token: string) => {
    if (token === 'invalid-token') throw new Error('Invalid token');
    return { uid: token };
  });
  t.mock.method(globalThis, 'fetch', async (input: string | URL, init: RequestInit = {}) => {
    const call = { url: new URL(String(input)), init };
    calls.push(call);
    return respond(call);
  });
  t.mock.method(console, 'warn', () => {});
  t.mock.method(console, 'log', () => {});

  async function request(method: string, path = settingsPath, body?: unknown, token: string | null = uid, accept?: string) {
    const headers: Record<string, string> = {};
    if (token !== null) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (accept) headers.Accept = accept;
    return clientFetch(`${baseUrl}${path}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
  return { uid, calls, request };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function assertStorageCall(call: OutboundCall, method: string, uid: string) {
  assert.equal(call.url.toString(), `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/${firestoreDatabaseId || '(default)'}/documents/users/${uid}/integrations/youtube`);
  assert.equal(call.init.method, method);
  assert.equal(new Headers(call.init.headers).get('Authorization'), `Bearer ${uid}`);
}

// Create a legacy-compatible document independently of the extracted helpers.
function storedFields(apiKey: string) {
  const iv = Buffer.alloc(12, 7);
  const cipher = crypto.createCipheriv('aes-256-gcm', crypto.createHash('sha256').update(encryptionKey).digest(), iv);
  const encrypted = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()]);
  return {
    encryptedApiKey: { stringValue: encrypted.toString('base64') },
    iv: { stringValue: iv.toString('base64') },
    authTag: { stringValue: cipher.getAuthTag().toString('base64') },
  };
}

test('crypto exports retain AES-GCM payload compatibility and require configuration', (t) => {
  setup(t);
  const plaintext = 'test-youtube-key';
  const encrypted = encryptSecret(plaintext);
  assert.equal(encrypted.keyVersion, 1);
  assert.equal(Buffer.from(encrypted.iv, 'base64').length, 12);
  assert.equal(Buffer.from(encrypted.authTag, 'base64').length, 16);
  assert.equal(decryptSecret(encrypted), plaintext);
  assert.throws(() => decryptSecret({ ...encrypted, authTag: Buffer.alloc(16).toString('base64') }));
  delete process.env.USER_API_KEY_ENCRYPTION_KEY;
  assert.throws(() => encryptSecret(plaintext), /USER_API_KEY_ENCRYPTION_KEY is required/);
  assert.throws(() => decryptSecret(encrypted), /USER_API_KEY_ENCRYPTION_KEY is required/);
});

test('credential routes, aliases, and search still require Firebase authentication', async (t) => {
  const { request, calls } = setup(t);
  const routes = [
    ['GET', settingsPath], ['POST', settingsPath], ['DELETE', settingsPath],
    ['GET', '/api/config'], ['GET', '/api/youtube/status'], ['POST', '/api/youtube/search?stream=true'],
  ];
  for (const [method, path] of routes) {
    for (const token of [null, '', 'invalid-token']) {
      const response = await request(method, path, undefined, token);
      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { error: 'Authentication required' });
    }
  }
  assert.equal(calls.length, 0);
});

test('GET absent credential and status aliases retain their exact response shapes', async (t) => {
  const { request, calls, uid } = setup(t);
  const response = await request('GET');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { configured: false });
  for (const path of ['/api/config', '/api/youtube/status']) {
    const alias = await request('GET', path);
    assert.equal(alias.status, 200);
    assert.deepEqual(await alias.json(), { hasApiKey: false, suffix: null, configured: false });
  }
  calls.forEach((call) => assertStorageCall(call, 'GET', uid));
});

test('GET restores an existing encrypted key, falls back for absent metadata, and caches per UID', async (t) => {
  const fields = storedFields('legacy-youtube-ABCD');
  const { request, calls, uid } = setup(t, () => jsonResponse({ fields }));
  const response = await request('GET');
  assert.deepEqual(await response.json(), { configured: true, suffix: 'ABCD', verifiedAt: null });
  assertStorageCall(calls[0], 'GET', uid);
  await request('GET');
  assert.equal(calls.length, 1);
  await request('GET', settingsPath, undefined, `${uid}-other`);
  assert.equal(calls.length, 2);
  assertStorageCall(calls[1], 'GET', `${uid}-other`);
});

test('GET returns stored suffix and verification timestamp without exposing the plaintext', async (t) => {
  const fields = {
    ...storedFields('existing-key-ABCD'), keyVersion: { integerValue: '1' },
    keySuffix: { stringValue: 'MASK' }, verifiedAt: { stringValue: '2026-10-02T00:00:00.000Z' },
  };
  const { request } = setup(t, () => jsonResponse({ fields }));
  assert.deepEqual(await (await request('GET')).json(), {
    configured: true, suffix: 'MASK', verifiedAt: '2026-10-02T00:00:00.000Z',
  });
});

for (const failure of ['permission', 'network', 'incomplete', 'corrupt', 'missing-encryption-config']) {
  test(`GET treats ${failure} as unconfigured`, async (t) => {
    const { request } = setup(t, () => {
      if (failure === 'permission') return new Response(null, { status: 403 });
      if (failure === 'network') throw new Error('Network unavailable');
      const fields = storedFields('existing-key-ABCD');
      if (failure === 'incomplete') delete (fields as Partial<typeof fields>).iv;
      if (failure === 'corrupt') fields.authTag.stringValue = Buffer.alloc(16).toString('base64');
      return jsonResponse({ fields });
    });
    if (failure === 'missing-encryption-config') delete process.env.USER_API_KEY_ENCRYPTION_KEY;
    const response = await request('GET');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { configured: false });
  });
}

test('POST rejects missing, non-string, and short keys without outbound requests', async (t) => {
  const { request, calls } = setup(t);
  for (const body of [undefined, {}, { apiKey: 12345 }, { apiKey: '' }, { apiKey: '  abcd  ' }]) {
    const response = await request('POST', settingsPath, body);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'Please provide a valid YouTube API key.' });
  }
  assert.equal(calls.length, 0);
});

test('POST verifies the trimmed key, preserves encrypted Firestore fields, and serves warm status', async (t) => {
  const { request, calls, uid } = setup(t, () => jsonResponse({}));
  const startedAt = Date.now();
  const response = await request('POST', settingsPath, { apiKey: '  example-youtube-key-ABCD  ' });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, suffix: 'ABCD' });
  assert.equal(calls.length, 2);
  const verification = calls[0];
  assert.equal(verification.url.origin + verification.url.pathname, 'https://www.googleapis.com/youtube/v3/videoCategories');
  assert.deepEqual(Object.fromEntries(verification.url.searchParams), { part: 'snippet', regionCode: 'US', key: 'example-youtube-key-ABCD' });
  assert.equal(verification.init.method, 'GET');
  assert.equal(new Headers(verification.init.headers).get('Accept'), 'application/json');
  assert.ok(verification.init.signal instanceof AbortSignal);
  assertStorageCall(calls[1], 'PATCH', uid);
  assert.equal(new Headers(calls[1].init.headers).get('Content-Type'), 'application/json');
  const { fields } = JSON.parse(String(calls[1].init.body));
  assert.deepEqual(Object.keys(fields).sort(), ['authTag', 'encryptedApiKey', 'iv', 'keySuffix', 'keyVersion', 'updatedAt', 'verifiedAt'].sort());
  assert.deepEqual(fields.keyVersion, { integerValue: '1' });
  assert.deepEqual(fields.keySuffix, { stringValue: 'ABCD' });
  assert.deepEqual(fields.updatedAt, fields.verifiedAt);
  assert.ok(Date.parse(fields.verifiedAt.stringValue) >= startedAt);
  assert.ok(Date.parse(fields.verifiedAt.stringValue) <= Date.now());
  const decipher = crypto.createDecipheriv('aes-256-gcm', crypto.createHash('sha256').update(encryptionKey).digest(), Buffer.from(fields.iv.stringValue, 'base64'));
  decipher.setAuthTag(Buffer.from(fields.authTag.stringValue, 'base64'));
  assert.equal(Buffer.concat([decipher.update(Buffer.from(fields.encryptedApiKey.stringValue, 'base64')), decipher.final()]).toString('utf8'), 'example-youtube-key-ABCD');
  assert.deepEqual(await (await request('GET')).json(), { configured: true, suffix: 'ABCD', verifiedAt: fields.verifiedAt.stringValue });
  for (const path of ['/api/config', '/api/youtube/status']) {
    assert.deepEqual(await (await request('GET', path)).json(), { hasApiKey: true, suffix: 'ABCD', configured: true });
  }
  assert.equal(calls.length, 2);
});

const verificationErrors = [
  { reason: 'keyInvalid', status: 403, message: '', expected: 'The YouTube API key is invalid or unrecognized.' },
  { reason: 'badRequest', status: 403, message: '', expected: 'The YouTube API key is invalid or unrecognized.' },
  { reason: 'quotaExceeded', status: 400, message: '', expected: 'The YouTube API key is invalid or unrecognized.' },
  { reason: 'accessNotConfigured', status: 403, message: '', expected: 'YouTube Data API v3 is disabled in your Google Cloud project. Please enable it in the Google Cloud Console.' },
  { reason: '', status: 403, message: 'API has not been used', expected: 'YouTube Data API v3 is disabled in your Google Cloud project. Please enable it in the Google Cloud Console.' },
  { reason: 'quotaExceeded', status: 403, message: '', expected: 'The YouTube API quota for this key has been exceeded.' },
  { reason: 'dailyLimitExceeded', status: 403, message: '', expected: 'The YouTube API quota for this key has been exceeded.' },
  { reason: 'ipRefererBlocked', status: 403, message: '', expected: 'The YouTube API key has restrictions (e.g. IP or HTTP referrer) that block server calls.' },
  { reason: '', status: 403, message: 'key restriction', expected: 'The YouTube API key has restrictions (e.g. IP or HTTP referrer) that block server calls.' },
  { reason: 'unknown', status: 503, message: '', expected: 'The YouTube API key could not be verified.' },
];

for (const item of verificationErrors) {
  test(`POST preserves verification error ${item.reason || item.message} at HTTP ${item.status}`, async (t) => {
    const { request, calls } = setup(t, () => jsonResponse({ error: { errors: [{ reason: item.reason }], message: item.message } }, item.status));
    const response = await request('POST', settingsPath, { apiKey: 'rejected-key' });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: item.expected });
    assert.equal(calls.length, 1); // Verification failure does not persist or cache the key.
    assert.deepEqual(await (await request('GET')).json(), { configured: false });
  });
}

for (const failure of ['malformed', 'timeout', 'network']) {
  test(`POST preserves ${failure} verification failure`, async (t) => {
    const { request, calls } = setup(t, () => {
      if (failure === 'timeout') throw new DOMException('timed out', 'TimeoutError');
      if (failure === 'network') throw new Error('Network unavailable');
      return new Response('not JSON', { status: 503 });
    });
    const response = await request('POST', settingsPath, { apiKey: 'rejected-key' });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: failure === 'timeout'
      ? 'Connection to YouTube API timed out. Please try again.'
      : failure === 'network' ? 'Network error communicating with YouTube Data API.' : 'The YouTube API key could not be verified.' });
    assert.equal(calls.length, 1);
  });
}

for (const failure of ['http', 'network']) {
  test(`POST caches before persistence and succeeds on ${failure} PATCH failure; DELETE evicts despite failure`, async (t) => {
    const { request, calls, uid } = setup(t, async ({ init }) => {
      if (init.method === 'PATCH') {
        assert.deepEqual(await (await request('GET')).json(), { configured: true, suffix: 'ABCD', verifiedAt: JSON.parse(String(init.body)).fields.verifiedAt.stringValue });
      }
      if (init.method === 'PATCH' || init.method === 'DELETE') {
        if (failure === 'network') throw new Error('Network unavailable');
        return new Response('permission denied', { status: 403 });
      }
      return init.method === 'GET' && calls.length === 1 ? jsonResponse({}) : new Response(null, { status: 404 });
    });
    const configured = await request('POST', settingsPath, { apiKey: 'example-key-ABCD' });
    assert.equal(configured.status, 200);
    assert.deepEqual(await configured.json(), { success: true, suffix: 'ABCD' });
    assert.equal(calls.length, 2);
    const removed = await request('DELETE');
    assert.equal(removed.status, 200);
    assert.deepEqual(await removed.json(), { success: true, message: 'YouTube API key removed successfully.' });
    assertStorageCall(calls[2], 'DELETE', uid);
    assert.deepEqual(await (await request('GET')).json(), { configured: false });
    assertStorageCall(calls[3], 'GET', uid);
  });
}

test('DELETE evicts before storage access and removes only the authenticated UID cache', async (t) => {
  let deleted = false;
  const { request, calls, uid } = setup(t, async ({ url, init }) => {
    if (init.method === 'DELETE') {
      deleted = true;
      assert.deepEqual(await (await request('GET')).json(), { configured: false });
      return new Response(null, { status: 204 });
    }
    return deleted && url.pathname.includes(`/users/${uid}/`) ? new Response(null, { status: 404 }) : jsonResponse({});
  });
  await request('POST', settingsPath, { apiKey: 'first-key-AAAA' });
  await request('POST', settingsPath, { apiKey: 'other-key-BBBB' }, `${uid}-other`);
  const response = await request('DELETE');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, message: 'YouTube API key removed successfully.' });
  const callCount = calls.length;
  const otherStatus = await (await request('GET', settingsPath, undefined, `${uid}-other`)).json();
  assert.equal(otherStatus.suffix, 'BBBB');
  assert.equal(calls.length, callCount);
  assert.deepEqual(await (await request('GET')).json(), { configured: false });
});

for (const stream of ['json', 'query', 'accept']) {
  test(`search missing-key ${stream} response precedes YAML validation and Search Run creation`, async (t) => {
    const { request, calls, uid } = setup(t);
    const response = await request('POST', `/api/youtube/search${stream === 'query' ? '?stream=true' : ''}`, { yaml: 'invalid: [yaml' }, uid, stream === 'accept' ? 'text/event-stream' : undefined);
    if (stream === 'json') {
      assert.equal(response.status, 428);
      assert.deepEqual(await response.json(), missingKey);
    } else {
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('Content-Type'), 'text/event-stream');
      assert.equal(response.headers.get('Cache-Control'), 'no-cache');
      assert.equal(response.headers.get('Connection'), 'keep-alive');
      assert.equal(await response.text(), `data: ${JSON.stringify({ type: 'fatal_error', ...missingKey })}\n\n`);
    }
    assert.equal(calls.length, 1); // No YouTube search or Search Run persistence calls.
    assertStorageCall(calls[0], 'GET', uid);
  });
}
