/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Header } from './components/Header';
import { YamlEditor } from './components/YamlEditor';
import { YamlViewer } from './components/YamlViewer';
import { QueryStatusList, QueryProgressItem } from './components/QueryStatusList';
import { LoginPage } from './components/LoginPage';
import { ApiKeySettings, UserApiKeyStatus } from './components/ApiKeySettings';
import { useAuth } from './context/AuthContext';
import { validateYamlString, SAMPLE_YAMLS, ValidationResult } from './utils/yamlValidator';
import { AlertCircle, X, Terminal, CheckCircle2, Loader2, KeyRound } from 'lucide-react';

export default function App() {
  const { authState, getIdToken, setAuthError } = useAuth();

  const [yamlInput, setYamlInput] = useState<string>(SAMPLE_YAMLS.default.yaml);
  const [outputYaml, setOutputYaml] = useState<string>('');
  const [outputData, setOutputData] = useState<any | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [progressQueries, setProgressQueries] = useState<QueryProgressItem[]>([]);
  const [completedCount, setCompletedCount] = useState<number>(0);

  // Per-user YouTube API key status
  const [userApiKeyStatus, setUserApiKeyStatus] = useState<UserApiKeyStatus | null>(null);
  const [checkingKeyStatus, setCheckingKeyStatus] = useState<boolean>(false);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState<boolean>(false);

  const [globalError, setGlobalError] = useState<string | null>(null);
  const [manualValidationNotice, setManualValidationNotice] = useState<string | null>(null);
  const [keySuccessNotice, setKeySuccessNotice] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Validate YAML in real-time
  const validation: ValidationResult = useMemo(() => {
    return validateYamlString(yamlInput);
  }, [yamlInput]);

  // Fetch the authenticated user's YouTube API key status from the server
  const fetchUserApiKeyStatus = async () => {
    setCheckingKeyStatus(true);
    try {
      const token = await getIdToken();
      if (!token) return;

      const res = await fetch('/api/settings/youtube-api-key', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setUserApiKeyStatus({
          configured: Boolean(data.configured),
          suffix: data.suffix,
          verifiedAt: data.verifiedAt,
        });
      } else {
        setUserApiKeyStatus({ configured: false });
      }
    } catch {
      setUserApiKeyStatus({ configured: false });
    } finally {
      setCheckingKeyStatus(false);
    }
  };

  useEffect(() => {
    if (authState === 'authenticated') {
      fetchUserApiKeyStatus();
    }
  }, [authState]);

  // Save/Replace key handler
  const handleSaveUserKey = async (apiKey: string): Promise<{ success: boolean; error?: string }> => {
    const token = await getIdToken();
    if (!token) {
      return { success: false, error: 'Your session has expired. Please sign in again.' };
    }

    try {
      const res = await fetch('/api/settings/youtube-api-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ apiKey }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setUserApiKeyStatus({
          configured: true,
          suffix: data.suffix,
          verifiedAt: new Date().toISOString(),
        });
        setKeySuccessNotice(`YouTube API key (••••${data.suffix}) verified and encrypted successfully!`);
        setTimeout(() => setKeySuccessNotice(null), 5000);
        return { success: true };
      }

      return {
        success: false,
        error: data.error || 'The YouTube API key could not be verified.',
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Network error communicating with the server.',
      };
    }
  };

  // Delete key handler
  const handleDeleteUserKey = async (): Promise<boolean> => {
    const token = await getIdToken();
    if (!token) return false;

    try {
      const res = await fetch('/api/settings/youtube-api-key', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        setUserApiKeyStatus({ configured: false });
        setKeySuccessNotice('YouTube API key removed. Searches are disabled until a key is added.');
        setTimeout(() => setKeySuccessNotice(null), 5000);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  // Loading state while Firebase restores session
  if (authState === 'loading') {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-400">
        <Loader2 className="w-9 h-9 animate-spin text-red-500 mb-4" />
        <h2 className="text-base font-semibold text-zinc-200">YouTube YAML Search</h2>
        <p className="text-xs text-zinc-500 mt-1 font-mono">Authenticating session...</p>
      </div>
    );
  }

  // Unauthenticated state shows simple centered login page
  if (authState === 'unauthenticated') {
    return <LoginPage />;
  }

  const handleManualValidate = async () => {
    if (!validation.valid) {
      setManualValidationNotice(`Validation failed with ${validation.errors.length} error(s). See details below.`);
      setTimeout(() => setManualValidationNotice(null), 4500);
      return;
    }

    const token = await getIdToken();
    if (!token) {
      setGlobalError('Your session has expired. Please sign in again.');
      return;
    }

    try {
      const res = await fetch('/api/youtube/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ yaml: yamlInput }),
      });

      if (res.status === 401) {
        const freshToken = await getIdToken(true);
        if (!freshToken) {
          setGlobalError('Your session has expired. Please sign in again.');
          return;
        }
      }

      if (res.ok) {
        const data = await res.json();
        setManualValidationNotice(`Valid YAML: ${data.queriesCount} queries ready.`);
      } else {
        const data = await res.json();
        setManualValidationNotice(
          `Server validation warning: ${data.errors?.join(', ') || 'Validation failed.'}`
        );
      }
    } catch {
      setManualValidationNotice(`Valid YAML: ${validation.queryCount} queries ready.`);
    }

    setTimeout(() => {
      setManualValidationNotice(null);
    }, 4500);
  };

  const handleRunSearch = async () => {
    if (isRunning) return;

    // Check if user has an encrypted API key configured
    if (!userApiKeyStatus?.configured) {
      setGlobalError('Configure your YouTube API key before running a search.');
      setIsKeyModalOpen(true);
      return;
    }

    if (!validation.valid || !validation.parsed || validation.queryCount === 0) {
      setGlobalError('Please fix YAML validation errors before running search.');
      return;
    }

    setGlobalError(null);
    setManualValidationNotice(null);

    // Retrieve fresh authenticated user Firebase ID token
    const idToken = await getIdToken();
    if (!idToken) {
      setAuthError('Your session has expired. Please sign in again.');
      setGlobalError('Your session has expired. Please sign in again.');
      return;
    }

    setIsRunning(true);

    const queries = validation.parsed.queries;
    const initialProgress: QueryProgressItem[] = queries.map((q) => ({
      id: q.id,
      q: q.q,
      state: 'pending',
    }));

    setProgressQueries(initialProgress);
    setCompletedCount(0);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      let response = await fetch('/api/youtube/search?stream=true', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ yaml: yamlInput }),
        signal: controller.signal,
      });

      // Handle 401 token expiration
      if (response.status === 401) {
        const refreshedToken = await getIdToken(true);
        if (!refreshedToken) {
          setAuthError('Your session has expired. Please sign in again.');
          setGlobalError('Your session has expired. Please sign in again.');
          setIsRunning(false);
          return;
        }

        response = await fetch('/api/youtube/search?stream=true', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            Authorization: `Bearer ${refreshedToken}`,
          },
          body: JSON.stringify({ yaml: yamlInput }),
          signal: controller.signal,
        });
      }

      // Handle 428 Precondition Required (API Key missing)
      if (response.status === 428) {
        setUserApiKeyStatus({ configured: false });
        setGlobalError('Configure your YouTube API key before running a search.');
        setIsKeyModalOpen(true);
        setIsRunning(false);
        return;
      }

      if (!response.ok) {
        let errMessage = `Search request failed (HTTP ${response.status})`;
        try {
          const errData = await response.json();
          if (errData?.message) errMessage = errData.message;
          else if (errData?.error) errMessage = errData.error;
        } catch {
          // fallback
        }
        setGlobalError(errMessage);
        setIsRunning(false);
        return;
      }

      if (!response.body) {
        throw new Error('Response body is missing');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          const trimmed = part.trim();
          if (!trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.replace(/^data:\s*/, '');
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);

            if (event.type === 'start') {
              setProgressQueries((prev) =>
                prev.map((item) => ({ ...item, state: 'pending' }))
              );
            } else if (event.type === 'query_start') {
              setProgressQueries((prev) =>
                prev.map((item) =>
                  item.id === event.id ? { ...item, state: 'running' } : item
                )
              );
            } else if (event.type === 'query_success') {
              setCompletedCount((c) => c + 1);
              setProgressQueries((prev) =>
                prev.map((item) =>
                  item.id === event.id
                    ? { ...item, state: 'success', count: event.count }
                    : item
                )
              );
            } else if (event.type === 'query_error') {
              setCompletedCount((c) => c + 1);
              setProgressQueries((prev) =>
                prev.map((item) =>
                  item.id === event.id
                    ? { ...item, state: 'failed', error: event.error }
                    : item
                )
              );
            } else if (event.type === 'complete') {
              if (event.outputYaml) {
                setOutputYaml(event.outputYaml);
              }
              if (event.data) {
                setOutputData(event.data);
              }
            } else if (event.type === 'fatal_error') {
              if (event.error === 'YOUTUBE_API_KEY_REQUIRED') {
                setUserApiKeyStatus({ configured: false });
                setIsKeyModalOpen(true);
              }
              setGlobalError(event.message || event.error);
            }
          } catch (e) {
            console.error('SSE JSON parse error:', e);
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setGlobalError('Search stopped by user.');
      } else {
        setGlobalError(err.message || 'Failed to execute search. Check your network or server status.');
      }
    } finally {
      setIsRunning(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancelSearch = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-red-500/20 selection:text-red-200">
      {/* Top Navigation & Status with Authenticated User Profile */}
      <Header
        keyStatus={userApiKeyStatus}
        checkingKey={checkingKeyStatus}
        onOpenKeySettings={() => setIsKeyModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col gap-4">
        {/* Global Error Notice */}
        {globalError && (
          <div className="bg-red-950/40 border border-red-900/60 p-3 rounded-lg text-xs text-red-200 flex items-start justify-between gap-3 shadow-sm animate-in fade-in duration-200">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-300">Notice</p>
                <p className="text-red-200/90 mt-0.5 font-mono text-[11px] whitespace-pre-wrap">
                  {globalError}
                </p>
              </div>
            </div>
            <button
              onClick={() => setGlobalError(null)}
              className="text-red-400 hover:text-red-200 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Success Notice (e.g. key verified/saved) */}
        {keySuccessNotice && (
          <div className="bg-emerald-950/40 border border-emerald-900/60 p-3 rounded-lg text-xs text-emerald-200 flex items-center justify-between gap-3 shadow-sm animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span className="font-mono">{keySuccessNotice}</span>
            </div>
            <button
              onClick={() => setKeySuccessNotice(null)}
              className="text-emerald-400 hover:text-emerald-200 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Manual Validate Notice */}
        {manualValidationNotice && (
          <div className="bg-emerald-950/40 border border-emerald-900/60 p-3 rounded-lg text-xs text-emerald-200 flex items-center justify-between gap-3 shadow-sm animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span className="font-mono">{manualValidationNotice}</span>
            </div>
            <button
              onClick={() => setManualValidationNotice(null)}
              className="text-emerald-400 hover:text-emerald-200 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Prominent API Key setup banner if user has NO key configured */}
        {userApiKeyStatus?.configured === false && (
          <div className="animate-in fade-in duration-300">
            <ApiKeySettings
              status={userApiKeyStatus}
              loading={checkingKeyStatus}
              onSaveKey={handleSaveUserKey}
              onDeleteKey={handleDeleteUserKey}
              inline={true}
            />
          </div>
        )}

        {/* Query Progress Monitor (Visible during or after search) */}
        {progressQueries.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                <Terminal className="w-3.5 h-3.5 text-zinc-400" />
                <span>Execution Monitor</span>
              </div>
              {isRunning && (
                <button
                  type="button"
                  onClick={handleCancelSearch}
                  className="text-xs text-red-400 hover:text-red-300 underline underline-offset-2 cursor-pointer font-mono"
                >
                  Cancel search
                </button>
              )}
            </div>
            <QueryStatusList
              queries={progressQueries}
              isRunning={isRunning}
              completedCount={completedCount}
              totalCount={progressQueries.length}
            />
          </div>
        )}

        {/* Two-Column Desktop Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 flex-1 min-h-[580px]">
          {/* Left Column: Input YAML */}
          <section className="flex flex-col h-full min-h-[460px]">
            <YamlEditor
              value={yamlInput}
              onChange={setYamlInput}
              validation={validation}
              onValidate={handleManualValidate}
              onRunSearch={handleRunSearch}
              isRunning={isRunning}
              apiKeyConfigured={userApiKeyStatus?.configured ?? null}
              onOpenKeySettings={() => setIsKeyModalOpen(true)}
            />
          </section>

          {/* Right Column: Output YAML */}
          <section className="flex flex-col h-full min-h-[460px]">
            <YamlViewer
              outputYaml={outputYaml}
              outputData={outputData}
              isRunning={isRunning}
            />
          </section>
        </div>
      </main>

      {/* API Key Settings Modal (opened via header badge or replace button) */}
      <ApiKeySettings
        status={userApiKeyStatus}
        loading={checkingKeyStatus}
        onSaveKey={handleSaveUserKey}
        onDeleteKey={handleDeleteUserKey}
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        inline={false}
      />
    </div>
  );
}
