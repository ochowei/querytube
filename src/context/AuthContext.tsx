import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

export type AuthState = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextType {
  user: User | null;
  authState: AuthState;
  authError: string | null;
  setAuthError: (err: string | null) => void;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
  expireSession: (expectedUid: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [authError, setAuthError] = useState<string | null>(null);
  const hasReceivedInitialAuthState = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        const isInitialState = !hasReceivedInitialAuthState.current;
        hasReceivedInitialAuthState.current = true;

        if (currentUser) {
          setUser(currentUser);
          setAuthState('authenticated');
        } else {
          setUser(null);
          setAuthState('unauthenticated');
        }

        if (isInitialState) {
          console.info(`[Auth] Firebase session restored, authenticated=${Boolean(currentUser)}`);
        }
        setAuthError(null);
      },
      () => {
        // An observer failure does not prove the persisted session is invalid.
        // Keep the app in its initialization state instead of guessing logged out.
        console.error('[Auth] Firebase auth observer failed during initialization.');
        setAuthError('Unable to initialize Firebase authentication. Please reload the page.');
      }
    );

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      // Don't show scary error if user deliberately closed popup
      if (err.code === 'auth/popup-closed-by-user') {
        return;
      }
      if (err.code === 'auth/cancelled-popup-request') {
        return;
      }
      console.error('Sign-in error:', err);
      setAuthError(err.message || 'Google sign-in failed. Please try again.');
    }
  };

  const signOutUser = async () => {
    setAuthError(null);
    try {
      await signOut(auth);
    } catch (err: any) {
      console.error('Sign-out error:', err);
      setAuthError(err.message || 'Failed to sign out.');
    }
  };

  const getIdToken = async (forceRefresh = false): Promise<string | null> => {
    // Use the user delivered by the auth observer. auth.currentUser can still be
    // null while Firebase is restoring persistence on the first page load.
    const currentUser = user;
    if (!currentUser || authState !== 'authenticated') return null;

    try {
      return await currentUser.getIdToken(forceRefresh);
    } catch {
      // A transient token refresh failure is not enough to clear a valid session.
      console.error('[Auth] Failed to obtain Firebase ID token.');
      return null;
    }
  };

  const expireSession = (expectedUid: string) => {
    // Only expire the session that received two consecutive API 401 responses.
    // A delayed response from a previous account must not sign out a new user.
    if (auth.currentUser?.uid !== expectedUid) return;
    setAuthError('Your session has expired. Please sign in again.');
    void signOut(auth).catch(() => {
      console.error('[Auth] Failed to clear an expired Firebase session.');
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        authState,
        authError,
        setAuthError,
        signInWithGoogle,
        signOutUser,
        getIdToken,
        expireSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
