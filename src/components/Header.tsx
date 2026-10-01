import React from 'react';
import { Youtube, KeyRound, CheckCircle2, AlertTriangle, LogOut, User as UserIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserApiKeyStatus } from './ApiKeySettings';

interface HeaderProps {
  keyStatus: UserApiKeyStatus | null;
  checkingKey: boolean;
  onOpenKeySettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  keyStatus,
  checkingKey,
  onOpenKeySettings,
}) => {
  const { user, signOutUser } = useAuth();

  return (
    <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-500 shadow-sm flex-shrink-0">
            <Youtube className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-zinc-100 tracking-tight">
                YouTube YAML Search
              </h1>
              <span className="text-[11px] font-mono text-zinc-400 bg-zinc-800/80 px-1.5 py-0.5 rounded border border-zinc-700/60">
                v1.1
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Batch multi-query YouTube search engine using your own API quota
            </p>
          </div>
        </div>

        {/* Right Section: User's YouTube API Key Status & Profile */}
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap sm:flex-nowrap">
          {/* User's YouTube Data API Key Status Badge */}
          <button
            type="button"
            onClick={onOpenKeySettings}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all cursor-pointer shadow-xs active:scale-[0.98]"
            title="Manage your private YouTube API key"
          >
            {checkingKey ? (
              <span className="text-zinc-400">Checking API key...</span>
            ) : keyStatus?.configured ? (
              <div className="flex items-center gap-1.5 text-emerald-400 border-emerald-800/50 bg-emerald-950/30">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-semibold">Key: ••••{keyStatus.suffix || '••••'}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-amber-300 border-amber-800/60 bg-amber-950/40 animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <span className="font-semibold">Configure API Key</span>
              </div>
            )}
            <KeyRound className="w-3 h-3 text-zinc-400 ml-0.5" />
          </button>

          {/* User profile & Sign out */}
          {user && (
            <div className="flex items-center gap-3 pl-2 sm:pl-3 sm:border-l sm:border-zinc-800">
              {/* User Avatar + Name & Email */}
              <div className="flex items-center gap-2.5">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-8 h-8 rounded-full border border-zinc-700 object-cover flex-shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 flex-shrink-0">
                    <UserIcon className="w-4 h-4" />
                  </div>
                )}
                <div className="text-left leading-tight hidden xs:block">
                  <div className="text-xs font-semibold text-zinc-200 max-w-[130px] sm:max-w-[170px] truncate">
                    {user.displayName || 'Google User'}
                  </div>
                  <div className="text-[11px] text-zinc-400 max-w-[130px] sm:max-w-[170px] truncate font-mono">
                    {user.email || ''}
                  </div>
                </div>
              </div>

              {/* Sign out button */}
              <button
                type="button"
                onClick={signOutUser}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-medium transition-colors cursor-pointer shadow-xs active:scale-[0.98]"
                title="Sign out of your account"
              >
                <LogOut className="w-3.5 h-3.5 text-zinc-400" />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
