import type { SearchRun, SearchRunDetails } from '../src/types/index.js';
import type { PublicSearchRunSummary, PublicSearchRun } from '../src/types/publicApi.js';

// Call only after checking the run's current persisted visibility is public.
export function toPublicSearchRunSummary(r: SearchRun): PublicSearchRunSummary {
  return {
    id: r.id,
    querySetId: r.querySetId ?? null,
    querySetName: r.querySetName ?? null,
    status: r.status,
    queryCount: r.queryCount,
    successfulQueries: r.successfulQueries,
    failedQueries: r.failedQueries,
    totalResults: r.totalResults,
    startedAt: r.startedAt,
    completedAt: r.completedAt ?? null,
    createdAt: r.createdAt,
    visibility: 'public',
  };
}

export function toPublicSearchRun(details: SearchRunDetails): PublicSearchRun {
  return {
    id: details.id,
    querySetId: details.querySetId ?? null,
    querySetName: details.querySetName ?? null,
    status: details.status,
    queryCount: details.queryCount,
    successfulQueries: details.successfulQueries,
    failedQueries: details.failedQueries,
    totalResults: details.totalResults,
    inputYaml: details.inputYaml,
    startedAt: details.startedAt,
    completedAt: details.completedAt ?? null,
    createdAt: details.createdAt,
    visibility: 'public',
    queryResults: (details.queryResults || []).map((q) => ({
      id: q.id,
      sourceQueryId: q.sourceQueryId,
      query: q.query,
      relevanceLanguage: q.relevanceLanguage ?? null,
      regionCode: q.regionCode ?? null,
      status: q.status,
      resultCount: q.resultCount,
      errorCode: q.errorCode ?? null,
      errorMessage: q.errorMessage ?? null,
      startedAt: q.startedAt,
      completedAt: q.completedAt,
      videos: (q.videos || []).map((v) => ({
        videoId: v.videoId,
        title: v.title,
        channelId: v.channelId,
        channelTitle: v.channelTitle,
        publishedAt: v.publishedAt,
        description: v.description,
        url: v.url,
        thumbnailUrl: v.thumbnailUrl,
      })),
    })),
  };
}
