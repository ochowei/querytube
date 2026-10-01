import React, { useState } from 'react';
import { Youtube, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const { signInWithGoogle, authError, setAuthError } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center items-center px-4 selection:bg-red-500/20 selection:text-red-200">
      <div className="w-full max-w-md bg-zinc-900/90 border border-zinc-800 rounded-2xl p-8 sm:p-10 shadow-2xl text-center space-y-6">
        {/* Brand Icon */}
        <div className="mx-auto w-14 h-14 rounded-2xl bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-500 shadow-inner">
          <Youtube className="w-8 h-8" />
        </div>

        {/* Title & Tagline */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            YouTube YAML Search
          </h1>
          <p className="text-sm text-zinc-400">
            Batch search YouTube using YAML-defined queries.
          </p>
        </div>

        {/* Error notification banner if any */}
        {authError && (
          <div className="bg-red-950/50 border border-red-900/60 p-3.5 rounded-xl text-left text-xs text-red-200 flex items-start gap-2.5 animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="font-medium text-red-300 leading-relaxed">{authError}</p>
          </div>
        )}

        {/* Sign in with Google Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleSignIn}
            disabled={isSigningIn}
            className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-xl bg-white hover:bg-zinc-100 text-zinc-900 font-medium text-sm transition-all shadow-md hover:shadow-lg disabled:opacity-60 cursor-pointer active:scale-[0.99]"
          >
            {isSigningIn ? (
              <>
                <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
                <span>Connecting to Google...</span>
              </>
            ) : (
              <>
                {/* Official Google 'G' Icon */}
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Sign in with Google</span>
              </>
            )}
          </button>
        </div>

        {/* Privacy note */}
        <p className="text-[11px] text-zinc-500 pt-2 border-t border-zinc-800/80">
          Only basic identity information (name, email, profile photo) is requested.
        </p>
      </div>
    </div>
  );
};
