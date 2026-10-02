import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveSearchRunSource } from '../src/utils/searchRunSource.ts';
import type { QuerySet } from '../src/types/index.ts';

const savedQuerySet: QuerySet = {
  id: 'saved-set',
  name: 'Current name',
  rawYaml: 'queries:\n  - id: current\n    q: current search\n',
  queryCount: 1,
  publicApiEnabled: false,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-02T00:00:00.000Z',
};

test('a missing source remains unsaved while preserving its historical association', () => {
  const source = resolveSearchRunSource([savedQuerySet], {
    querySetId: 'missing-set',
    querySetName: 'Historical name',
  });

  // With no active Query Set, Save must create one rather than update the missing ID.
  assert.equal(source.querySet, null);
  assert.equal(source.originalYaml, null);
  assert.deepEqual(source.association, {
    querySetId: 'missing-set',
    querySetName: 'Historical name',
  });
});

test('an unavailable Query Set list does not fabricate a saved source', () => {
  const source = resolveSearchRunSource([], { querySetId: savedQuerySet.id });

  assert.equal(source.querySet, null);
  assert.deepEqual(source.association, { querySetId: savedQuerySet.id, querySetName: null });
});

test('an existing source uses its saved YAML for change detection and retains the historical name', () => {
  const source = resolveSearchRunSource([savedQuerySet], {
    querySetId: savedQuerySet.id,
    querySetName: 'Name at run time',
  });
  const historicalInput = 'queries:\n  - id: old\n    q: old search\n';

  assert.equal(source.querySet, savedQuerySet);
  assert.equal(source.originalYaml, savedQuerySet.rawYaml);
  assert.notEqual(historicalInput, source.originalYaml);
  assert.equal(source.association.querySetName, 'Name at run time');
});

test('a Search Run from unsaved YAML has no saved source or association', () => {
  const source = resolveSearchRunSource([savedQuerySet], {});

  assert.equal(source.querySet, null);
  assert.equal(source.originalYaml, null);
  assert.deepEqual(source.association, { querySetId: null, querySetName: null });
});
