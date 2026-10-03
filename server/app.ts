import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { load, dump } from 'js-yaml';
import swaggerUi from 'swagger-ui-express';
import { FirestoreReadError, FirestoreService, FirestoreWriteError } from './firestoreService.js';
import { createPublicApiRouter, createPublicApiV1Router, PUBLIC_API_BASE_PATH, PUBLIC_API_V1_BASE_PATH } from './publicApi.js';
import { configureUserYouTubeApiKey, getUserYouTubeApiKey, removeUserYouTubeApiKey } from './youtubeCredentials.js';
import { validateParsedYaml } from './yamlValidator.js';
import type { QueryConfig, YamlDefaults } from './yamlValidator.js';
import { adminAuth, adminDb, firebaseProjectId, firestoreDatabaseId, isVercelRuntime } from './firebaseAdmin.js';

export { validateParsedYaml } from './yamlValidator.js';
// Preserve existing named exports for internal callers; routes use lifecycle APIs.
export { encryptSecret, decryptSecret } from './youtubeCredentials.js';
export type { EncryptedSecretPayload } from './youtubeCredentials.js';

const firestoreService = new FirestoreService(firebaseProjectId, firestoreDatabaseId, adminDb);

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      idToken?: string;
    }
  }
}

/**
 * Reusable authentication middleware.
 * Verifies Firebase ID Token from Authorization: Bearer <token>
 * and attaches verified user info to req.user and raw token to req.idToken.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const idToken = authHeader.split('Bearer ')[1]?.trim();
  if (!idToken) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    req.idToken = idToken;
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
      picture: decodedToken.picture,
    };
    next();
  } catch {
    // Return 401 Unauthorized without logging sensitive tokens
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
}

const app = express();

app.use(express.json({ limit: '10mb' }));

// Load and parse OpenAPI documentation
const openapiYamlPath = fileURLToPath(new URL('../openapi/public-api.yaml', import.meta.url));
let openapiDocument: any = null;
try {
  if (fs.existsSync(openapiYamlPath)) {
    openapiDocument = load(fs.readFileSync(openapiYamlPath, 'utf-8'));
  }
} catch (err) {
  console.warn('Failed to parse openapi/public-api.yaml:', err);
}

// Machine-readable OpenAPI 3.1 JSON endpoint (Public)
app.get('/openapi.json', (_req: Request, res: Response) => {
  if (!openapiDocument) {
    res.status(500).json({ error: 'OpenAPI specification not available' });
    return;
  }
  res.setHeader('Content-Type', 'application/json');
  res.json(openapiDocument);
});

// Swagger UI Documentation (Public)
if (openapiDocument) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiDocument));
}

// Mount Public Read-Only API
app.use(PUBLIC_API_BASE_PATH, createPublicApiRouter(firestoreService));
app.use(PUBLIC_API_V1_BASE_PATH, createPublicApiV1Router(firestoreService));

interface VideoResult {
  video_id: string;
  title: string;
  channel_id: string;
  channel_title: string;
  published_at: string;
  description: string;
  url: string;
  thumbnail_url: string;
}

interface QuerySuccessResult {
  id: string;
  query: string;
  relevance_language?: string;
  region_code?: string;
  count: number;
  videos: VideoResult[];
}

interface QueryErrorResult {
  id: string;
  query: string;
  error: string;
}

function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, dec) => {
      try {
        return String.fromCharCode(parseInt(dec, 10));
      } catch {
        return _;
      }
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      try {
        return String.fromCharCode(parseInt(hex, 16));
      } catch {
        return _;
      }
    });
}

// Concurrency runner (limit 3 concurrent requests)
async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  workerFn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIdx = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIdx < items.length) {
      const current = nextIdx++;
      results[current] = await workerFn(items[current], current);
    }
  });

  await Promise.all(workers);
  return results;
}

// Single query executor using user's YouTube API key
async function executeYouTubeQuery(
  query: QueryConfig,
  defaults: YamlDefaults | undefined,
  apiKey: string
): Promise<{ success: boolean; result?: QuerySuccessResult; error?: QueryErrorResult }> {
  const maxResults = query.max_results ?? defaults?.max_results ?? 10;
  const order = query.order ?? defaults?.order ?? 'relevance';
  const safeSearch = query.safe_search ?? defaults?.safe_search ?? 'moderate';
  const relevanceLanguage = query.relevance_language;
  const regionCode = query.region_code;
  const publishedAfter = query.published_after;
  const publishedBefore = query.published_before;

  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('type', 'video');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('q', query.q);
  url.searchParams.set('maxResults', String(Math.min(50, Math.max(1, maxResults))));
  url.searchParams.set('order', order);
  url.searchParams.set('safeSearch', safeSearch);

  if (relevanceLanguage) {
    url.searchParams.set('relevanceLanguage', relevanceLanguage);
  }
  if (regionCode) {
    url.searchParams.set('regionCode', regionCode);
  }
  if (publishedAfter) {
    url.searchParams.set('publishedAfter', publishedAfter);
  }
  if (publishedBefore) {
    url.searchParams.set('publishedBefore', publishedBefore);
  }

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status} ${response.statusText}`;
      try {
        const errorData = (await response.json()) as any;
        if (errorData?.error?.message) {
          errorMessage = errorData.error.message;
        }
      } catch {
        // fallback
      }
      return {
        success: false,
        error: {
          id: query.id,
          query: query.q,
          error: errorMessage,
        },
      };
    }

    const data = (await response.json()) as any;
    const items = Array.isArray(data.items) ? data.items : [];

    const videos: VideoResult[] = items.map((item: any) => {
      const videoId = item?.id?.videoId || '';
      const snippet = item?.snippet || {};
      const thumbnails = snippet?.thumbnails || {};
      const thumbnailUrl =
        thumbnails.high?.url ||
        thumbnails.medium?.url ||
        thumbnails.default?.url ||
        '';

      return {
        video_id: videoId,
        title: decodeHtmlEntities(snippet.title || ''),
        channel_id: snippet.channelId || '',
        channel_title: decodeHtmlEntities(snippet.channelTitle || ''),
        published_at: snippet.publishedAt || '',
        description: decodeHtmlEntities(snippet.description || ''),
        url: `https://www.youtube.com/watch?v=${videoId}`,
        thumbnail_url: thumbnailUrl,
      };
    });

    const successResult: QuerySuccessResult = {
      id: query.id,
      query: query.q,
      count: videos.length,
      videos,
    };

    if (relevanceLanguage) {
      successResult.relevance_language = relevanceLanguage;
    }
    if (regionCode) {
      successResult.region_code = regionCode;
    }

    return {
      success: true,
      result: successResult,
    };
  } catch (err: any) {
    let msg = err?.message || 'Network request failed';
    if (err?.name === 'TimeoutError' || err?.message?.includes('timeout')) {
      msg = 'Request timed out after 15 seconds.';
    }
    return {
      success: false,
      error: {
        id: query.id,
        query: query.q,
        error: msg,
      },
    };
  }
}

// User YouTube API Key Settings Endpoints

// GET /api/settings/youtube-api-key: Returns key status, masked suffix, and verifiedAt
app.get('/api/settings/youtube-api-key', requireAuth, async (req: Request, res: Response) => {
  try {
    const uid = req.user!.uid;
    const userKeyInfo = await getUserYouTubeApiKey(req.idToken, uid);
    if (!userKeyInfo) {
      res.json({ configured: false });
      return;
    }
    res.json({
      configured: true,
      suffix: userKeyInfo.suffix,
      verifiedAt: userKeyInfo.verifiedAt || null,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve API key status.' });
  }
});

// POST /api/settings/youtube-api-key: Verifies key, encrypts, and stores in Firestore
app.post('/api/settings/youtube-api-key', requireAuth, async (req: Request, res: Response) => {
  const rawKey = req.body?.apiKey;
  if (!rawKey || typeof rawKey !== 'string' || rawKey.trim().length < 5) {
    res.status(400).json({ error: 'Please provide a valid YouTube API key.' });
    return;
  }

  const apiKey = rawKey.trim();

  const uid = req.user!.uid;
  const result = await configureUserYouTubeApiKey(req.idToken, uid, apiKey);
  if (result.configured === false) {
    res.status(400).json({ error: result.error || 'The YouTube API key could not be verified.' });
    return;
  }

  console.log(`[YouTube Key] Configured key for user ${uid.slice(0, 6)}`);
  res.json({
    success: true,
    suffix: result.suffix,
  });
});

// DELETE /api/settings/youtube-api-key: Removes the authenticated user's YouTube API key
app.delete('/api/settings/youtube-api-key', requireAuth, async (req: Request, res: Response) => {
  try {
    const uid = req.user!.uid;
    await removeUserYouTubeApiKey(req.idToken, uid);
    console.log(`[YouTube Key] Removed key for user ${uid.slice(0, 6)}`);
    res.json({
      success: true,
      message: 'YouTube API key removed successfully.',
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove YouTube API key.' });
  }
});

// Legacy /api/youtube/status endpoint for user status
app.get(['/api/config', '/api/youtube/status'], requireAuth, async (req: Request, res: Response) => {
  const uid = req.user!.uid;
  const userKeyInfo = await getUserYouTubeApiKey(req.idToken, uid);
  res.json({
    hasApiKey: Boolean(userKeyInfo),
    suffix: userKeyInfo?.suffix || null,
    configured: Boolean(userKeyInfo),
  });
});

// --- QUERY SETS REST API ---

// GET /api/query-sets - List saved query sets
app.get('/api/query-sets', requireAuth, async (req: Request, res: Response) => {
  try {
    const list = await firestoreService.listQuerySets(req.idToken!, req.user!.uid);
    res.json(list);
  } catch (err: unknown) {
    const status = err instanceof FirestoreReadError ? err.statusCode : 503;
    res.status(status).json({ error: 'Failed to load query sets' });
  }
});

// GET /api/query-sets/:id - Get single query set
app.get('/api/query-sets/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const item = await firestoreService.getQuerySet(req.idToken!, req.user!.uid, req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Query set not found' });
    }
    res.json(item);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to get query set' });
  }
});

// POST /api/query-sets - Create new query set
app.post('/api/query-sets', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, rawYaml, queryCount, publicApiEnabled } = req.body || {};
    if (typeof rawYaml !== 'string') {
      return res.status(400).json({ error: 'Missing rawYaml in request body' });
    }
    const created = await firestoreService.createQuerySet(
      req.idToken!,
      req.user!.uid,
      name || 'Untitled Query Set',
      rawYaml,
      Number(queryCount || 0),
      Boolean(publicApiEnabled)
    );
    res.json(created);
  } catch (err: unknown) {
    const status = err instanceof FirestoreWriteError ? err.statusCode : 500;
    res.status(status).json({ error: 'Failed to save query set' });
  }
});

// PUT /api/query-sets/:id - Update existing query set
app.put('/api/query-sets/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, rawYaml, queryCount, publicApiEnabled } = req.body || {};
    const updated = await firestoreService.updateQuerySet(req.idToken!, req.user!.uid, req.params.id, {
      name,
      rawYaml,
      queryCount: queryCount !== undefined ? Number(queryCount) : undefined,
      publicApiEnabled: publicApiEnabled !== undefined ? Boolean(publicApiEnabled) : undefined,
    });
    res.json(updated);
  } catch (err: unknown) {
    const status = err instanceof FirestoreWriteError ? err.statusCode : 500;
    res.status(status).json({ error: 'Failed to update query set' });
  }
});

// PATCH /api/query-sets/:id/public-api - Toggle public API status
app.patch('/api/query-sets/:id/public-api', requireAuth, async (req: Request, res: Response) => {
  try {
    const { publicApiEnabled } = req.body || {};
    if (typeof publicApiEnabled !== 'boolean') {
      return res.status(400).json({ error: 'publicApiEnabled boolean is required' });
    }
    const updated = await firestoreService.updateQuerySet(req.idToken!, req.user!.uid, req.params.id, {
      publicApiEnabled: Boolean(publicApiEnabled),
    });
    res.json(updated);
  } catch (err: unknown) {
    const status = err instanceof FirestoreWriteError ? err.statusCode : 500;
    res.status(status).json({ error: 'Failed to update public API status' });
  }
});

// PATCH /api/query-sets/:id/rename - Rename query set
app.patch('/api/query-sets/:id/rename', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name } = req.body || {};
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Valid name is required' });
    }
    const updated = await firestoreService.updateQuerySet(req.idToken!, req.user!.uid, req.params.id, {
      name: name.trim(),
    });
    res.json(updated);
  } catch (err: unknown) {
    const status = err instanceof FirestoreWriteError ? err.statusCode : 500;
    res.status(status).json({ error: 'Failed to rename query set' });
  }
});

// DELETE /api/query-sets/:id - Delete query set (Search runs remain intact)
app.delete('/api/query-sets/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    await firestoreService.deleteQuerySet(req.idToken!, req.user!.uid, req.params.id);
    res.json({ success: true, message: 'Query set deleted' });
  } catch (err: unknown) {
    const status = err instanceof FirestoreWriteError ? err.statusCode : 500;
    res.status(status).json({ error: 'Failed to delete query set' });
  }
});

// --- SEARCH RUNS REST API ---

// GET /api/search-runs - List search runs metadata (newest first, lightweight)
app.get('/api/search-runs', requireAuth, async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit || 50);
    const runs = await firestoreService.listSearchRuns(req.idToken!, req.user!.uid, limit);
    res.json(runs);
  } catch (err: unknown) {
    const status = err instanceof FirestoreReadError ? err.statusCode : 503;
    res.status(status).json({ error: 'Failed to load search runs' });
  }
});

// GET /api/search-runs/:id - Get detailed search run with subcollections and reconstructed YAML
app.get('/api/search-runs/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const details = await firestoreService.getSearchRunDetails(req.idToken!, req.user!.uid, req.params.id);
    if (!details) {
      return res.status(404).json({ error: 'Search run not found' });
    }
    res.json(details);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to get search run details' });
  }
});

// PATCH /api/search-runs/:id/visibility - Toggle/update search run public/private visibility
app.patch('/api/search-runs/:id/visibility', requireAuth, async (req: Request, res: Response) => {
  try {
    const { visibility } = req.body || {};
    if (visibility !== 'public' && visibility !== 'private') {
      return res.status(400).json({ error: 'visibility must be either "public" or "private"' });
    }
    const updated = await firestoreService.updateSearchRunVisibility(
      req.idToken!,
      req.user!.uid,
      req.params.id,
      visibility
    );
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update search run visibility' });
  }
});

// DELETE /api/search-runs/:id - Recursively delete search run and its subcollections
app.delete('/api/search-runs/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    await firestoreService.deleteSearchRunRecursively(req.idToken!, req.user!.uid, req.params.id);
    res.json({ success: true, message: 'Search run and associated records deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete search run' });
  }
});

// POST /api/youtube/validate - validates YAML syntax and structure (authenticated)
app.post('/api/youtube/validate', requireAuth, (req: Request, res: Response) => {
  const rawYaml = req.body?.yaml;
  if (typeof rawYaml !== 'string') {
    res.status(400).json({ valid: false, errors: ['Missing "yaml" field in request body.'] });
    return;
  }

  try {
    const parsed = load(rawYaml);
    const validation = validateParsedYaml(parsed);
    if (!validation.valid) {
      res.status(400).json({ valid: false, errors: validation.errors });
      return;
    }

    const queryCount = validation.parsed!.queries.length;
    res.json({
      valid: true,
      queriesCount: queryCount,
      estimatedCalls: queryCount,
      queries: validation.parsed!.queries.map((q) => ({ id: q.id, q: q.q })),
    });
  } catch (err: any) {
    res.status(400).json({
      valid: false,
      errors: [`YAML Parsing Error: ${err?.message || 'Invalid YAML format'}`],
    });
  }
});

// POST /api/youtube/search (protected with requireAuth middleware, creates SearchRun and records to Firestore)
app.post('/api/youtube/search', requireAuth, async (req: Request, res: Response) => {
  const rawYaml = req.body?.yaml;
  const querySetId = req.body?.querySetId || null;
  const querySetName = req.body?.querySetName || null;
  const isStream = req.query.stream === 'true' || req.headers.accept === 'text/event-stream';

  const uid = req.user!.uid;

  // Retrieve and decrypt the authenticated user's own YouTube API key
  const userKeyInfo = await getUserYouTubeApiKey(req.idToken, uid);
  if (!userKeyInfo) {
    const errorMsg = 'Configure your YouTube API key before running a search.';
    if (isStream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.write(
        `data: ${JSON.stringify({
          type: 'fatal_error',
          error: 'YOUTUBE_API_KEY_REQUIRED',
          message: errorMsg,
        })}\n\n`
      );
      res.end();
      return;
    }
    res.status(428).json({
      error: 'YOUTUBE_API_KEY_REQUIRED',
      message: errorMsg,
    });
    return;
  }

  const apiKey = userKeyInfo.apiKey;

  if (typeof rawYaml !== 'string') {
    res.status(400).json({ error: 'Request body must contain "yaml" string.' });
    return;
  }

  let parsed: any;
  try {
    parsed = load(rawYaml);
  } catch (err: any) {
    res.status(400).json({ error: `YAML Parsing Error: ${err?.message || 'Invalid YAML format'}` });
    return;
  }

  const validation = validateParsedYaml(parsed);
  if (!validation.valid || !validation.parsed) {
    res.status(400).json({ error: 'Validation failed', errors: validation.errors });
    return;
  }

  const searchConfig = validation.parsed;
  const queries = searchConfig.queries;
  const defaults = searchConfig.defaults;

  // 1. Create a historical Search Run document in Firestore with status 'running'
  let runId = `run_${Date.now()}`;
  try {
    runId = await firestoreService.createSearchRun(req.idToken!, uid, {
      querySetId,
      querySetName,
      queryCount: queries.length,
      inputYaml: rawYaml,
    });
  } catch {
    console.error('[SearchRuns] Failed to create Firestore run document.');
    res.status(503).json({ error: 'Failed to create search run' });
    return;
  }

  if (isStream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send initial start event including runId
    res.write(
      `data: ${JSON.stringify({
        type: 'start',
        runId,
        total: queries.length,
        queries: queries.map((q) => ({ id: q.id, q: q.q })),
      })}\n\n`
    );

    const results: QuerySuccessResult[] = [];
    const errors: QueryErrorResult[] = [];
    let completedCount = 0;
    const persistPromises: Promise<any>[] = [];

    await runWithConcurrency(queries, 3, async (query, index) => {
      res.write(
        `data: ${JSON.stringify({
          type: 'query_start',
          id: query.id,
          index,
          completed: completedCount,
          total: queries.length,
        })}\n\n`
      );

      const qStartedAt = new Date().toISOString();
      const outcome = await executeYouTubeQuery(query, defaults, apiKey);
      const qCompletedAt = new Date().toISOString();
      completedCount++;

      if (outcome.success && outcome.result) {
        results.push(outcome.result);

        // Persist query result and video documents to Firestore subcollections
        persistPromises.push(
          firestoreService
            .saveQueryResultAndVideos(req.idToken!, uid, runId, {
              sourceQueryId: query.id,
              query: query.q,
              relevanceLanguage: query.relevance_language,
              regionCode: query.region_code,
              status: 'success',
              resultCount: outcome.result.count,
              startedAt: qStartedAt,
              completedAt: qCompletedAt,
              videos: outcome.result.videos.map((v) => ({
                videoId: v.video_id,
                title: v.title,
                channelId: v.channel_id,
                channelTitle: v.channel_title,
                publishedAt: v.published_at,
                description: v.description,
                url: v.url,
                thumbnailUrl: v.thumbnail_url,
              })),
            })
            .catch((e) => console.warn('[Firestore saveQueryResult error]:', e))
        );

        res.write(
          `data: ${JSON.stringify({
            type: 'query_success',
            id: query.id,
            index,
            completed: completedCount,
            total: queries.length,
            count: outcome.result.count,
            result: outcome.result,
          })}\n\n`
        );
      } else if (outcome.error) {
        errors.push(outcome.error);

        // Persist failed query result to Firestore
        persistPromises.push(
          firestoreService
            .saveQueryResultAndVideos(req.idToken!, uid, runId, {
              sourceQueryId: query.id,
              query: query.q,
              relevanceLanguage: query.relevance_language,
              regionCode: query.region_code,
              status: 'failed',
              resultCount: 0,
              errorCode: 'QUERY_EXECUTION_ERROR',
              errorMessage: outcome.error.error,
              startedAt: qStartedAt,
              completedAt: qCompletedAt,
              videos: [],
            })
            .catch((e) => console.warn('[Firestore saveQueryResult error]:', e))
        );

        res.write(
          `data: ${JSON.stringify({
            type: 'query_error',
            id: query.id,
            index,
            completed: completedCount,
            total: queries.length,
            error: outcome.error.error,
          })}\n\n`
        );
      }
    });

    // Ensure all subcollection queries and videos finish saving before ending stream
    await Promise.all(persistPromises);

    const totalResults = results.reduce((acc, r) => acc + r.count, 0);
    const finalStatus: 'completed' | 'partial' | 'failed' =
      errors.length === 0 ? 'completed' : results.length > 0 ? 'partial' : 'failed';

    // Update SearchRun document with final summary and await completion
    const completedAt = new Date().toISOString();
    await firestoreService
      .updateSearchRunSummary(req.idToken!, uid, runId, {
        status: finalStatus,
        successfulQueries: results.length,
        failedQueries: errors.length,
        totalResults,
        completedAt,
      })
      .catch((e) => console.warn('[Firestore updateSearchRunSummary error]:', e));

    const outputObj = {
      generated_at: completedAt,
      summary: {
        queries: queries.length,
        successful: results.length,
        failed: errors.length,
        total_results: totalResults,
      },
      results,
      errors,
    };

    const outputYaml = dump(outputObj, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
      forceQuotes: false,
    });

    res.write(
      `data: ${JSON.stringify({
        type: 'complete',
        runId,
        outputYaml,
        data: outputObj,
      })}\n\n`
    );

    res.end();
    return;
  }

  // Non-streaming standard endpoint
  const results: QuerySuccessResult[] = [];
  const errors: QueryErrorResult[] = [];
  const persistPromises: Promise<any>[] = [];

  const outcomes = await runWithConcurrency(queries, 3, async (query) => {
    const qStartedAt = new Date().toISOString();
    const outcome = await executeYouTubeQuery(query, defaults, apiKey);
    const qCompletedAt = new Date().toISOString();

    if (outcome.success && outcome.result) {
      results.push(outcome.result);
      persistPromises.push(
        firestoreService
          .saveQueryResultAndVideos(req.idToken!, uid, runId, {
            sourceQueryId: query.id,
            query: query.q,
            relevanceLanguage: query.relevance_language,
            regionCode: query.region_code,
            status: 'success',
            resultCount: outcome.result.count,
            startedAt: qStartedAt,
            completedAt: qCompletedAt,
            videos: outcome.result.videos.map((v) => ({
              videoId: v.video_id,
              title: v.title,
              channelId: v.channel_id,
              channelTitle: v.channel_title,
              publishedAt: v.published_at,
              description: v.description,
              url: v.url,
              thumbnailUrl: v.thumbnail_url,
            })),
          })
          .catch((e) => console.warn('[Firestore saveQueryResult error]:', e))
      );
    } else if (outcome.error) {
      errors.push(outcome.error);
      persistPromises.push(
        firestoreService
          .saveQueryResultAndVideos(req.idToken!, uid, runId, {
            sourceQueryId: query.id,
            query: query.q,
            relevanceLanguage: query.relevance_language,
            regionCode: query.region_code,
            status: 'failed',
            resultCount: 0,
            errorCode: 'QUERY_EXECUTION_ERROR',
            errorMessage: outcome.error.error,
            startedAt: qStartedAt,
            completedAt: qCompletedAt,
            videos: [],
          })
          .catch((e) => console.warn('[Firestore saveQueryResult error]:', e))
      );
    }
    return outcome;
  });

  // Ensure all subcollection queries and videos finish saving before returning
  await Promise.all(persistPromises);

  const totalResults = results.reduce((acc, r) => acc + r.count, 0);
  const finalStatus: 'completed' | 'partial' | 'failed' =
    errors.length === 0 ? 'completed' : results.length > 0 ? 'partial' : 'failed';
  const completedAt = new Date().toISOString();

  await firestoreService
    .updateSearchRunSummary(req.idToken!, uid, runId, {
      status: finalStatus,
      successfulQueries: results.length,
      failedQueries: errors.length,
      totalResults,
      completedAt,
    })
    .catch((e) => console.warn('[Firestore updateSearchRunSummary error]:', e));

  const outputObj = {
    generated_at: completedAt,
    summary: {
      queries: queries.length,
      successful: results.length,
      failed: errors.length,
      total_results: totalResults,
    },
    results,
    errors,
  };

  const outputYaml = dump(outputObj, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    forceQuotes: false,
  });

  res.json({
    runId,
    outputYaml,
    data: outputObj,
  });
});

// Vercel serves built files from public/ via its CDN. This fallback keeps the
// existing Express SPA behavior for non-file frontend paths after API routes.
if (isVercelRuntime) {
  const frontendEntryPath = fileURLToPath(new URL('../public/index.html', import.meta.url));
  app.get('*', (_req: Request, res: Response, next: NextFunction) => {
    if (!fs.existsSync(frontendEntryPath)) {
      next();
      return;
    }
    res.sendFile(frontendEntryPath);
  });
}

export default app;
