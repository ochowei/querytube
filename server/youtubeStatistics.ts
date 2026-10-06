import type { VideoStatisticsSnapshot } from '../src/types/index.js';

export type StatisticsFetcher = (videoIds: string[]) => Promise<Map<string, VideoStatisticsSnapshot>>;

function count(value: unknown): string | null {
  return typeof value === 'string' && /^[0-9]+$/.test(value) ? value : null;
}

// Create once per Search Run. Promise entries deduplicate overlapping queries,
// including requests that are still in flight. Never reuse this cache across runs.
export function createStatisticsFetcher(apiKey: string): StatisticsFetcher {
  const cache = new Map<string, Promise<VideoStatisticsSnapshot | undefined>>();

  async function fetchBatch(ids: string[]): Promise<Map<string, VideoStatisticsSnapshot>> {
    const snapshots = new Map<string, VideoStatisticsSnapshot>();
    const url = new URL('https://www.googleapis.com/youtube/v3/videos');
    url.searchParams.set('part', 'statistics');
    url.searchParams.set('id', ids.join(','));
    url.searchParams.set('key', apiKey);
    try {
      const response = await fetch(url.toString(), {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) return snapshots;
      const data = await response.json() as any;
      if (!Array.isArray(data?.items)) return snapshots;
      const fetchedAt = new Date().toISOString();
      for (const item of data.items) {
        if (!ids.includes(item?.id) || !item.statistics || typeof item.statistics !== 'object' || Array.isArray(item.statistics)) continue;
        snapshots.set(item.id, {
          viewCount: count(item.statistics.viewCount),
          likeCount: count(item.statistics.likeCount),
          commentCount: count(item.statistics.commentCount),
          fetchedAt,
        });
      }
    } catch {
      // Enrichment is best effort. Do not log credential-bearing URLs/errors.
    }
    return snapshots;
  }

  return async (videoIds) => {
    const ids = [...new Set(videoIds.filter(Boolean))];
    const missing = ids.filter((id) => !cache.has(id));
    for (let i = 0; i < missing.length; i += 50) {
      const batch = missing.slice(i, i + 50);
      const pending = fetchBatch(batch);
      for (const id of batch) cache.set(id, pending.then((snapshots) => snapshots.get(id)));
    }
    const snapshots = new Map<string, VideoStatisticsSnapshot>();
    await Promise.all(ids.map(async (id) => {
      const snapshot = await cache.get(id)!;
      if (snapshot) snapshots.set(id, snapshot);
    }));
    return snapshots;
  };
}
