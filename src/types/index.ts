export type ResourceVisibility = 'private' | 'public';

export interface QuerySet {
  id: string;
  name: string;
  rawYaml: string;
  queryCount: number;
  publicApiEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// Preserve existing public DTO import paths.
export type {
  PublicQuerySetSummary,
  PublicQuerySet,
  PublicSearchRunSummary,
  PublicSearchRun,
} from './publicApi.js';

export type SearchRunStatus = 'running' | 'completed' | 'partial' | 'failed';

export interface SearchRun {
  id: string;
  querySetId?: string | null;
  querySetName?: string | null;
  status: SearchRunStatus;
  queryCount: number;
  successfulQueries: number;
  failedQueries: number;
  totalResults: number;
  inputYaml: string;
  startedAt: string;
  completedAt?: string | null;
  createdAt: string;
  visibility: ResourceVisibility;
}

export interface VideoStatisticsSnapshot {
  // Decimal strings preserve YouTube count precision; null means unavailable.
  viewCount: string | null;
  likeCount: string | null;
  commentCount: string | null;
  fetchedAt: string;
}

export interface StoredVideoItem {
  videoId: string;
  title: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  description: string;
  url: string;
  thumbnailUrl: string;
  statistics?: VideoStatisticsSnapshot;
}

export interface QueryResultItem {
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
  videos?: StoredVideoItem[];
}

export interface SearchRunDetails extends SearchRun {
  queryResults: QueryResultItem[];
  outputYaml: string;
}

export interface ApiDocsNavigationContext {
  userId?: string;
  querySetId?: string;
  runId?: string;
  targetOperationId?: string;
}
