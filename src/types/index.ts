export interface QuerySet {
  id: string;
  name: string;
  rawYaml: string;
  queryCount: number;
  publicApiEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

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

export interface PublicSearchRunSummary {
  id: string;
  querySetId: string;
  querySetName: string | null;
  status: SearchRunStatus;
  queryCount: number;
  successfulQueries: number;
  failedQueries: number;
  totalResults: number;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
}

export interface PublicSearchRun {
  id: string;
  querySetId: string;
  querySetName: string | null;
  status: SearchRunStatus;
  queryCount: number;
  successfulQueries: number;
  failedQueries: number;
  totalResults: number;
  inputYaml: string;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  queryResults: QueryResultItem[];
}

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
