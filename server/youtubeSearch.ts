import type { QueryConfig, YamlDefaults } from './yamlValidator.js';
import type { VideoStatisticsSnapshot } from '../src/types/index.js';
import { createStatisticsFetcher, type StatisticsFetcher } from './youtubeStatistics.js';

export interface VideoResult {
  video_id: string;
  title: string;
  channel_id: string;
  channel_title: string;
  published_at: string;
  description: string;
  url: string;
  thumbnail_url: string;
  statistics?: VideoStatisticsSnapshot;
}

export interface QuerySuccessResult {
  id: string;
  query: string;
  relevance_language?: string;
  region_code?: string;
  count: number;
  videos: VideoResult[];
}

export interface QueryErrorResult {
  id: string;
  query: string;
  error: string;
}

function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, dec) => {
      try {
        return String.fromCharCode(parseInt(dec, 10));
      } catch {
        return _;
      }
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      try {
        return String.fromCharCode(parseInt(hex, 16));
      } catch {
        return _;
      }
    });
}

// Single query executor using user's YouTube API key
export async function executeYouTubeQuery(
  query: QueryConfig,
  defaults: YamlDefaults | undefined,
  apiKey: string,
  fetchStatistics: StatisticsFetcher = createStatisticsFetcher(apiKey)
): Promise<{ success: boolean; result?: QuerySuccessResult; error?: QueryErrorResult }> {
  const maxResults = query.max_results ?? defaults?.max_results ?? 10;
  const order = query.order ?? defaults?.order ?? 'relevance';
  const safeSearch = query.safe_search ?? defaults?.safe_search ?? 'moderate';
  const relevanceLanguage = query.relevance_language;
  const regionCode = query.region_code;
  const publishedAfter = query.published_after;
  const publishedBefore = query.published_before;

  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('type', 'video');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('q', query.q);
  url.searchParams.set('maxResults', String(Math.min(50, Math.max(1, maxResults))));
  url.searchParams.set('order', order);
  url.searchParams.set('safeSearch', safeSearch);

  if (relevanceLanguage) {
    url.searchParams.set('relevanceLanguage', relevanceLanguage);
  }
  if (regionCode) {
    url.searchParams.set('regionCode', regionCode);
  }
  if (publishedAfter) {
    url.searchParams.set('publishedAfter', publishedAfter);
  }
  if (publishedBefore) {
    url.searchParams.set('publishedBefore', publishedBefore);
  }

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status} ${response.statusText}`;
      try {
        const errorData = (await response.json()) as any;
        if (errorData?.error?.message) {
          errorMessage = errorData.error.message;
        }
      } catch {
        // fallback
      }
      return {
        success: false,
        error: {
          id: query.id,
          query: query.q,
          error: errorMessage,
        },
      };
    }

    const data = (await response.json()) as any;
    const items = Array.isArray(data.items) ? data.items : [];

    const videos: VideoResult[] = items.map((item: any) => {
      const videoId = item?.id?.videoId || '';
      const snippet = item?.snippet || {};
      const thumbnails = snippet?.thumbnails || {};
      const thumbnailUrl =
        thumbnails.high?.url ||
        thumbnails.medium?.url ||
        thumbnails.default?.url ||
        '';

      return {
        video_id: videoId,
        title: decodeHtmlEntities(snippet.title || ''),
        channel_id: snippet.channelId || '',
        channel_title: decodeHtmlEntities(snippet.channelTitle || ''),
        published_at: snippet.publishedAt || '',
        description: decodeHtmlEntities(snippet.description || ''),
        url: `https://www.youtube.com/watch?v=${videoId}`,
        thumbnail_url: thumbnailUrl,
      };
    });

    const snapshots = await fetchStatistics(videos.map((video) => video.video_id));
    for (const video of videos) {
      const snapshot = snapshots.get(video.video_id);
      if (snapshot) video.statistics = snapshot;
    }

    const successResult: QuerySuccessResult = {
      id: query.id,
      query: query.q,
      count: videos.length,
      videos,
    };

    if (relevanceLanguage) {
      successResult.relevance_language = relevanceLanguage;
    }
    if (regionCode) {
      successResult.region_code = regionCode;
    }

    return {
      success: true,
      result: successResult,
    };
  } catch (err: any) {
    let msg = err?.message || 'Network request failed';
    if (err?.name === 'TimeoutError' || err?.message?.includes('timeout')) {
      msg = 'Request timed out after 15 seconds.';
    }
    return {
      success: false,
      error: {
        id: query.id,
        query: query.q,
        error: msg,
      },
    };
  }
}

