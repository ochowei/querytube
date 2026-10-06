import assert from 'node:assert/strict';
import test from 'node:test';
import { createStatisticsFetcher } from '../server/youtubeStatistics.ts';
import { executeYouTubeQuery } from '../server/youtubeSearch.ts';

test('statistics batches 50 IDs, deduplicates in-flight queries and preserves precision/missing counts', async (t) => {
  const calls: URL[] = [];
  t.mock.method(globalThis, 'fetch', async (input: string, init: RequestInit) => {
    const url = new URL(input);
    calls.push(url);
    assert.equal(url.pathname, '/youtube/v3/videos');
    assert.equal(url.searchParams.get('part'), 'statistics');
    assert.equal(url.searchParams.get('key'), 'test-key');
    assert.ok(init.signal instanceof AbortSignal);
    assert.equal(new Headers(init.headers).get('Accept'), 'application/json');
    assert.equal(url.searchParams.has('maxResults'), false);
    await new Promise((resolve) => setImmediate(resolve));
    return Response.json({ items: url.searchParams.get('id')!.split(',').map((id) => ({
      id, statistics: { viewCount: '18446744073709551615', likeCount: '0' },
    })) });
  });
  const fetchStatistics = createStatisticsFetcher('test-key');
  assert.equal((await fetchStatistics([])).size, 0);
  assert.equal(calls.length, 0);
  const start = Date.now();
  const ids = Array.from({ length: 51 }, (_, i) => `video-${i}`);
  const [all, overlap] = await Promise.all([fetchStatistics([...ids, ids[0], '']), fetchStatistics([ids[0], ids[50]])]);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map((url) => url.searchParams.get('id')!.split(',').length), [50, 1]);
  assert.equal(all.size, 51);
  assert.deepEqual(overlap.get(ids[0]), all.get(ids[0]));
  assert.deepEqual(overlap.get(ids[50]), all.get(ids[50]));
  const snapshot = all.get(ids[0])!;
  assert.equal(snapshot.viewCount, '18446744073709551615');
  assert.equal(snapshot.likeCount, '0');
  assert.equal(snapshot.commentCount, null);
  assert.ok(Date.parse(snapshot.fetchedAt) >= start && Date.parse(snapshot.fetchedAt) <= Date.now());
  await fetchStatistics(ids);
  assert.equal(calls.length, 2);
  await createStatisticsFetcher('test-key')([ids[0]]);
  assert.equal(calls.length, 3, 'a new run fetches again');
});

test('missing videos and invalid counters never become fabricated zeroes', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ items: [
    { id: 'available', statistics: { viewCount: '-1', likeCount: 100, commentCount: 'bad' } },
    { id: 'no-statistics' }, { id: 'unexpected', statistics: { viewCount: '99' } },
  ] }));
  const snapshots = await createStatisticsFetcher('key')(['available', 'missing', 'no-statistics']);
  assert.equal(snapshots.size, 1);
  assert.deepEqual({ ...snapshots.get('available'), fetchedAt: 'time' }, {
    viewCount: null, likeCount: null, commentCount: null, fetchedAt: 'time',
  });
});

for (const failure of ['http', 'timeout', 'malformed-json', 'malformed-items']) {
  test(`query search remains successful when statistics fails: ${failure}`, async (t) => {
    const calls: URL[] = [];
    t.mock.method(globalThis, 'fetch', async (input: string) => {
      const url = new URL(input);
      calls.push(url);
      if (url.pathname.endsWith('/search')) return Response.json({ items: [{ id: { videoId: 'video' }, snippet: { title: 'A &amp; B' } }] });
      if (failure === 'http') return new Response(null, { status: 403 });
      if (failure === 'timeout') throw new DOMException('contains-secret-key', 'TimeoutError');
      if (failure === 'malformed-json') return new Response('{');
      return Response.json({ items: null });
    });
    const outcome = await executeYouTubeQuery({ id: 'query', q: 'test' }, undefined, 'key');
    assert.equal(outcome.success, true);
    assert.equal(outcome.result!.videos[0].title, 'A & B');
    assert.equal('statistics' in outcome.result!.videos[0], false);
    assert.equal(calls.length, 2);
  });
}

test('empty or failed searches do not request statistics', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return Response.json({ items: [] }); });
  assert.equal((await executeYouTubeQuery({ id: 'q', q: 'empty' }, undefined, 'key')).success, true);
  assert.equal(calls, 1);
  t.mock.method(globalThis, 'fetch', async () => { calls++; return new Response(null, { status: 403 }); });
  assert.equal((await executeYouTubeQuery({ id: 'q', q: 'failed' }, undefined, 'key')).success, false);
  assert.equal(calls, 2);
});
