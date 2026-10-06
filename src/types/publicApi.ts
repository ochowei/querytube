// Public API v1 wire types. Keep independent of internal models.
// Source of truth: openapi/public-api.yaml; validated by public API contract tests.

// Public API DTOs
export interface PublicQuerySetSummary {
  id: string;
  name: string;
  queryCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PublicQuerySet {
  id: string;
  name: string;
  rawYaml: string;
  queryCount: number;
  createdAt: string;
  updatedAt: string;
}

export type PublicSearchRunStatus = 'running' | 'completed' | 'partial' | 'failed';

export interface PublicSearchRunSummary {
  id: string;
  querySetId?: string | null;
  querySetName?: string | null;
  status: PublicSearchRunStatus;
  queryCount: number;
  successfulQueries: number;
  failedQueries: number;
  totalResults: number;
  startedAt: string;
  completedAt?: string | null;
  createdAt: string;
  visibility: 'public';
}

export interface PublicSearchRun extends PublicSearchRunSummary {
  inputYaml: string;
  queryResults: PublicQueryResult[];
}

export interface PublicQueryResult {
  id: string;
  sourceQueryId: string;
  query: string;
  relevanceLanguage?: string | null;
  regionCode?: string | null;
  status: 'success' | 'failed';
  resultCount: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  startedAt: string;
  completedAt: string;
  videos: PublicVideo[];
}

export interface PublicVideoStatisticsSnapshot {
  viewCount: string | null;
  likeCount: string | null;
  commentCount: string | null;
  fetchedAt: string;
}

export interface PublicVideo {
  videoId: string;
  title: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  description: string;
  url: string;
  thumbnailUrl: string;
  statistics?: PublicVideoStatisticsSnapshot;
}
