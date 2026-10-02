import assert from 'node:assert/strict';
import test from 'node:test';
import { validateParsedYaml } from '../server/yamlValidator.ts';

test('accepts valid parsed YAML and preserves the parsed payload', () => {
  const data = {
    version: 1,
    defaults: { max_results: 50, order: 'viewCount', safe_search: 'strict' },
    queries: [{ id: 'valid', q: 'a search', max_results: 1, order: 'date', safe_search: 'none' }],
  };

  const result = validateParsedYaml(data);

  assert.equal(result.valid, true, result.errors.join('; '));
  assert.equal(result.parsed, data);
});

test('requires queries to be a non-empty list', () => {
  assert.match(validateParsedYaml(null).errors[0], /object with a queries list/);
  assert.match(validateParsedYaml({}).errors[0], /Missing required "queries"/);
  assert.match(validateParsedYaml({ queries: 'query' }).errors[0], /must be a list/);
  assert.match(validateParsedYaml({ queries: [] }).errors[0], /at least one query item/);
});

test('rejects invalid query fields, duplicate IDs, and unsupported options', () => {
  const result = validateParsedYaml({
    defaults: { max_results: 51, order: 'popularity', safe_search: 'unsafe' },
    queries: [
      { id: 'same', q: 'first' },
      { id: ' same ', q: 'second', max_results: 0, order: 'newest', safe_search: 'unsafe' },
      { id: ' ', q: ' ' },
    ],
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => /defaults\.max_results/.test(error)));
  assert.ok(result.errors.some((error) => /defaults\.order/.test(error)));
  assert.ok(result.errors.some((error) => /defaults\.safe_search/.test(error)));
  assert.ok(result.errors.some((error) => /Duplicate query id "same"/.test(error)));
  assert.ok(result.errors.some((error) => /max_results must be an integer between 1 and 50/.test(error)));
  assert.ok(result.errors.some((error) => /order must be one of/.test(error)));
  assert.ok(result.errors.some((error) => /safe_search must be one of/.test(error)));
  assert.ok(result.errors.some((error) => /non-empty string "id"/.test(error)));
  assert.ok(result.errors.some((error) => /non-empty query string "q"/.test(error)));
  assert.equal(result.parsed, undefined);
});
