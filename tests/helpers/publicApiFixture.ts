import type { SearchRunDetails } from '../../src/types/index.ts';

export const runFixture: SearchRunDetails = {
  id: 'run-one', status: 'completed', queryCount: 1, successfulQueries: 1,
  failedQueries: 0, totalResults: 1, inputYaml: 'queries: []',
  startedAt: '2026-10-01T02:10:00.000Z', createdAt: '2026-10-01T02:10:00.000Z',
  visibility: 'public', outputYaml: 'internal output',
  queryResults: [{
    id: 'query-one', sourceQueryId: 'source-one', query: 'video search',
    status: 'success', resultCount: 1,
    startedAt: '2026-10-01T02:10:01.000Z', completedAt: '2026-10-01T02:10:03.000Z',
    videos: [{
      videoId: 'dQw4w9WgXcQ', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      title: 'Video title', channelId: 'channel-one', channelTitle: 'Channel',
      publishedAt: '2026-09-28T14:00:00.000Z', description: '',
      thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    }],
  }],
};
