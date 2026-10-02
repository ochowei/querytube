import type { QuerySet, SearchRun } from '../types';

export type SearchRunAssociation = Pick<SearchRun, 'querySetId' | 'querySetName'>;

export function resolveSearchRunSource(querySets: QuerySet[], source: SearchRunAssociation) {
  const querySet = querySets.find((item) => item.id === source.querySetId) ?? null;

  return {
    querySet,
    originalYaml: querySet?.rawYaml ?? null,
    // Association metadata does not establish that a saved Query Set still exists.
    association: {
      querySetId: source.querySetId ?? null,
      querySetName: source.querySetName ?? null,
    },
  };
}
