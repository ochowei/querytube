import assert from 'node:assert/strict';
import test from 'node:test';
import { AuthenticatedFetchError, authenticatedFetch } from '../src/utils/authenticatedFetch.ts';

function stubFetch(t: test.TestContext, responder: typeof fetch) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = responder;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
}

test('sends a bearer token and returns a successful response', async (t) => {
  const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  stubFetch(t, (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ input, init });
    return new Response('ok', { status: 200 });
  }) as typeof fetch);

  const response = await authenticatedFetch(
    '/api/data',
    { method: 'GET' },
    async () => 'initial-token',
    () => assert.fail('session should not expire')
  );

  assert.equal(response.status, 200);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].input, '/api/data');
  assert.equal(new Headers(requests[0].init?.headers).get('Authorization'), 'Bearer initial-token');
});

test('refreshes the token once after a 401 and retries with the refreshed token', async (t) => {
  const authorizationHeaders: string[] = [];
  const refreshArgs: Array<boolean | undefined> = [];
  let fetchCount = 0;

  stubFetch(t, (async (_input: RequestInfo | URL, init?: RequestInit) => {
    fetchCount += 1;
    authorizationHeaders.push(new Headers(init?.headers).get('Authorization') ?? '');
    return fetchCount === 1 ? new Response(null, { status: 401 }) : new Response('ok', { status: 200 });
  }) as typeof fetch);

  const response = await authenticatedFetch(
    '/api/data',
    {},
    async (forceRefresh) => {
      refreshArgs.push(forceRefresh);
      return forceRefresh ? 'refreshed-token' : 'initial-token';
    },
    () => assert.fail('session should not expire after a successful retry')
  );

  assert.equal(response.status, 200);
  assert.deepEqual(refreshArgs, [undefined, true]);
  assert.deepEqual(authorizationHeaders, ['Bearer initial-token', 'Bearer refreshed-token']);
});

test('does not refresh after a non-401 response', async (t) => {
  let fetchCount = 0;
  let tokenCount = 0;
  stubFetch(t, (async () => {
    fetchCount += 1;
    return new Response(null, { status: 403 });
  }) as typeof fetch);

  const response = await authenticatedFetch(
    '/api/data',
    {},
    async () => {
      tokenCount += 1;
      return 'token';
    },
    () => assert.fail('session should not expire after a 403')
  );

  assert.equal(response.status, 403);
  assert.equal(fetchCount, 1);
  assert.equal(tokenCount, 1);
});

test('throws without fetching when no initial token is available', async () => {
  await assert.rejects(
    authenticatedFetch('/api/data', {}, async () => null, () => assert.fail('session should not expire')),
    (error: unknown) => error instanceof AuthenticatedFetchError && error.status === undefined
  );
});

test('signals an expired session after a refreshed-token retry also returns 401', async (t) => {
  let fetchCount = 0;
  let sessionExpiredCalls = 0;
  stubFetch(t, (async () => {
    fetchCount += 1;
    return new Response(null, { status: 401 });
  }) as typeof fetch);

  await assert.rejects(
    authenticatedFetch(
      '/api/data',
      {},
      async (forceRefresh) => forceRefresh ? 'refreshed-token' : 'initial-token',
      () => {
        sessionExpiredCalls += 1;
      }
    ),
    (error: unknown) => error instanceof AuthenticatedFetchError && error.status === 401
  );

  assert.equal(fetchCount, 2);
  assert.equal(sessionExpiredCalls, 1);
});
