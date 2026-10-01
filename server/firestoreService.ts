import { dump } from 'js-yaml';
import { QuerySet, SearchRun, SearchRunDetails, QueryResultItem, StoredVideoItem } from '../src/types/index.js';

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

export class FirestoreService {
  constructor(
    private projectId: string,
    private databaseId: string
  ) {}

  private get baseUrl(): string {
    return `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/${this.databaseId}/documents`;
  }

  // --- QUERY SETS ---

  async listQuerySets(idToken: string, uid: string): Promise<QuerySet[]> {
    const userMemory = getOrCreateUserMap(inMemoryQuerySets, uid);

    try {
      const url = `${this.baseUrl}/users/${uid}/querySets?pageSize=100`;
      const res = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (res.ok) {
        const data = (await res.json()) as any;
        const docs = Array.isArray(data.documents) ? data.documents : [];

        for (const doc of docs) {
          const id = doc.name.split('/').pop() || '';
          const raw = fromFirestoreFields(doc.fields);
          const item: QuerySet = {
            id,
            name: raw.name || 'Untitled Query Set',
            rawYaml: raw.rawYaml || '',
            queryCount: Number(raw.queryCount || 0),
            createdAt: raw.createdAt || doc.createTime,
            updatedAt: raw.updatedAt || doc.updateTime,
          };
          userMemory.set(id, item);
        }
      } else if (res.status !== 404) {
        console.warn('[Firestore] listQuerySets notice (using cache):', res.status);
      }
    } catch (e) {
      console.warn('[Firestore] listQuerySets network notice:', e);
    }

    const items = Array.from(userMemory.values());
    return items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
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
    queryCount: number
  ): Promise<QuerySet> {
    const now = new Date().toISOString();
    const querySetId = `qs_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const payload: QuerySet = {
      id: querySetId,
      name: name.trim() || 'Untitled Query Set',
      rawYaml,
      queryCount,
      createdAt: now,
      updatedAt: now,
    };

    // Save to memory immediately
    const userMemory = getOrCreateUserMap(inMemoryQuerySets, uid);
    userMemory.set(querySetId, payload);

    // Persist to Firestore
    try {
      const url = `${this.baseUrl}/users/${uid}/querySets?documentId=${querySetId}`;
      await fetch(url, {
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
            createdAt: payload.createdAt,
            updatedAt: payload.updatedAt,
          }),
        }),
      });
    } catch (e) {
      console.warn('[Firestore] createQuerySet persist notice:', e);
    }

    return payload;
  }

  async updateQuerySet(
    idToken: string,
    uid: string,
    querySetId: string,
    updates: { name?: string; rawYaml?: string; queryCount?: number }
  ): Promise<QuerySet> {
    const existing = await this.getQuerySet(idToken, uid, querySetId);
    const now = new Date().toISOString();
    const updated: QuerySet = {
      id: querySetId,
      name: updates.name ?? existing?.name ?? 'Untitled Query Set',
      rawYaml: updates.rawYaml ?? existing?.rawYaml ?? '',
      queryCount: updates.queryCount ?? existing?.queryCount ?? 0,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    const userMemory = getOrCreateUserMap(inMemoryQuerySets, uid);
    userMemory.set(querySetId, updated);

    try {
      const url = `${this.baseUrl}/users/${uid}/querySets/${encodeURIComponent(querySetId)}`;
      await fetch(url, {
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
            createdAt: updated.createdAt,
            updatedAt: updated.updatedAt,
          }),
        }),
      });
    } catch (e) {
      console.warn('[Firestore] updateQuerySet persist notice:', e);
    }

    return updated;
  }

  async deleteQuerySet(idToken: string, uid: string, querySetId: string): Promise<void> {
    const userMemory = getOrCreateUserMap(inMemoryQuerySets, uid);
    userMemory.delete(querySetId);

    try {
      const url = `${this.baseUrl}/users/${uid}/querySets/${encodeURIComponent(querySetId)}`;
      await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${idToken}` },
      });
    } catch {
      // ignore
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
    }
  ): Promise<string> {
    const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

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
    };

    const userRuns = getOrCreateUserMap(inMemorySearchRuns, uid);
    userRuns.set(runId, payload);

    const userDetails = getOrCreateUserMap(inMemoryRunDetails, uid);
    userDetails.set(runId, {
      ...payload,
      queryResults: [],
      outputYaml: '',
    });

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
        console.warn('[Firestore] createSearchRun error:', res.status, await res.text());
      } else {
        console.log(`[Firestore] Created SearchRun document: ${runId}`);
      }
    } catch (e) {
      console.warn('[Firestore] createSearchRun notice:', e);
    }

    return runId;
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

    try {
      const url = `${this.baseUrl}/users/${uid}/searchRuns?pageSize=${limitCount}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (res.ok) {
        const data = (await res.json()) as any;
        const docs = Array.isArray(data.documents) ? data.documents : [];

        for (const doc of docs) {
          const id = doc.name.split('/').pop() || '';
          const raw = fromFirestoreFields(doc.fields);
          const item: SearchRun = {
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
          };
          userMemory.set(id, item);
        }
      } else if (res.status !== 404) {
        console.warn('[Firestore] listSearchRuns notice (using cache):', res.status);
      }
    } catch (e) {
      console.warn('[Firestore] listSearchRuns network notice:', e);
    }

    const runs = Array.from(userMemory.values());
    return runs.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
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
