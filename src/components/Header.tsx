import React from 'react';
import {
  Youtube,
  Search,
  FolderCode,
  History,
  Settings,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserApiKeyStatus } from './ApiKeySettings';

export type AppTab = 'search' | 'queries' | 'history';

interface HeaderProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  keyStatus: UserApiKeyStatus | null;
  checkingKey: boolean;
  onOpenKeySettings: () => void;
  querySetsCount?: number;
  historyCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  keyStatus,
  checkingKey,
  onOpenKeySettings,
  querySetsCount = 0,
  historyCount = 0,
}) => {
  const { user, signOutUser } = useAuth();

  return (
    <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-4">
        {/* Brand & Nav */}
        <div className="flex items-center gap-6">
          {/* Brand */}
          <div
            onClick={() => onTabChange('search')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-500 shadow-sm flex-shrink-0 group-hover:scale-105 transition-transform">
              <Youtube className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-bold text-zinc-100 tracking-tight group-hover:text-red-400 transition-colors">
                  QueryTube
                </span>
                <span className="text-[10px] font-mono text-zinc-400 bg-zinc-800 px-1 py-0.2 rounded border border-zinc-700">
                  v1.2
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800">
            <button
              type="button"
              onClick={() => onTabChange('search')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'search'
                  ? 'bg-zinc-800 text-zinc-100 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search</span>
            </button>

            <button
              type="button"
              onClick={() => onTabChange('queries')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'queries'
                  ? 'bg-zinc-800 text-zinc-100 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
              }`}
            >
              <FolderCode className="w-3.5 h-3.5" />
              <span>Queries</span>
              {querySetsCount > 0 && (
                <span className="text-[10px] font-mono bg-zinc-700/80 px-1.5 py-0.2 rounded-full text-zinc-300">
                  {querySetsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => onTabChange('history')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-zinc-800 text-zinc-100 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>History</span>
              {historyCount > 0 && (
                <span className="text-[10px] font-mono bg-zinc-700/80 px-1.5 py-0.2 rounded-full text-zinc-300">
                  {historyCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={onOpenKeySettings}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850 transition-colors cursor-pointer"
              title="YouTube API Key Settings"
            >
              <Settings className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Settings</span>
            </button>
          </nav>
        </div>

        {/* Right Section: API Key Status & Profile */}
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap sm:flex-nowrap">
          {/* User's YouTube Data API Key Status Badge */}
          <button
            type="button"
            onClick={onOpenKeySettings}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono transition-all cursor-pointer shadow-xs active:scale-[0.98]"
            title="Manage your private YouTube API key"
          >
            {checkingKey ? (
              <span className="text-zinc-400 text-[11px]">Checking...</span>
            ) : keyStatus?.configured ? (
              <div className="flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-semibold text-[11px]">••••{keyStatus.suffix || '••••'}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-amber-300">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <span className="font-semibold text-[11px]">Key Required</span>
              </div>
            )}
            <KeyRound className="w-3 h-3 text-zinc-500 ml-0.5" />
          </button>

          {/* User profile & Sign out */}
          {user && (
            <div className="flex items-center gap-2.5 pl-2 sm:pl-3 sm:border-l sm:border-zinc-800">
              {/* User Avatar + Name & Email */}
              <div className="flex items-center gap-2">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-7 h-7 rounded-full border border-zinc-700 object-cover flex-shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 flex-shrink-0">
                    <UserIcon className="w-3.5 h-3.5" />
                  </div>
                )}
                <div className="text-left leading-tight hidden xs:block">
                  <div className="text-xs font-semibold text-zinc-200 max-w-[110px] sm:max-w-[140px] truncate">
                    {user.displayName || 'Google User'}
                  </div>
                </div>
              </div>

              {/* Sign out button */}
              <button
                type="button"
                onClick={signOutUser}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white text-[11px] font-medium transition-colors cursor-pointer"
                title="Sign out of your account"
              >
                <LogOut className="w-3 h-3" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
