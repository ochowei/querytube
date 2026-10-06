import { dump } from 'js-yaml';
import type { Firestore } from 'firebase-admin/firestore';
import {
  QuerySet,
  SearchRun,
  SearchRunDetails,
  QueryResultItem,
  StoredVideoItem,
  ResourceVisibility,
} from '../src/types/index.js';
import type { PublicQuerySetSummary, PublicQuerySet, PublicSearchRunSummary, PublicSearchRun } from '../src/types/publicApi.js';
import { toPublicSearchRunSummary, toPublicSearchRun } from './publicApiMapper.js';

interface FirestoreFieldString {
  stringValue: string;
}
interface FirestoreFieldNumber {
  integerValue?: string;
  doubleValue?: number;
}
interface FirestoreFieldNull {
  nullValue: null;
}
type FirestoreValue =
  | FirestoreFieldString
  | FirestoreFieldNumber
  | FirestoreFieldNull
  | { booleanValue: boolean }
  | { mapValue: { fields: Record<string, FirestoreValue> } }
  | { arrayValue: { values?: FirestoreValue[] } };

function toFirestoreFields(obj: Record<string, any>): Record<string, FirestoreValue> {
  const fields: Record<string, FirestoreValue> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      fields[key] = { nullValue: null };
    } else if (typeof value === 'string') {
      fields[key] = { stringValue: value };
    } else if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        fields[key] = { integerValue: String(value) };
      } else {
        fields[key] = { doubleValue: value };
      }
    } else if (typeof value === 'boolean') {
      fields[key] = { booleanValue: value };
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      fields[key] = { mapValue: { fields: toFirestoreFields(value) } };
    }
  }
  return fields;
}

function fromFirestoreFields(fields: Record<string, FirestoreValue> | undefined): Record<string, any> {
  const result: Record<string, any> = {};
  if (!fields) return result;

  for (const [key, val] of Object.entries(fields)) {
    if ('stringValue' in val) {
      result[key] = val.stringValue;
    } else if ('integerValue' in val) {
      result[key] = Number(val.integerValue);
    } else if ('doubleValue' in val) {
      result[key] = Number(val.doubleValue);
    } else if ('booleanValue' in val) {
      result[key] = val.booleanValue;
    } else if ('nullValue' in val) {
      result[key] = null;
    } else if ('mapValue' in val) {
      result[key] = fromFirestoreFields(val.mapValue.fields);
    }
  }
  return result;
}

// In-memory active stores for instantaneous performance & resilient fallback
const inMemoryQuerySets = new Map<string, Map<string, QuerySet>>();
const inMemorySearchRuns = new Map<string, Map<string, SearchRun>>();
const inMemoryRunDetails = new Map<string, Map<string, SearchRunDetails>>();

function getOrCreateUserMap<T>(store: Map<string, Map<string, T>>, uid: string): Map<string, T> {
  let userMap = store.get(uid);
  if (!userMap) {
    userMap = new Map<string, T>();
    store.set(uid, userMap);
  }
  return userMap;
}

export class FirestoreReadError extends Error {
  readonly statusCode = 503;

  constructor(readonly resource: 'QuerySets' | 'SearchRuns') {
    super(`Firestore ${resource} read failed.`);
    this.name = 'FirestoreReadError';
  }
}

export class FirestoreWriteError extends Error {
  readonly statusCode = 503;

  constructor(readonly resource: 'QuerySets' | 'SearchRuns') {
    super(`Firestore ${resource} write failed.`);
    this.name = 'FirestoreWriteError';
  }
}

function firestoreFailureStatus(error: unknown): string {
  if (typeof error !== 'object' || error === null) return 'network';
  if ('status' in error && typeof error.status === 'number') return String(error.status);
  if ('code' in error && typeof error.code === 'string') return error.code;
  return 'network';
}

export class FirestoreService {
  constructor(
    private projectId: string,
    private databaseId: string,
    private adminDb?: Firestore
  ) {}

  private get baseUrl(): string {
    return `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/${this.databaseId}/documents`;
  }

  // --- QUERY SETS ---

  async listQuerySets(idToken: string, uid: string): Promise<QuerySet[]> {
    const userMemory = getOrCreateUserMap(inMemoryQuerySets, uid);
    console.info(`[QuerySets] Loading for uid=${uid.slice(0, 6)}`);

    try {
      let items: QuerySet[];

      if (this.adminDb) {
        const snapshot = await this.adminDb
          .collection('users')
          .doc(uid)
          .collection('querySets')
          .get();

        items = snapshot.docs.map((doc) => {
          const raw = doc.data();
          return {
            id: doc.id,
            name: raw.name || 'Untitled Query Set',
            rawYaml: raw.rawYaml || '',
            queryCount: Number(raw.queryCount || 0),
            publicApiEnabled: Boolean(raw.publicApiEnabled),
            createdAt: raw.createdAt || doc.createTime.toDate().toISOString(),
            updatedAt: raw.updatedAt || doc.updateTime.toDate().toISOString(),
          };
        });
      } else {
        const docs: any[] = [];
        let pageToken: string | undefined;
        do {
          const url = new URL(`${this.baseUrl}/users/${uid}/querySets`);
          url.searchParams.set('pageSize', '100');
          if (pageToken) url.searchParams.set('pageToken', pageToken);
          const res = await fetch(url, {
            method: 'GET',
            headers: { Authorization: `Bearer ${idToken}` },
          });

          if (!res.ok) throw Object.assign(new Error('Firestore request failed'), { status: res.status });
          const data = (await res.json()) as any;
          if (Array.isArray(data.documents)) docs.push(...data.documents);
          pageToken = typeof data.nextPageToken === 'string' ? data.nextPageToken : undefined;
        } while (pageToken);

        items = docs.map((doc) => {
          const id = doc.name.split('/').pop() || '';
          const raw = fromFirestoreFields(doc.fields);
          return {
            id,
            name: raw.name || 'Untitled Query Set',
            rawYaml: raw.rawYaml || '',
            queryCount: Number(raw.queryCount || 0),
            publicApiEnabled: Boolean(raw.publicApiEnabled),
            createdAt: raw.createdAt || doc.createTime,
            updatedAt: raw.updatedAt || doc.updateTime,
          };
        });
      }

      userMemory.clear();
      for (const item of items) userMemory.set(item.id, item);
      console.info(`[QuerySets] Firestore read succeeded, count=${items.length}`);
      return items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    } catch (error) {
      const status = firestoreFailureStatus(error);
      console.warn(`[QuerySets] Firestore read failed, status=${status}`);
      throw new FirestoreReadError('QuerySets');
    }
  }

  async getQuerySet(idToken: string, uid: string, querySetId: string): Promise<QuerySet | null> {
    const userMemory = getOrCreateUserMap(inMemoryQuerySets, uid);
    if (userMemory.has(querySetId)) {
      return userMemory.get(querySetId)!;
    }

    try {
      const url = `${this.baseUrl}/users/${uid}/querySets/${encodeURIComponent(querySetId)}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (res.ok) {
        const doc = (await res.json()) as any;
        const raw = fromFirestoreFields(doc.fields);
        const item: QuerySet = {
          id: querySetId,
          name: raw.name || 'Untitled Query Set',
          rawYaml: raw.rawYaml || '',
          queryCount: Number(raw.queryCount || 0),
          publicApiEnabled: Boolean(raw.publicApiEnabled),
          createdAt: raw.createdAt || doc.createTime,
          updatedAt: raw.updatedAt || doc.updateTime,
        };
        userMemory.set(querySetId, item);
        return item;
      }
    } catch {
      // fallback
    }

    return null;
  }

  async createQuerySet(
    idToken: string,
    uid: string,
    name: string,
    rawYaml: string,
    queryCount: number,
    publicApiEnabled = false
  ): Promise<QuerySet> {
    const now = new Date().toISOString();
    const querySetId = `qs_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const payload: QuerySet = {
      id: querySetId,
      name: name.trim() || 'Untitled Query Set',
      rawYaml,
      queryCount,
      publicApiEnabled: Boolean(publicApiEnabled),
      createdAt: now,
      updatedAt: now,
    };

    // Persist to Firestore
    try {
      const url = `${this.baseUrl}/users/${uid}/querySets?documentId=${querySetId}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          fields: toFirestoreFields({
            name: payload.name,
            rawYaml: payload.rawYaml,
            queryCount: payload.queryCount,
            publicApiEnabled: payload.publicApiEnabled,
            createdAt: payload.createdAt,
            updatedAt: payload.updatedAt,
          }),
        }),
      });
      if (!res.ok) throw Object.assign(new Error('Firestore request failed'), { status: res.status });

      const userMemory = getOrCreateUserMap(inMemoryQuerySets, uid);
      userMemory.set(querySetId, payload);
      return payload;
    } catch (error) {
      console.warn(`[QuerySets] Firestore write failed, status=${firestoreFailureStatus(error)}`);
      throw new FirestoreWriteError('QuerySets');
    }
  }

  async updateQuerySet(
    idToken: string,
    uid: string,
    querySetId: string,
    updates: { name?: string; rawYaml?: string; queryCount?: number; publicApiEnabled?: boolean }
  ): Promise<QuerySet> {
    const existing = await this.getQuerySet(idToken, uid, querySetId);
    const now = new Date().toISOString();
    const updated: QuerySet = {
      id: querySetId,
      name: updates.name ?? existing?.name ?? 'Untitled Query Set',
      rawYaml: updates.rawYaml ?? existing?.rawYaml ?? '',
      queryCount: updates.queryCount ?? existing?.queryCount ?? 0,
      publicApiEnabled: updates.publicApiEnabled !== undefined
        ? Boolean(updates.publicApiEnabled)
        : (existing?.publicApiEnabled ?? false),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    try {
      const url = `${this.baseUrl}/users/${uid}/querySets/${encodeURIComponent(querySetId)}`;
      const res = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          fields: toFirestoreFields({
            name: updated.name,
            rawYaml: updated.rawYaml,
            queryCount: updated.queryCount,
            publicApiEnabled: updated.publicApiEnabled,
            createdAt: updated.createdAt,
            updatedAt: updated.updatedAt,
          }),
        }),
      });
      if (!res.ok) throw Object.assign(new Error('Firestore request failed'), { status: res.status });

      const userMemory = getOrCreateUserMap(inMemoryQuerySets, uid);
      userMemory.set(querySetId, updated);
      return updated;
    } catch (error) {
      console.warn(`[QuerySets] Firestore write failed, status=${firestoreFailureStatus(error)}`);
      throw new FirestoreWriteError('QuerySets');
    }
  }

  // --- REUSABLE FIRESTORE SEARCH RUN DETAILS LOADER ---

  async loadSearchRunDetailsFromFirestore(uid: string, runId: string): Promise<SearchRunDetails | null> {
    if (!this.adminDb) throw new FirestoreReadError('SearchRuns');

    try {
      const runDocRef = this.adminDb.collection('users').doc(uid).collection('searchRuns').doc(runId);
      const runSnap = await runDocRef.get();
      if (!runSnap.exists) {
        return null;
      }

      const rawRun = runSnap.data()!;
      const visibility: ResourceVisibility = rawRun.visibility === 'public' ? 'public' : 'private';
      const run: SearchRun = {
        id: runId,
        querySetId: rawRun.querySetId || null,
        querySetName: rawRun.querySetName || null,
        status: rawRun.status || 'completed',
        queryCount: Number(rawRun.queryCount || 0),
        successfulQueries: Number(rawRun.successfulQueries || 0),
        failedQueries: Number(rawRun.failedQueries || 0),
        totalResults: Number(rawRun.totalResults || 0),
        inputYaml: rawRun.inputYaml || '',
        startedAt: rawRun.startedAt || (runSnap.createTime ? runSnap.createTime.toDate().toISOString() : new Date().toISOString()),
        completedAt: rawRun.completedAt || null,
        createdAt: rawRun.createdAt || (runSnap.createTime ? runSnap.createTime.toDate().toISOString() : new Date().toISOString()),
        visibility,
      };

      const qSnap = await runDocRef.collection('queryResults').get();
      const queryResults: QueryResultItem[] = [];

      for (const qDoc of qSnap.docs) {
        const rawQ = qDoc.data();
        const vSnap = await qDoc.ref.collection('videos').get();
        const videos: StoredVideoItem[] = vSnap.docs.map((vDoc) => {
          const rawV = vDoc.data();
          return {
            videoId: rawV.videoId || vDoc.id,
            title: rawV.title || '',
            channelId: rawV.channelId || '',
            channelTitle: rawV.channelTitle || '',
            publishedAt: rawV.publishedAt || '',
            description: rawV.description || '',
            url: rawV.url || `https://www.youtube.com/watch?v=${rawV.videoId || vDoc.id}`,
            thumbnailUrl: rawV.thumbnailUrl || '',
            ...(rawV.statistics ? { statistics: rawV.statistics } : {}),
          };
        });

        queryResults.push({
          id: qDoc.id,
          sourceQueryId: rawQ.sourceQueryId || qDoc.id,
          query: rawQ.query || '',
          relevanceLanguage: rawQ.relevanceLanguage || null,
          regionCode: rawQ.regionCode || null,
          status: rawQ.status || 'success',
          resultCount: Number(rawQ.resultCount || videos.length),
          errorCode: rawQ.errorCode || null,
          errorMessage: rawQ.errorMessage || null,
          startedAt: rawQ.startedAt || '',
          completedAt: rawQ.completedAt || '',
          videos,
        });
      }

      const successful = queryResults.filter((q) => q.status === 'success');
      const failed = queryResults.filter((q) => q.status === 'failed');

      const outputObj = {
        generated_at: run.completedAt || run.startedAt,
        summary: {
          queries: run.queryCount,
          successful: successful.length,
          failed: failed.length,
          total_results: run.totalResults,
        },
        results: successful.map((q) => ({
          id: q.sourceQueryId,
          query: q.query,
          relevance_language: q.relevanceLanguage || undefined,
          region_code: q.regionCode || undefined,
          count: q.resultCount,
          videos: (q.videos || []).map((v) => ({
            video_id: v.videoId,
            title: v.title,
            channel_id: v.channelId,
            channel_title: v.channelTitle,
            published_at: v.publishedAt,
            description: v.description,
            url: v.url,
            thumbnail_url: v.thumbnailUrl,
            ...(v.statistics ? { statistics: v.statistics } : {}),
          })),
        })),
        errors: failed.map((f) => ({
          id: f.sourceQueryId,
          query: f.query,
          error: f.errorMessage || f.errorCode || 'Query failed',
        })),
      };

      const outputYaml = dump(outputObj, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
        forceQuotes: false,
      });

      return {
        ...run,
        queryResults,
        outputYaml,
      };
    } catch (error) {
      console.warn(`[SearchRuns] Firestore detail read failed, status=${firestoreFailureStatus(error)}`);
      throw new FirestoreReadError('SearchRuns');
    }
  }

  // --- PUBLIC READ METHODS (Server-Side, Authoritative from Firestore, No ID Token Required) ---

  async getPublicQuerySets(uid: string): Promise<PublicQuerySetSummary[]> {
    const userMemory = getOrCreateUserMap(inMemoryQuerySets, uid);
    if (!this.adminDb) throw new FirestoreReadError('QuerySets');

    let snapshot;
    try {
      snapshot = await this.adminDb.collection('users').doc(uid).collection('querySets').get();
    } catch (error) {
      console.warn(`[QuerySets] Firestore public read failed, status=${firestoreFailureStatus(error)}`);
      throw new FirestoreReadError('QuerySets');
    }

    const items = snapshot.docs.map((doc) => {
      const raw = doc.data();
      return {
        id: doc.id,
        name: raw.name || 'Untitled Query Set',
        rawYaml: raw.rawYaml || '',
        queryCount: Number(raw.queryCount || 0),
        publicApiEnabled: Boolean(raw.publicApiEnabled),
        createdAt: raw.createdAt || doc.createTime.toDate().toISOString(),
        updatedAt: raw.updatedAt || doc.updateTime.toDate().toISOString(),
      } satisfies QuerySet;
    });
    userMemory.clear();
    for (const item of items) userMemory.set(item.id, item);

    // Filter strictly by publicApiEnabled === true using this Firestore snapshot.
    const publicItems = items.filter((qs) => qs.publicApiEnabled === true);
    return publicItems
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .map((qs) => ({
        id: qs.id,
        name: qs.name,
        queryCount: qs.queryCount,
        createdAt: qs.createdAt,
        updatedAt: qs.updatedAt,
      }));
  }

  async getPublicQuerySet(uid: string, querySetId: string): Promise<PublicQuerySet | null> {
    const userMemory = getOrCreateUserMap(inMemoryQuerySets, uid);
    if (!this.adminDb) throw new FirestoreReadError('QuerySets');

    let docSnap;
    try {
      docSnap = await this.adminDb.collection('users').doc(uid).collection('querySets').doc(querySetId).get();
    } catch (error) {
      console.warn(`[QuerySets] Firestore public read failed, status=${firestoreFailureStatus(error)}`);
      throw new FirestoreReadError('QuerySets');
    }

    if (!docSnap.exists) {
      userMemory.delete(querySetId);
      return null;
    }

    const raw = docSnap.data()!;
    const qs: QuerySet = {
      id: querySetId,
      name: raw.name || 'Untitled Query Set',
      rawYaml: raw.rawYaml || '',
      queryCount: Number(raw.queryCount || 0),
      publicApiEnabled: Boolean(raw.publicApiEnabled),
      createdAt: raw.createdAt || docSnap.createTime?.toDate().toISOString() || new Date().toISOString(),
      updatedAt: raw.updatedAt || docSnap.updateTime?.toDate().toISOString() || new Date().toISOString(),
    };
    userMemory.set(querySetId, qs);
    if (!qs || qs.publicApiEnabled !== true) {
      return null;
    }

    return {
      id: qs.id,
      name: qs.name,
      rawYaml: qs.rawYaml,
      queryCount: qs.queryCount,
      createdAt: qs.createdAt,
      updatedAt: qs.updatedAt,
    };
  }

  async getPublicSearchRuns(uid: string, querySetId?: string | null, limitCount = 50): Promise<PublicSearchRunSummary[]> {
    const userRuns = getOrCreateUserMap(inMemorySearchRuns, uid);
    if (!this.adminDb) throw new FirestoreReadError('SearchRuns');

    let snapshot;
    try {
      snapshot = await this.adminDb.collection('users').doc(uid).collection('searchRuns').get();
    } catch (error) {
      console.warn(`[SearchRuns] Firestore public read failed, status=${firestoreFailureStatus(error)}`);
      throw new FirestoreReadError('SearchRuns');
    }

    const runs: SearchRun[] = snapshot.docs.map((doc) => {
      const raw = doc.data();
      const visibility: ResourceVisibility = raw.visibility === 'public' ? 'public' : 'private';
      return {
        id: doc.id,
        querySetId: raw.querySetId || null,
        querySetName: raw.querySetName || null,
        status: raw.status || 'completed',
        queryCount: Number(raw.queryCount || 0),
        successfulQueries: Number(raw.successfulQueries || 0),
        failedQueries: Number(raw.failedQueries || 0),
        totalResults: Number(raw.totalResults || 0),
        inputYaml: raw.inputYaml || '',
        startedAt: raw.startedAt || doc.createTime.toDate().toISOString(),
        completedAt: raw.completedAt || null,
        createdAt: raw.createdAt || doc.createTime.toDate().toISOString(),
        visibility,
      };
    });
    userRuns.clear();
    for (const run of runs) userRuns.set(run.id, run);

    // Filter strictly by Search Run's OWN visibility === 'public'.
    // Independent from Query Set publication
    let matchedRuns = runs.filter((run) => run.visibility === 'public');

    // Optional filter by querySetId if provided
    if (querySetId) {
      matchedRuns = matchedRuns.filter((run) => run.querySetId === querySetId);
    }

    const sorted = matchedRuns.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    const cappedLimit = Math.max(1, Math.min(100, limitCount));

    return sorted.slice(0, cappedLimit).map(toPublicSearchRunSummary);
  }

  async getPublicSearchRunDetails(uid: string, runId: string): Promise<PublicSearchRun | null> {
    const userDetails = getOrCreateUserMap(inMemoryRunDetails, uid);
    const details = await this.loadSearchRunDetailsFromFirestore(uid, runId);
    if (details) userDetails.set(runId, details);
    else userDetails.delete(runId);

    // Search Run must exist and have visibility === 'public'.
    // Do NOT require Query Set to exist or be public!
    if (!details || details.visibility !== 'public') {
      return null;
    }

    return toPublicSearchRun(details);
  }

  async deleteQuerySet(idToken: string, uid: string, querySetId: string): Promise<void> {
    try {
      const url = `${this.baseUrl}/users/${uid}/querySets/${encodeURIComponent(querySetId)}`;
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok && res.status !== 404) {
        throw Object.assign(new Error('Firestore request failed'), { status: res.status });
      }

      getOrCreateUserMap(inMemoryQuerySets, uid).delete(querySetId);
    } catch (error) {
      console.warn(`[QuerySets] Firestore write failed, status=${firestoreFailureStatus(error)}`);
      throw new FirestoreWriteError('QuerySets');
    }
  }

  // --- SEARCH RUNS ---

  async createSearchRun(
    idToken: string,
    uid: string,
    data: {
      querySetId?: string | null;
      querySetName?: string | null;
      queryCount: number;
      inputYaml: string;
      visibility?: ResourceVisibility;
    }
  ): Promise<string> {
    const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const visibility: ResourceVisibility = data.visibility === 'public' ? 'public' : 'private';

    const payload: SearchRun = {
      id: runId,
      querySetId: data.querySetId || null,
      querySetName: data.querySetName || null,
      status: 'running',
      queryCount: data.queryCount,
      successfulQueries: 0,
      failedQueries: 0,
      totalResults: 0,
      inputYaml: data.inputYaml,
      startedAt: now,
      completedAt: null,
      createdAt: now,
      visibility,
    };

    try {
      const url = `${this.baseUrl}/users/${uid}/searchRuns/${encodeURIComponent(runId)}`;
      const res = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ fields: toFirestoreFields(payload) }),
      });
      if (!res.ok) {
        throw Object.assign(new Error('Firestore request failed'), { status: res.status });
      }
    } catch (error) {
      console.warn(`[SearchRuns] Firestore write failed, status=${firestoreFailureStatus(error)}`);
      throw new FirestoreWriteError('SearchRuns');
    }

    const userRuns = getOrCreateUserMap(inMemorySearchRuns, uid);
    userRuns.set(runId, payload);
    const userDetails = getOrCreateUserMap(inMemoryRunDetails, uid);
    userDetails.set(runId, { ...payload, queryResults: [], outputYaml: '' });
    return runId;
  }

  async updateSearchRunVisibility(
    idToken: string,
    uid: string,
    runId: string,
    visibility: ResourceVisibility
  ): Promise<SearchRun> {
    const userRuns = getOrCreateUserMap(inMemorySearchRuns, uid);
    const existing = userRuns.get(runId);
    if (existing) {
      existing.visibility = visibility;
    }

    const userDetails = getOrCreateUserMap(inMemoryRunDetails, uid);
    const existingDetails = userDetails.get(runId);
    if (existingDetails) {
      existingDetails.visibility = visibility;
    }

    try {
      const url = `${this.baseUrl}/users/${uid}/searchRuns/${encodeURIComponent(runId)}?updateMask.fieldPaths=visibility`;
      await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          fields: {
            visibility: { stringValue: visibility },
          },
        }),
      });
    } catch (e) {
      console.warn('[Firestore] updateSearchRunVisibility notice:', e);
    }

    if (existing) {
      return existing;
    }

    const loaded = await this.getSearchRunDetails(idToken, uid, runId);
    if (loaded) {
      loaded.visibility = visibility;
      return loaded;
    }

    return {
      id: runId,
      status: 'completed',
      queryCount: 0,
      successfulQueries: 0,
      failedQueries: 0,
      totalResults: 0,
      inputYaml: '',
      startedAt: new Date().toISOString(),
      completedAt: null,
      createdAt: new Date().toISOString(),
      visibility,
    };
  }

  async updateSearchRunSummary(
    idToken: string,
    uid: string,
    runId: string,
    summary: {
      status: 'completed' | 'partial' | 'failed';
      successfulQueries: number;
      failedQueries: number;
      totalResults: number;
      completedAt: string;
    }
  ): Promise<void> {
    const userRuns = getOrCreateUserMap(inMemorySearchRuns, uid);
    const existing = userRuns.get(runId);
    if (existing) {
      Object.assign(existing, summary);
    }

    const userDetails = getOrCreateUserMap(inMemoryRunDetails, uid);
    const existingDetails = userDetails.get(runId);
    if (existingDetails) {
      Object.assign(existingDetails, summary);
    }

    try {
      const url = `${this.baseUrl}/users/${uid}/searchRuns/${encodeURIComponent(runId)}?updateMask.fieldPaths=status&updateMask.fieldPaths=successfulQueries&updateMask.fieldPaths=failedQueries&updateMask.fieldPaths=totalResults&updateMask.fieldPaths=completedAt`;
      await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ fields: toFirestoreFields(summary) }),
      });
    } catch (e) {
      console.warn('[Firestore] updateSearchRunSummary notice:', e);
    }
  }

  async saveQueryResultAndVideos(
    idToken: string,
    uid: string,
    runId: string,
    resultItem: {
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
      videos: StoredVideoItem[];
    }
  ): Promise<void> {
    const safeResultId = encodeURIComponent(resultItem.sourceQueryId || `q_${Date.now()}`);

    // Update memory details
    const userDetails = getOrCreateUserMap(inMemoryRunDetails, uid);
    const runDetail = userDetails.get(runId);
    if (runDetail) {
      const existingIdx = runDetail.queryResults.findIndex((r) => r.sourceQueryId === resultItem.sourceQueryId);
      const queryResultItem: QueryResultItem = {
        id: safeResultId,
        sourceQueryId: resultItem.sourceQueryId,
        query: resultItem.query,
        relevanceLanguage: resultItem.relevanceLanguage || null,
        regionCode: resultItem.regionCode || null,
        status: resultItem.status,
        resultCount: resultItem.resultCount,
        errorCode: resultItem.errorCode || null,
        errorMessage: resultItem.errorMessage || null,
        startedAt: resultItem.startedAt,
        completedAt: resultItem.completedAt,
        videos: resultItem.videos,
      };

      if (existingIdx >= 0) {
        runDetail.queryResults[existingIdx] = queryResultItem;
      } else {
        runDetail.queryResults.push(queryResultItem);
      }

      // Reconstruct YAML in memory
      const successful = runDetail.queryResults.filter((q) => q.status === 'success');
      const failed = runDetail.queryResults.filter((q) => q.status === 'failed');
      const outputObj = {
        generated_at: runDetail.completedAt || runDetail.startedAt,
        summary: {
          queries: runDetail.queryCount,
          successful: successful.length,
          failed: failed.length,
          total_results: runDetail.totalResults,
        },
        results: successful.map((q) => ({
          id: q.sourceQueryId,
          query: q.query,
          relevance_language: q.relevanceLanguage || undefined,
          region_code: q.regionCode || undefined,
          count: q.resultCount,
          videos: (q.videos || []).map((v) => ({
            video_id: v.videoId,
            title: v.title,
            channel_id: v.channelId,
            channel_title: v.channelTitle,
            published_at: v.publishedAt,
            description: v.description,
            url: v.url,
            thumbnail_url: v.thumbnailUrl,
            ...(v.statistics ? { statistics: v.statistics } : {}),
          })),
        })),
        errors: failed.map((f) => ({
          id: f.sourceQueryId,
          query: f.query,
          error: f.errorMessage || f.errorCode || 'Query failed',
        })),
      };

      runDetail.outputYaml = dump(outputObj, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
        forceQuotes: false,
      });
    }

    // 1. Save queryResult document to Firestore via PATCH
    try {
      const queryResultDocUrl = `${this.baseUrl}/users/${uid}/searchRuns/${encodeURIComponent(runId)}/queryResults/${safeResultId}`;
      const queryResultPayload = {
        sourceQueryId: resultItem.sourceQueryId,
        query: resultItem.query,
        relevanceLanguage: resultItem.relevanceLanguage || null,
        regionCode: resultItem.regionCode || null,
        status: resultItem.status,
        resultCount: resultItem.resultCount,
        errorCode: resultItem.errorCode || null,
        errorMessage: resultItem.errorMessage || null,
        startedAt: resultItem.startedAt,
        completedAt: resultItem.completedAt,
      };

      const qRes = await fetch(queryResultDocUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ fields: toFirestoreFields(queryResultPayload) }),
      });

      if (!qRes.ok) {
        console.warn(`[Firestore] saveQueryResult error (${safeResultId}):`, qRes.status, await qRes.text());
      } else {
        console.log(`[Firestore] Saved queryResult ${safeResultId} for run ${runId}`);
      }

      // 2. Save videos to Firestore subcollection via PATCH
      if (resultItem.videos && resultItem.videos.length > 0) {
        for (const video of resultItem.videos) {
          const safeVideoId = encodeURIComponent(video.videoId || `vid_${Math.random().toString(36).substring(2)}`);
          const videoDocUrl = `${this.baseUrl}/users/${uid}/searchRuns/${encodeURIComponent(runId)}/queryResults/${safeResultId}/videos/${safeVideoId}`;

          const vRes = await fetch(videoDocUrl, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({ fields: toFirestoreFields(video) }),
          });

          if (!vRes.ok) {
            console.warn(`[Firestore] saveVideo error (${safeVideoId}):`, vRes.status, await vRes.text());
          }
        }
      }
    } catch (err) {
      console.warn('[Firestore] saveQueryResultAndVideos error:', err);
    }
  }

  async listSearchRuns(idToken: string, uid: string, limitCount = 50): Promise<SearchRun[]> {
    const userMemory = getOrCreateUserMap(inMemorySearchRuns, uid);
    const cappedLimit = Math.max(1, Math.min(100, Math.floor(Number.isFinite(limitCount) ? limitCount : 50)));
    console.info(`[SearchRuns] Loading for uid=${uid.slice(0, 6)}`);

    try {
      let runs: SearchRun[];

      if (this.adminDb) {
        const snapshot = await this.adminDb
          .collection('users')
          .doc(uid)
          .collection('searchRuns')
          .orderBy('startedAt', 'desc')
          .limit(cappedLimit)
          .get();

        runs = snapshot.docs.map((doc) => {
          const raw = doc.data();
          const visibility: ResourceVisibility = raw.visibility === 'public' ? 'public' : 'private';
          return {
            id: doc.id,
            querySetId: raw.querySetId || null,
            querySetName: raw.querySetName || null,
            status: raw.status || 'completed',
            queryCount: Number(raw.queryCount || 0),
            successfulQueries: Number(raw.successfulQueries || 0),
            failedQueries: Number(raw.failedQueries || 0),
            totalResults: Number(raw.totalResults || 0),
            inputYaml: raw.inputYaml || '',
            startedAt: raw.startedAt || doc.createTime.toDate().toISOString(),
            completedAt: raw.completedAt || null,
            createdAt: raw.createdAt || doc.createTime.toDate().toISOString(),
            visibility,
          };
        });
      } else {
        const url = `${this.baseUrl}/users/${uid}/searchRuns?pageSize=${cappedLimit}`;
        const res = await fetch(url, {
          method: 'GET',
          headers: { Authorization: `Bearer ${idToken}` },
        });

        if (!res.ok) throw Object.assign(new Error('Firestore request failed'), { status: res.status });
        const data = (await res.json()) as any;
        const docs = Array.isArray(data.documents) ? data.documents : [];
        runs = docs.map((doc: any) => {
          const id = doc.name.split('/').pop() || '';
          const raw = fromFirestoreFields(doc.fields);
          const visibility: ResourceVisibility = raw.visibility === 'public' ? 'public' : 'private';
          return {
            id,
            querySetId: raw.querySetId || null,
            querySetName: raw.querySetName || null,
            status: raw.status || 'completed',
            queryCount: Number(raw.queryCount || 0),
            successfulQueries: Number(raw.successfulQueries || 0),
            failedQueries: Number(raw.failedQueries || 0),
            totalResults: Number(raw.totalResults || 0),
            inputYaml: raw.inputYaml || '',
            startedAt: raw.startedAt || doc.createTime,
            completedAt: raw.completedAt || null,
            createdAt: raw.createdAt || doc.createTime,
            visibility,
          };
        });
      }

      userMemory.clear();
      for (const run of runs) userMemory.set(run.id, run);
      console.info(`[SearchRuns] Firestore read succeeded, count=${runs.length}`);
      return runs.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    } catch (error) {
      const status = firestoreFailureStatus(error);
      console.warn(`[SearchRuns] Firestore read failed, status=${status}`);
      throw new FirestoreReadError('SearchRuns');
    }
  }

  async getSearchRunDetails(idToken: string, uid: string, runId: string): Promise<SearchRunDetails | null> {
    const userDetails = getOrCreateUserMap(inMemoryRunDetails, uid);
    const cached = userDetails.get(runId);
    if (cached && cached.queryResults && cached.queryResults.length > 0) {
      return cached;
    }

    try {
      // 1. Fetch search run document
      const runUrl = `${this.baseUrl}/users/${uid}/searchRuns/${encodeURIComponent(runId)}`;
      const runRes = await fetch(runUrl, {
        method: 'GET',
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (!runRes.ok) {
        return cached || null;
      }

      const runDoc = (await runRes.json()) as any;
      const rawRun = fromFirestoreFields(runDoc.fields);
      const visibility: ResourceVisibility = rawRun.visibility === 'public' ? 'public' : 'private';

      const run: SearchRun = {
        id: runId,
        querySetId: rawRun.querySetId || null,
        querySetName: rawRun.querySetName || null,
        status: rawRun.status || 'completed',
        queryCount: Number(rawRun.queryCount || 0),
        successfulQueries: Number(rawRun.successfulQueries || 0),
        failedQueries: Number(rawRun.failedQueries || 0),
        totalResults: Number(rawRun.totalResults || 0),
        inputYaml: rawRun.inputYaml || '',
        startedAt: rawRun.startedAt || runDoc.createTime,
        completedAt: rawRun.completedAt || null,
        createdAt: rawRun.createdAt || runDoc.createTime,
        visibility,
      };

      // 2. Fetch all queryResults subcollection
      const qUrl = `${this.baseUrl}/users/${uid}/searchRuns/${encodeURIComponent(runId)}/queryResults?pageSize=100`;
      const qRes = await fetch(qUrl, {
        method: 'GET',
        headers: { Authorization: `Bearer ${idToken}` },
      });

      const qDocs = qRes.ok ? ((await qRes.json()) as any).documents || [] : [];
      const queryResults: QueryResultItem[] = [];

      // 3. For each query result, fetch videos
      for (const qDoc of qDocs) {
        const qId = qDoc.name.split('/').pop() || '';
        const rawQ = fromFirestoreFields(qDoc.fields);

        const vUrl = `${this.baseUrl}/users/${uid}/searchRuns/${encodeURIComponent(runId)}/queryResults/${encodeURIComponent(qId)}/videos?pageSize=100`;
        const vRes = await fetch(vUrl, {
          method: 'GET',
          headers: { Authorization: `Bearer ${idToken}` },
        });

        const vDocs = vRes.ok ? ((await vRes.json()) as any).documents || [] : [];
        const videos: StoredVideoItem[] = vDocs.map((vDoc: any) => {
          const vId = vDoc.name.split('/').pop() || '';
          const rawV = fromFirestoreFields(vDoc.fields);
          return {
            videoId: rawV.videoId || vId,
            title: rawV.title || '',
            channelId: rawV.channelId || '',
            channelTitle: rawV.channelTitle || '',
            publishedAt: rawV.publishedAt || '',
            description: rawV.description || '',
            url: rawV.url || `https://www.youtube.com/watch?v=${rawV.videoId || vId}`,
            thumbnailUrl: rawV.thumbnailUrl || '',
            ...(rawV.statistics ? { statistics: rawV.statistics } : {}),
          };
        });

        queryResults.push({
          id: qId,
          sourceQueryId: rawQ.sourceQueryId || qId,
          query: rawQ.query || '',
          relevanceLanguage: rawQ.relevanceLanguage || null,
          regionCode: rawQ.regionCode || null,
          status: rawQ.status || 'success',
          resultCount: Number(rawQ.resultCount || videos.length),
          errorCode: rawQ.errorCode || null,
          errorMessage: rawQ.errorMessage || null,
          startedAt: rawQ.startedAt || '',
          completedAt: rawQ.completedAt || '',
          videos,
        });
      }

      // 4. Reconstruct normalized YAML output
      const successful = queryResults.filter((q) => q.status === 'success');
      const failed = queryResults.filter((q) => q.status === 'failed');

      const outputObj = {
        generated_at: run.completedAt || run.startedAt,
        summary: {
          queries: run.queryCount,
          successful: successful.length,
          failed: failed.length,
          total_results: run.totalResults,
        },
        results: successful.map((q) => ({
          id: q.sourceQueryId,
          query: q.query,
          relevance_language: q.relevanceLanguage || undefined,
          region_code: q.regionCode || undefined,
          count: q.resultCount,
          videos: (q.videos || []).map((v) => ({
            video_id: v.videoId,
            title: v.title,
            channel_id: v.channelId,
            channel_title: v.channelTitle,
            published_at: v.publishedAt,
            description: v.description,
            url: v.url,
            thumbnail_url: v.thumbnailUrl,
            ...(v.statistics ? { statistics: v.statistics } : {}),
          })),
        })),
        errors: failed.map((f) => ({
          id: f.sourceQueryId,
          query: f.query,
          error: f.errorMessage || f.errorCode || 'Query failed',
        })),
      };

      const outputYaml = dump(outputObj, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
        forceQuotes: false,
      });

      const fullDetails: SearchRunDetails = {
        ...run,
        queryResults,
        outputYaml,
      };

      userDetails.set(runId, fullDetails);
      return fullDetails;
    } catch {
      return cached || null;
    }
  }

  async deleteSearchRunRecursively(idToken: string, uid: string, runId: string): Promise<void> {
    const userRuns = getOrCreateUserMap(inMemorySearchRuns, uid);
    userRuns.delete(runId);
    const userDetails = getOrCreateUserMap(inMemoryRunDetails, uid);
    userDetails.delete(runId);

    const encRunId = encodeURIComponent(runId);

    try {
      // 1. List all query results
      const qUrl = `${this.baseUrl}/users/${uid}/searchRuns/${encRunId}/queryResults?pageSize=100`;
      const qRes = await fetch(qUrl, {
        method: 'GET',
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (qRes.ok) {
        const qDocs = ((await qRes.json()) as any).documents || [];
        for (const qDoc of qDocs) {
          const qId = qDoc.name.split('/').pop() || '';
          const encQId = encodeURIComponent(qId);

          // 2. List and delete all video documents in subcollection
          const vUrl = `${this.baseUrl}/users/${uid}/searchRuns/${encRunId}/queryResults/${encQId}/videos?pageSize=100`;
          const vRes = await fetch(vUrl, {
            method: 'GET',
            headers: { Authorization: `Bearer ${idToken}` },
          });

          if (vRes.ok) {
            const vDocs = ((await vRes.json()) as any).documents || [];
            for (const vDoc of vDocs) {
              const vId = vDoc.name.split('/').pop() || '';
              const delVUrl = `${this.baseUrl}/users/${uid}/searchRuns/${encRunId}/queryResults/${encQId}/videos/${encodeURIComponent(vId)}`;
              await fetch(delVUrl, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${idToken}` },
              }).catch(() => {});
            }
          }

          // Delete queryResult doc
          const delQUrl = `${this.baseUrl}/users/${uid}/searchRuns/${encRunId}/queryResults/${encQId}`;
          await fetch(delQUrl, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${idToken}` },
          }).catch(() => {});
        }
      }

      // 3. Delete top-level search run document
      const delRunUrl = `${this.baseUrl}/users/${uid}/searchRuns/${encRunId}`;
      await fetch(delRunUrl, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${idToken}` },
      });
    } catch {
      // ignore
    }
  }
}
