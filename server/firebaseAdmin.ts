import 'dotenv/config';
import { applicationDefault, cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const DEFAULT_FIREBASE_PROJECT_ID = 'sapient-spark-z83d0';
const DEFAULT_FIRESTORE_DATABASE_ID = 'ai-studio-youtubeyamlsearc-83e4e646-42fd-44b9-a9a0-7af77ee13b93';
export const isVercelRuntime = process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV);

export const firebaseProjectId = process.env.FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_PROJECT_ID;
export const firestoreDatabaseId = process.env.FIRESTORE_DATABASE_ID || DEFAULT_FIRESTORE_DATABASE_ID;

const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (isVercelRuntime) {
  const missingVariables = [
    ['FIREBASE_PROJECT_ID', process.env.FIREBASE_PROJECT_ID],
    ['FIRESTORE_DATABASE_ID', process.env.FIRESTORE_DATABASE_ID],
    ['FIREBASE_CLIENT_EMAIL', clientEmail],
    ['FIREBASE_PRIVATE_KEY', privateKey],
    ['USER_API_KEY_ENCRYPTION_KEY', process.env.USER_API_KEY_ENCRYPTION_KEY],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missingVariables.length > 0) {
    throw new Error(`Missing required Vercel environment variables: ${missingVariables.join(', ')}`);
  }
}

const credential = clientEmail && privateKey
  ? cert({ projectId: firebaseProjectId, clientEmail, privateKey })
  : applicationDefault();

const adminApp = getApps().length === 0
  ? initializeApp({ credential, projectId: firebaseProjectId })
  : getApp();

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp, firestoreDatabaseId);
