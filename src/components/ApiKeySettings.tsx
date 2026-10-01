import React, { useState } from 'react';
import {
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Trash2,
  RefreshCw,
  X,
  ExternalLink,
} from 'lucide-react';

export interface UserApiKeyStatus {
  configured: boolean;
  suffix?: string;
  verifiedAt?: string | null;
}

interface ApiKeySettingsProps {
  status: UserApiKeyStatus | null;
  loading: boolean;
  onSaveKey: (key: string) => Promise<{ success: boolean; error?: string }>;
  onDeleteKey: () => Promise<boolean>;
  isOpen?: boolean;
  onClose?: () => void;
  inline?: boolean;
}

export const ApiKeySettings: React.FC<ApiKeySettingsProps> = ({
  status,
  loading,
  onSaveKey,
  onDeleteKey,
  isOpen = true,
  onClose,
  inline = false,
}) => {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isReplacing, setIsReplacing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!apiKeyInput.trim()) {
      setErrorMessage('Please enter a YouTube API key.');
      return;
    }

    setErrorMessage(null);
    setIsVerifying(true);

    try {
      const result = await onSaveKey(apiKeyInput.trim());
      // Immediately wipe the plaintext key from state
      setApiKeyInput('');
      setShowPassword(false);

      if (result.success) {
        setIsReplacing(false);
      } else {
        setErrorMessage(result.error || 'The YouTube API key could not be verified.');
      }
    } catch (err: any) {
      setApiKeyInput('');
      setErrorMessage(err.message || 'Verification failed. Please check network.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const ok = await onDeleteKey();
      if (ok) {
        setShowDeleteConfirm(false);
        setIsReplacing(false);
        setApiKeyInput('');
        setErrorMessage(null);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  const content = (
    <div className="space-y-4">
      {/* Configured State (and not in the middle of replacing) */}
      {status?.configured && !isReplacing ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-zinc-950/70 border border-zinc-800 rounded-xl">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-zinc-200">YouTube API Key</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-950/50 border border-emerald-800/40 px-2 py-0.5 rounded">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  Configured
                </span>
              </div>
              <div className="text-xs font-mono text-zinc-400 tracking-wider">
                ••••••••••••<span className="text-zinc-100 font-bold">{status.suffix || '••••'}</span>
              </div>
              {status.verifiedAt && (
                <div className="text-[10px] text-zinc-500 font-mono">
                  Verified: {new Date(status.verifiedAt).toLocaleString()}
                </div>
              )}
            </div>

            {/* Actions: Replace / Remove */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsReplacing(true);
                  setErrorMessage(null);
                  setApiKeyInput('');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
                <span>Replace API Key</span>
              </button>

              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-850 hover:bg-red-950/60 border border-zinc-800 hover:border-red-900/50 text-zinc-400 hover:text-red-300 text-xs font-medium transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove</span>
              </button>
            </div>
          </div>

          {/* Delete Confirmation Modal/Prompt */}
          {showDeleteConfirm && (
            <div className="p-4 bg-red-950/40 border border-red-900/60 rounded-xl space-y-3 animate-in fade-in duration-150">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold text-red-200">
                    Remove your YouTube API key?
                  </h4>
                  <p className="text-[11px] text-red-300/90 mt-0.5 leading-relaxed">
                    You will not be able to run searches until another key is configured.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Removing...</span>
                    </>
                  ) : (
                    <span>Remove</span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Not Configured or Replacing State */
        <form onSubmit={handleSave} className="space-y-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-zinc-200">
                {isReplacing ? 'Replace YouTube API Key' : 'YouTube API Key required'}
              </h3>
              {isReplacing && (
                <button
                  type="button"
                  onClick={() => {
                    setIsReplacing(false);
                    setApiKeyInput('');
                    setErrorMessage(null);
                  }}
                  className="text-xs text-zinc-400 hover:text-zinc-200 underline font-mono cursor-pointer"
                >
                  Keep current key
                </button>
              )}
            </div>
            <p className="text-xs text-zinc-400">
              This application uses your own YouTube Data API quota. Your key is tested, encrypted with AES-256-GCM, and never stored in plaintext.
            </p>
          </div>

          {/* Key Input Field with Show/Hide toggle */}
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="Paste your YouTube Data API key (e.g. AIzaSy...)"
              disabled={isVerifying}
              autoComplete="off"
              spellCheck={false}
              className="w-full pr-10 pl-3.5 py-2.5 bg-zinc-950 border border-zinc-700 rounded-xl text-xs font-mono text-zinc-100 placeholder-zinc-500 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/50 transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 transition-colors p-1"
              title={showPassword ? 'Hide key' : 'Show key'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Error feedback if verification or save fails */}
          {errorMessage && (
            <div className="p-3 bg-red-950/50 border border-red-900/60 rounded-xl text-xs text-red-200 flex items-start gap-2.5 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-red-300">Unable to Configure Key</p>
                <p className="text-red-200/90 text-[11px] leading-relaxed">{errorMessage}</p>
                <a
                  href="https://console.cloud.google.com/apis/library/youtube.googleapis.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300 underline font-mono mt-1"
                >
                  Enable YouTube Data API v3 in Cloud Console
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-zinc-500 font-mono">
              Key is validated via YouTube API before saving
            </span>

            <button
              type="submit"
              disabled={isVerifying || !apiKeyInput.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Testing &amp; Encrypting...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Save &amp; Verify</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );

  if (inline) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 shadow-sm">
        {content}
      </div>
    );
  }

  // Modal / Drawer container
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-500">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">YouTube Data API Settings</h2>
              <p className="text-[11px] text-zinc-400">Manage your private YouTube API key</p>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-8 flex flex-col items-center justify-center text-zinc-500">
            <Loader2 className="w-6 h-6 animate-spin text-red-500 mb-2" />
            <p className="text-xs">Loading API key settings...</p>
          </div>
        ) : (
          content
        )}
      </div>
    </div>
  );
};
