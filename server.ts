import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { load, dump } from 'js-yaml';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { FirestoreService } from './server/firestoreService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin for server-side ID token verification and Firestore
let firebaseProjectId = process.env.FIREBASE_PROJECT_ID || 'sapient-spark-z83d0';
let firestoreDatabaseId: string | undefined;

try {
  const configPath = path.join(__dirname, 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (rawConfig.projectId) {
      firebaseProjectId = rawConfig.projectId;
    }
    if (rawConfig.firestoreDatabaseId) {
      firestoreDatabaseId = rawConfig.firestoreDatabaseId;
    }
  }
} catch (e) {
  console.warn('Could not read firebase-applet-config.json, using default projectId:', e);
}

const adminApp = getApps().length === 0 ? initializeApp({ projectId: firebaseProjectId }) : getApps()[0];
const adminAuth = getAuth(adminApp);
const db = firestoreDatabaseId ? getFirestore(adminApp, firestoreDatabaseId) : getFirestore(adminApp);

const firestoreService = new FirestoreService(
  firebaseProjectId,
  firestoreDatabaseId || 'ai-studio-youtubeyamlsearc-83e4e646-42fd-44b9-a9a0-7af77ee13b93'
);

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

// In-memory active session cache for verified user keys (keyed by UID)
const userSessionKeyMap = new Map<string, { apiKey: string; suffix: string; verifiedAt: string }>();

// AES-256-GCM Encryption / Decryption Utilities
export interface EncryptedSecretPayload {
  encryptedApiKey: string;
  iv: string;
  authTag: string;
  keyVersion: number;
}

function getEncryptionKey(): Buffer {
  const envKey = process.env.USER_API_KEY_ENCRYPTION_KEY || 'default-secret-encryption-key-for-youtube-yaml-search-2026';
  return crypto.createHash('sha256').update(envKey).digest();
}

export function encryptSecret(plaintext: string): EncryptedSecretPayload {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag().toString('base64');
  return {
    encryptedApiKey: encrypted,
    iv: iv.toString('base64'),
    authTag,
    keyVersion: 1,
  };
}

export function decryptSecret(payload: { encryptedApiKey: string; iv: string; authTag: string; keyVersion?: number }): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(payload.iv, 'base64');
  const authTag = Buffer.from(payload.authTag, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(payload.encryptedApiKey, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Lightweight verification of YouTube API key against YouTube Data API v3
async function testYouTubeApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/videoCategories');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('regionCode', 'US');
    url.searchParams.set('key', apiKey);

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      return { valid: true };
    }

    let errorReason = 'The YouTube API key could not be verified.';
    try {
      const data = (await res.json()) as any;
      const firstError = data?.error?.errors?.[0];
      const reason = firstError?.reason || '';
      const message = data?.error?.message || '';

      if (reason === 'keyInvalid' || reason === 'badRequest' || res.status === 400) {
        errorReason = 'The YouTube API key is invalid or unrecognized.';
      } else if (reason === 'accessNotConfigured' || message.includes('disabled') || message.includes('has not been used')) {
        errorReason = 'YouTube Data API v3 is disabled in your Google Cloud project. Please enable it in the Google Cloud Console.';
      } else if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
        errorReason = 'The YouTube API quota for this key has been exceeded.';
      } else if (reason === 'ipRefererBlocked' || message.includes('restriction')) {
        errorReason = 'The YouTube API key has restrictions (e.g. IP or HTTP referrer) that block server calls.';
      }
    } catch {
      // keep fallback
    }

    return { valid: false, error: errorReason };
  } catch (err: any) {
    if (err?.name === 'TimeoutError' || err?.message?.includes('timeout')) {
      return { valid: false, error: 'Connection to YouTube API timed out. Please try again.' };
    }
    return { valid: false, error: 'Network error communicating with YouTube Data API.' };
  }
}

// Persistence: Save encrypted integration to Firestore with REST API (user token) or Admin SDK
async function persistUserIntegration(
  idToken: string | undefined,
  uid: string,
  payload: {
    encryptedApiKey: string;
    iv: string;
    authTag: string;
    keyVersion: number;
    keySuffix: string;
    verifiedAt: string;
    updatedAt: string;
  }
): Promise<void> {
  // 1. Attempt Firestore REST API using the authenticated user's ID token
  if (idToken) {
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/${firestoreDatabaseId || '(default)'}/documents/users/${uid}/integrations/youtube`;
      const body = {
        fields: {
          encryptedApiKey: { stringValue: payload.encryptedApiKey },
          iv: { stringValue: payload.iv },
          authTag: { stringValue: payload.authTag },
          keyVersion: { integerValue: String(payload.keyVersion) },
          keySuffix: { stringValue: payload.keySuffix },
          verifiedAt: { stringValue: payload.verifiedAt },
          updatedAt: { stringValue: payload.updatedAt },
        },
      };

      const res = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        return;
      }
    } catch (e) {
      console.warn('[Firestore REST Save] Notice:', e);
    }
  }

  // 2. Fallback to Admin SDK
  try {
    const docRef = db.collection('users').doc(uid).collection('integrations').doc('youtube');
    await docRef.set(payload);
  } catch (adminErr) {
    console.warn('[Firestore Admin Save] Notice:', adminErr);
  }
}

// Helper: Load and decrypt the authenticated user's YouTube API key
async function getUserYouTubeApiKey(
  idToken: string | undefined,
  uid: string
): Promise<{ apiKey: string; suffix: string; verifiedAt?: string } | null> {
  // 1. Fast active session cache
  const cached = userSessionKeyMap.get(uid);
  if (cached) {
    return cached;
  }

  // 2. Try Firestore REST API with the user's ID token
  if (idToken) {
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/${firestoreDatabaseId || '(default)'}/documents/users/${uid}/integrations/youtube`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (res.ok) {
        const json = (await res.json()) as any;
        const fields = json?.fields;
        if (fields?.encryptedApiKey?.stringValue && fields?.iv?.stringValue && fields?.authTag?.stringValue) {
          const decryptedKey = decryptSecret({
            encryptedApiKey: fields.encryptedApiKey.stringValue,
            iv: fields.iv.stringValue,
            authTag: fields.authTag.stringValue,
            keyVersion: Number(fields.keyVersion?.integerValue || 1),
          });
          const item = {
            apiKey: decryptedKey,
            suffix: fields.keySuffix?.stringValue || decryptedKey.slice(-4),
            verifiedAt: fields.verifiedAt?.stringValue,
          };
          userSessionKeyMap.set(uid, item);
          return item;
        }
      }
    } catch (e) {
      console.warn('[Firestore REST Get] Notice:', e);
    }
  }

  // 3. Fallback to Admin SDK
  try {
    const docRef = db.collection('users').doc(uid).collection('integrations').doc('youtube');
    const snap = await docRef.get();
    if (snap.exists) {
      const data = snap.data();
      if (data?.encryptedApiKey && data?.iv && data?.authTag) {
        const decryptedKey = decryptSecret({
          encryptedApiKey: data.encryptedApiKey,
          iv: data.iv,
          authTag: data.authTag,
          keyVersion: data.keyVersion,
        });
        const item = {
          apiKey: decryptedKey,
          suffix: data.keySuffix || decryptedKey.slice(-4),
          verifiedAt: data.verifiedAt,
        };
        userSessionKeyMap.set(uid, item);
        return item;
      }
    }
  } catch (adminErr) {
    console.warn('[Firestore Admin Get] Notice:', adminErr);
  }

  return null;
}

// Remove user integration document
async function removeUserIntegration(idToken: string | undefined, uid: string): Promise<void> {
  userSessionKeyMap.delete(uid);

  if (idToken) {
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/${firestoreDatabaseId || '(default)'}/documents/users/${uid}/integrations/youtube`;
      await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${idToken}` },
      });
    } catch {
      // ignore
    }
  }

  try {
    const docRef = db.collection('users').doc(uid).collection('integrations').doc('youtube');
    await docRef.delete();
  } catch {
    // ignore
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

interface QueryConfig {
  id: string;
  q: string;
  max_results?: number;
  order?: 'relevance' | 'date' | 'rating' | 'title' | 'viewCount';
  relevance_language?: string;
  region_code?: string;
  published_after?: string;
  published_before?: string;
  safe_search?: 'none' | 'moderate' | 'strict';
}

interface YamlDefaults {
  max_results?: number;
  order?: 'relevance' | 'date' | 'rating' | 'title' | 'viewCount';
  type?: string;
  safe_search?: 'none' | 'moderate' | 'strict';
}

interface YamlSearchInput {
  version?: number;
  defaults?: YamlDefaults;
  queries: QueryConfig[];
}

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

const ALLOWED_ORDERS = ['relevance', 'date', 'rating', 'title', 'viewCount'] as const;
const ALLOWED_SAFE_SEARCH = ['none', 'moderate', 'strict'] as const;

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

export function validateParsedYaml(data: unknown): { valid: boolean; errors: string[]; parsed?: YamlSearchInput } {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['YAML must be an object with a queries list.'] };
  }

  const obj = data as Partial<YamlSearchInput>;

  if (!('queries' in obj)) {
    return { valid: false, errors: ['Missing required "queries" list in YAML.'] };
  }

  if (!Array.isArray(obj.queries)) {
    return { valid: false, errors: ['"queries" property must be a list/array.'] };
  }

  if (obj.queries.length === 0) {
    return { valid: false, errors: ['"queries" must contain at least one query item.'] };
  }

  // Validate defaults if present
  if (obj.defaults) {
    if (typeof obj.defaults !== 'object' || Array.isArray(obj.defaults)) {
      errors.push('"defaults" must be an object/mapping.');
    } else {
      if (obj.defaults.max_results !== undefined) {
        const mr = Number(obj.defaults.max_results);
        if (!Number.isInteger(mr) || mr < 1 || mr > 50) {
          errors.push('defaults.max_results must be an integer between 1 and 50.');
        }
      }
      if (obj.defaults.order !== undefined && !ALLOWED_ORDERS.includes(obj.defaults.order as any)) {
        errors.push(`defaults.order must be one of: ${ALLOWED_ORDERS.join(', ')}.`);
      }
      if (obj.defaults.safe_search !== undefined && !ALLOWED_SAFE_SEARCH.includes(obj.defaults.safe_search as any)) {
        errors.push(`defaults.safe_search must be one of: ${ALLOWED_SAFE_SEARCH.join(', ')}.`);
      }
    }
  }

  const seenIds = new Set<string>();

  obj.queries.forEach((q, index) => {
    const prefix = `Query #${index + 1}`;
    if (!q || typeof q !== 'object') {
      errors.push(`${prefix} is not a valid object.`);
      return;
    }

    if (!q.id || typeof q.id !== 'string' || q.id.trim() === '') {
      errors.push(`${prefix} is missing a non-empty string "id".`);
    } else {
      const cleanId = q.id.trim();
      if (seenIds.has(cleanId)) {
        errors.push(`Duplicate query id "${cleanId}" detected.`);
      } else {
        seenIds.add(cleanId);
      }
    }

    if (q.q === undefined || q.q === null || typeof q.q !== 'string' || q.q.trim() === '') {
      errors.push(`${prefix} (${q.id || 'unnamed'}) is missing a non-empty query string "q".`);
    }

    if (q.max_results !== undefined) {
      const mr = Number(q.max_results);
      if (!Number.isInteger(mr) || mr < 1 || mr > 50) {
        errors.push(`${prefix} (${q.id || 'unnamed'}): max_results must be an integer between 1 and 50.`);
      }
    }

    if (q.order !== undefined && !ALLOWED_ORDERS.includes(q.order as any)) {
      errors.push(`${prefix} (${q.id || 'unnamed'}): order must be one of: ${ALLOWED_ORDERS.join(', ')}.`);
    }

    if (q.safe_search !== undefined && !ALLOWED_SAFE_SEARCH.includes(q.safe_search as any)) {
      errors.push(`${prefix} (${q.id || 'unnamed'}): safe_search must be one of: ${ALLOWED_SAFE_SEARCH.join(', ')}.`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    parsed: errors.length === 0 ? (obj as YamlSearchInput) : undefined,
  };
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

  // Test the key against YouTube Data API v3
  const testResult = await testYouTubeApiKey(apiKey);
  if (!testResult.valid) {
    res.status(400).json({ error: testResult.error || 'The YouTube API key could not be verified.' });
    return;
  }

  // Encrypt the key with AES-256-GCM
  const enc = encryptSecret(apiKey);
  const suffix = apiKey.slice(-4);
  const now = new Date().toISOString();
  const uid = req.user!.uid;

  // Immediately store in session cache
  userSessionKeyMap.set(uid, {
    apiKey,
    suffix,
    verifiedAt: now,
  });

  // Persist encrypted payload asynchronously to Firestore
  await persistUserIntegration(req.idToken, uid, {
    encryptedApiKey: enc.encryptedApiKey,
    iv: enc.iv,
    authTag: enc.authTag,
    keyVersion: enc.keyVersion,
    keySuffix: suffix,
    verifiedAt: now,
    updatedAt: now,
  });

  console.log(`[YouTube Key] Configured key for user ${uid}, suffix: ${suffix}`);
  res.json({
    success: true,
    suffix,
  });
});

// DELETE /api/settings/youtube-api-key: Removes the authenticated user's YouTube API key
app.delete('/api/settings/youtube-api-key', requireAuth, async (req: Request, res: Response) => {
  try {
    const uid = req.user!.uid;
    await removeUserIntegration(req.idToken, uid);
    console.log(`[YouTube Key] Removed key for user ${uid}`);
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
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to list query sets' });
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
    const { name, rawYaml, queryCount } = req.body || {};
    if (typeof rawYaml !== 'string') {
      return res.status(400).json({ error: 'Missing rawYaml in request body' });
    }
    const created = await firestoreService.createQuerySet(
      req.idToken!,
      req.user!.uid,
      name || 'Untitled Query Set',
      rawYaml,
      Number(queryCount || 0)
    );
    res.json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create query set' });
  }
});

// PUT /api/query-sets/:id - Update existing query set
app.put('/api/query-sets/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, rawYaml, queryCount } = req.body || {};
    const updated = await firestoreService.updateQuerySet(req.idToken!, req.user!.uid, req.params.id, {
      name,
      rawYaml,
      queryCount: queryCount !== undefined ? Number(queryCount) : undefined,
    });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update query set' });
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
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to rename query set' });
  }
});

// DELETE /api/query-sets/:id - Delete query set (Search runs remain intact)
app.delete('/api/query-sets/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    await firestoreService.deleteQuerySet(req.idToken!, req.user!.uid, req.params.id);
    res.json({ success: true, message: 'Query set deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete query set' });
  }
});

// --- SEARCH RUNS REST API ---

// GET /api/search-runs - List search runs metadata (newest first, lightweight)
app.get('/api/search-runs', requireAuth, async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit || 50);
    const runs = await firestoreService.listSearchRuns(req.idToken!, req.user!.uid, limit);
    res.json(runs);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to list search runs' });
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
  } catch (e) {
    console.warn('[SearchRun Init Warning]:', e);
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

// Setup Vite in Dev or Static in Production
async function setupServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT} (0.0.0.0)`);
  });
}

setupServer();
