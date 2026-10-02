import assert from 'node:assert/strict';
import test from 'node:test';
import { SAMPLE_YAMLS, validateYamlString } from '../src/utils/yamlValidator.ts';

test('accepts each built-in YAML sample', () => {
  for (const [name, sample] of Object.entries(SAMPLE_YAMLS)) {
    const result = validateYamlString(sample.yaml);

    assert.equal(result.valid, true, `${name}: ${result.errors.join('; ')}`);
    assert.equal(result.queryCount, result.parsed?.queries.length);
  }
});

test('reports empty input and YAML syntax errors', () => {
  const empty = validateYamlString('  \n');
  assert.equal(empty.valid, false);
  assert.equal(empty.queryCount, 0);
  assert.match(empty.errors[0], /input is empty/i);

  const malformed = validateYamlString('queries: [');
  assert.equal(malformed.valid, false);
  assert.equal(malformed.queryCount, 0);
  assert.match(malformed.errors[0], /^Syntax error:/);
});

test('requires a non-empty queries list', () => {
  assert.match(validateYamlString('version: 1').errors[0], /Missing required "queries"/);
  assert.match(validateYamlString('queries: nope').errors[0], /must be a YAML list/);
  assert.match(validateYamlString('queries: []').errors[0], /at least one query item/);
});

test('rejects missing query fields and IDs duplicated after trimming', () => {
  const result = validateYamlString(`queries:
  - id: " first "
    q: "valid query"
  - id: first
    q: "another query"
  - id: " "
    q: " "
`);

  assert.equal(result.valid, false);
  assert.equal(result.queryCount, 3);
  assert.ok(result.errors.some((error) => /Duplicate query id "first"/.test(error)));
  assert.ok(result.errors.some((error) => /Missing required non-empty string "id"/.test(error)));
  assert.ok(result.errors.some((error) => /Missing required non-empty search query "q"/.test(error)));
});

test('enforces result-count boundaries and supported option values', () => {
  const valid = validateYamlString(`defaults:
  max_results: 50
  order: viewCount
  safe_search: strict
queries:
  - id: boundary
    q: "valid query"
    max_results: 1
    order: date
    safe_search: none
`);
  assert.equal(valid.valid, true, valid.errors.join('; '));

  const invalid = validateYamlString(`defaults:
  max_results: 51
  order: popularity
  safe_search: yes
queries:
  - id: invalid
    q: "valid query"
    max_results: 0
    order: newest
    safe_search: unsafe
`);
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.some((error) => /defaults\.max_results/.test(error)));
  assert.ok(invalid.errors.some((error) => /defaults\.order/.test(error)));
  assert.ok(invalid.errors.some((error) => /defaults\.safe_search/.test(error)));
  assert.ok(invalid.errors.some((error) => /max_results/.test(error) && /between 1 and 50/.test(error)));
  assert.ok(invalid.errors.some((error) => /order/.test(error) && /relevance, date, rating, title, viewCount/.test(error)));
  assert.ok(invalid.errors.some((error) => /safe_search/.test(error) && /none, moderate, strict/.test(error)));
});
