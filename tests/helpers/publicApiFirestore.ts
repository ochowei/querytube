import type { Firestore } from 'firebase-admin/firestore';
import { FirestoreService } from '../../server/firestoreService.ts';
import { runFixture } from './publicApiFixture.ts';

// Fake only Admin SDK reads; the real service still loads, filters, sorts, and maps.
export function fakePublicStore(uid: string) {
  const records = new Map<string, Record<string, any>>();
  const reads: string[] = [];
  let unavailable = false;
  const user = `users/${uid}`;
  const time = { toDate: () => new Date(runFixture.createdAt) };

  const document = (path: string): any => ({
    collection: (name: string) => collection(`${path}/${name}`),
    get: async () => {
      reads.push(path);
      if (unavailable) throw new Error('Storage unavailable');
      return snapshot(path);
    },
  });
  const snapshot = (path: string) => ({
    id: path.split('/').at(-1), exists: records.has(path),
    data: () => records.get(path), createTime: time, updateTime: time,
    ref: document(path),
  });
  const collection = (path: string): any => ({
    doc: (id: string) => document(`${path}/${id}`),
    get: async () => {
      reads.push(path);
      if (unavailable) throw new Error('Storage unavailable');
      const docs = [...records.keys()].filter((key) => key.startsWith(`${path}/`) && !key.slice(path.length + 1).includes('/'));
      return { docs: docs.map(snapshot) };
    },
  });

  function addRun(id: string, overrides: Record<string, any> = {}) {
    const { queryResults, outputYaml, ...run } = structuredClone(runFixture);
    records.set(`${user}/searchRuns/${id}`, { ...run, ...overrides });
  }
  addRun(runFixture.id, { querySetId: 'deleted-set' });
  for (const { videos, ...query } of runFixture.queryResults) {
    const queryPath = `${user}/searchRuns/${runFixture.id}/queryResults/${query.id}`;
    records.set(queryPath, query);
    for (const video of videos ?? []) records.set(`${queryPath}/videos/${video.videoId}`, video);
  }
  records.set(`${user}/querySets/public-set`, {
    id: 'public-set', name: 'Shared set', rawYaml: 'queries: []', queryCount: 1,
    publicApiEnabled: true, createdAt: runFixture.createdAt, updatedAt: runFixture.createdAt,
  });
  records.set(`${user}/querySets/private-set`, {
    name: 'Private set', publicApiEnabled: false,
  });
  return {
    service: new FirestoreService('contract-test', '(default)', { collection } as unknown as Firestore),
    records, reads, user, addRun,
    setUnavailable: () => { unavailable = true; },
  };
}
