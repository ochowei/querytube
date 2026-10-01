import React, { createContext, useContext, useEffect, useState } from 'react';
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        if (currentUser) {
          setUser(currentUser);
          setAuthState('authenticated');
        } else {
          setUser(null);
          setAuthState('unauthenticated');
        }
      },
      (error) => {
        console.error('Firebase Auth observer error:', error);
        setUser(null);
        setAuthState('unauthenticated');
        setAuthError(error.message);
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
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setAuthState('unauthenticated');
      setUser(null);
      return null;
    }

    try {
      return await currentUser.getIdToken(forceRefresh);
    } catch (err: any) {
      console.error('Failed to obtain fresh ID token:', err);
      // If refresh fails, session has expired
      await signOut(auth).catch(() => {});
      setUser(null);
      setAuthState('unauthenticated');
      setAuthError('Your session has expired. Please sign in again.');
      return null;
    }
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
