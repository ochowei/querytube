import assert from 'node:assert/strict';
import test from 'node:test';
import { toPublicSearchRun, toPublicSearchRunSummary } from '../server/publicApiMapper.ts';
import { runFixture } from './helpers/publicApiFixture.ts';

test('public projections select fields at every level, independent of internal additions', () => {
  const internal = structuredClone(runFixture);
  Object.assign(internal, { ownerUid: 'private-owner', internalRunField: true });
  Object.assign(internal.queryResults[0], { internalQueryField: true });
  Object.assign(internal.queryResults[0].videos![0], { internalVideoField: true });
  const detail = toPublicSearchRun(internal);
  const summary = toPublicSearchRunSummary(internal);
  assert.equal(detail.id, internal.id);
  assert.equal(detail.queryResults[0].videos[0].videoId, 'dQw4w9WgXcQ');
  assert.equal(detail.queryResults[0].videos[0].title, 'Video title');
  for (const value of [detail, summary]) {
    assert.equal('ownerUid' in value, false);
    assert.equal('internalRunField' in value, false);
    assert.equal('outputYaml' in value, false);
    assert.equal(value.visibility, 'public');
  }
  assert.equal('inputYaml' in summary, false);
  assert.equal('queryResults' in summary, false);
  assert.equal('internalQueryField' in detail.queryResults[0], false);
  assert.equal('internalVideoField' in detail.queryResults[0].videos[0], false);
  assert.notEqual(detail.queryResults[0].videos[0], internal.queryResults[0].videos![0]);
});

test('public projections preserve nullable metadata and required empty video arrays', () => {
  const internal = structuredClone(runFixture);
  delete internal.queryResults[0].videos;
  const detail = toPublicSearchRun(internal);
  assert.equal(detail.querySetId, null);
  assert.equal(detail.querySetName, null);
  assert.equal(detail.completedAt, null);
  assert.equal(detail.queryResults[0].errorCode, null);
  assert.equal(detail.queryResults[0].relevanceLanguage, null);
  assert.deepEqual(detail.queryResults[0].videos, []);
});

test('statistics projection selects only documented fields and omits absent legacy snapshots', () => {
  const internal = structuredClone(runFixture);
  const video = internal.queryResults[0].videos![0];
  assert.equal('statistics' in toPublicSearchRun(internal).queryResults[0].videos[0], false);
  video.statistics = {
    viewCount: '18446744073709551615', likeCount: '0', commentCount: null,
    fetchedAt: '2026-10-06T02:00:00.000Z',
  };
  Object.assign(video.statistics, { internalSource: 'private', apiKey: 'secret' });
  const snapshot = toPublicSearchRun(internal).queryResults[0].videos[0].statistics!;
  assert.deepEqual(snapshot, {
    viewCount: '18446744073709551615', likeCount: '0', commentCount: null,
    fetchedAt: '2026-10-06T02:00:00.000Z',
  });
  assert.notEqual(snapshot, video.statistics);
  snapshot.viewCount = '1';
  assert.equal(video.statistics.viewCount, '18446744073709551615');
  assert.equal('statistics' in toPublicSearchRunSummary(internal), false);
});
