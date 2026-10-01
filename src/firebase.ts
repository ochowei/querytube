import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  browserLocalPersistence,
  setPersistence,
} from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Explicitly persist authentication in browser local storage
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn('Failed to set Firebase auth persistence:', err);
});

export const googleProvider = new GoogleAuthProvider();
// Only request basic identity info (profile, email)
googleProvider.setCustomParameters({ prompt: 'select_account' });
