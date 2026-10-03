import crypto from 'crypto';
import { firebaseProjectId, firestoreDatabaseId } from './firebaseAdmin.js';

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
  const envKey = process.env.USER_API_KEY_ENCRYPTION_KEY;
  if (!envKey) {
    throw new Error('USER_API_KEY_ENCRYPTION_KEY is required to encrypt or decrypt YouTube API keys.');
  }
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

// Persistence: Save encrypted integration to Firestore with REST API (user token)
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
  if (!idToken) {
    return;
  }

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

    if (!res.ok) {
      console.warn('[Firestore REST Save] Notice:', res.status, await res.text());
    }
  } catch (e) {
    console.warn('[Firestore REST Save] Notice:', e);
  }
}

// Helper: Load and decrypt the authenticated user's YouTube API key
export async function getUserYouTubeApiKey(
  idToken: string | undefined,
  uid: string
): Promise<{ apiKey: string; suffix: string; verifiedAt?: string } | null> {
  // 1. Fast active session cache
  const cached = userSessionKeyMap.get(uid);
  if (cached) {
    return cached;
  }

  // 2. Query Firestore REST API with the user's ID token
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
      } else if (res.status === 404) {
        // Document does not exist yet (key has not been configured)
        return null;
      }
    } catch (e) {
      console.warn('[Firestore REST Get] Notice:', e);
    }
  }

  return null;
}

// Remove user integration document
export async function removeUserYouTubeApiKey(idToken: string | undefined, uid: string): Promise<void> {
  userSessionKeyMap.delete(uid);

  if (idToken) {
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/${firestoreDatabaseId || '(default)'}/documents/users/${uid}/integrations/youtube`;
      await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${idToken}` },
      });
    } catch (e) {
      console.warn('[Firestore REST Delete] Notice:', e);
    }
  }
}

export type ConfigureYouTubeApiKeyResult =
  | { configured: true; suffix: string }
  | { configured: false; error?: string };

// Configure a route-validated, trimmed key without exposing crypto or storage details.
export async function configureUserYouTubeApiKey(
  idToken: string | undefined,
  uid: string,
  apiKey: string
): Promise<ConfigureYouTubeApiKeyResult> {
  // Test the key against YouTube Data API v3
  const testResult = await testYouTubeApiKey(apiKey);
  if (!testResult.valid) {
    return { configured: false, error: testResult.error };
  }

  // Encrypt the key with AES-256-GCM
  const enc = encryptSecret(apiKey);
  const suffix = apiKey.slice(-4);
  const now = new Date().toISOString();

  // Immediately store in session cache
  userSessionKeyMap.set(uid, {
    apiKey,
    suffix,
    verifiedAt: now,
  });

  // Await best-effort persistence after populating the session cache
  await persistUserIntegration(idToken, uid, {
    encryptedApiKey: enc.encryptedApiKey,
    iv: enc.iv,
    authTag: enc.authTag,
    keyVersion: enc.keyVersion,
    keySuffix: suffix,
    verifiedAt: now,
    updatedAt: now,
  });

  return { configured: true, suffix };
}
