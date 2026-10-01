/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Header, AppTab } from './components/Header';
import { YamlEditor } from './components/YamlEditor';
import { YamlViewer } from './components/YamlViewer';
import { QueryStatusList, QueryProgressItem } from './components/QueryStatusList';
import { LoginPage } from './components/LoginPage';
import { ApiKeySettings, UserApiKeyStatus } from './components/ApiKeySettings';
import { QueriesView } from './components/QueriesView';
import { HistoryView } from './components/HistoryView';
import { ApiDocsView } from './components/ApiDocsView';
import { SaveQuerySetModal } from './components/SaveQuerySetModal';
import { useAuth } from './context/AuthContext';
import { validateYamlString, SAMPLE_YAMLS, ValidationResult } from './utils/yamlValidator';
import { QuerySet, SearchRun, SearchRunDetails } from './types';
import { AlertCircle, X, Terminal, CheckCircle2, Loader2 } from 'lucide-react';

export default function App() {
  const { user, authState, getIdToken, setAuthError } = useAuth();

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<AppTab>('search');
  const [apiDocsContext, setApiDocsContext] = useState<{
    userId?: string;
    querySetId?: string;
  }>({});

  const handleTabChange = (tab: AppTab) => {
    if (tab === 'docs') {
      setApiDocsContext({});
    }
    setActiveTab(tab);
  };

  // YAML editor & execution state
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

  // Query Sets persistence state
  const [querySets, setQuerySets] = useState<QuerySet[]>([]);
  const [loadingQuerySets, setLoadingQuerySets] = useState<boolean>(false);
  const [activeQuerySet, setActiveQuerySet] = useState<QuerySet | null>(null);
  const [activeQuerySetOriginalYaml, setActiveQuerySetOriginalYaml] = useState<string | null>(null);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState<boolean>(false);
  const [isSaveAsMode, setIsSaveAsMode] = useState<boolean>(false);

  // Search Runs persistence state
  const [searchRuns, setSearchRuns] = useState<SearchRun[]>([]);
  const [loadingSearchRuns, setLoadingSearchRuns] = useState<boolean>(false);

  // Notifications
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [manualValidationNotice, setManualValidationNotice] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Real-time YAML validation
  const validation: ValidationResult = useMemo(() => {
    return validateYamlString(yamlInput);
  }, [yamlInput]);

  // Track unsaved changes in current Query Set
  const hasUnsavedChanges = useMemo(() => {
    if (!activeQuerySet) return false;
    return yamlInput !== activeQuerySetOriginalYaml;
  }, [activeQuerySet, yamlInput, activeQuerySetOriginalYaml]);

  // Fetch YouTube API Key status
  const fetchUserApiKeyStatus = async () => {
    setCheckingKeyStatus(true);
    try {
      const token = await getIdToken();
      if (!token) return;

      const res = await fetch('/api/settings/youtube-api-key', {
        headers: { Authorization: `Bearer ${token}` },
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

  // Fetch Query Sets
  const fetchQuerySets = async () => {
    setLoadingQuerySets(true);
    try {
      const token = await getIdToken();
      if (!token) return;

      const res = await fetch('/api/query-sets', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const list = await res.json();
        setQuerySets(Array.isArray(list) ? list : []);
      }
    } catch (err) {
      console.error('Failed to fetch query sets:', err);
    } finally {
      setLoadingQuerySets(false);
    }
  };

  // Fetch Search Runs
  const fetchSearchRuns = async () => {
    setLoadingSearchRuns(true);
    try {
      const token = await getIdToken();
      if (!token) return;

      const res = await fetch('/api/search-runs?limit=50', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const list = await res.json();
        setSearchRuns(Array.isArray(list) ? list : []);
      }
    } catch (err) {
      console.error('Failed to fetch search runs:', err);
    } finally {
      setLoadingSearchRuns(false);
    }
  };

  useEffect(() => {
    if (authState === 'authenticated') {
      fetchUserApiKeyStatus();
      fetchQuerySets();
      fetchSearchRuns();
    }
  }, [authState]);

  // YouTube API Key handlers
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
        setSuccessNotice(`YouTube API key (••••${data.suffix}) verified and encrypted!`);
        setTimeout(() => setSuccessNotice(null), 4000);
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

  const handleDeleteUserKey = async (): Promise<boolean> => {
    const token = await getIdToken();
    if (!token) return false;

    try {
      const res = await fetch('/api/settings/youtube-api-key', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setUserApiKeyStatus({ configured: false });
        setSuccessNotice('YouTube API key removed. Searches are disabled until a key is added.');
        setTimeout(() => setSuccessNotice(null), 4000);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  // --- Query Set Handlers ---

  const handleNewQuerySet = () => {
    setActiveQuerySet(null);
    setActiveQuerySetOriginalYaml(null);
    setYamlInput(SAMPLE_YAMLS.default.yaml);
    setOutputYaml('');
    setOutputData(null);
    setProgressQueries([]);
    setSuccessNotice('Started a new query set template.');
    setTimeout(() => setSuccessNotice(null), 3000);
  };

  const handleLoadQuerySet = (qs: QuerySet) => {
    setActiveQuerySet(qs);
    setActiveQuerySetOriginalYaml(qs.rawYaml);
    setYamlInput(qs.rawYaml);
    setOutputYaml('');
    setOutputData(null);
    setProgressQueries([]);
    setActiveTab('search');
    setSuccessNotice(`Loaded Query Set: "${qs.name}"`);
    setTimeout(() => setSuccessNotice(null), 3000);
  };

  const handleTriggerSave = () => {
    if (activeQuerySet) {
      // Direct update of existing Query Set
      executeDirectSave(activeQuerySet.id, activeQuerySet.name);
    } else {
      // First time saving -> open name dialog
      setIsSaveAsMode(false);
      setIsSaveModalOpen(true);
    }
  };

  const handleTriggerSaveAs = () => {
    setIsSaveAsMode(true);
    setIsSaveModalOpen(true);
  };

  const executeDirectSave = async (id: string, name: string) => {
    const token = await getIdToken();
    if (!token) return;

    try {
      const res = await fetch(`/api/query-sets/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          rawYaml: yamlInput,
          queryCount: validation.queryCount,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setActiveQuerySet(updated);
        setActiveQuerySetOriginalYaml(yamlInput);
        setQuerySets((prev) => prev.map((item) => (item.id === id ? updated : item)));
        setSuccessNotice(`Query Set "${name}" saved!`);
        setTimeout(() => setSuccessNotice(null), 3500);
      } else {
        const err = await res.json();
        setGlobalError(err.error || 'Failed to update query set.');
      }
    } catch (err: any) {
      setGlobalError(err.message || 'Error updating query set.');
    }
  };

  const handleSaveModalConfirm = async (name: string) => {
    const token = await getIdToken();
    if (!token) return;

    try {
      const res = await fetch('/api/query-sets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          rawYaml: yamlInput,
          queryCount: validation.queryCount,
        }),
      });

      if (res.ok) {
        const created = await res.json();
        setActiveQuerySet(created);
        setActiveQuerySetOriginalYaml(yamlInput);
        setQuerySets((prev) => [created, ...prev]);
        setSuccessNotice(`Saved as new Query Set: "${name}"`);
        setTimeout(() => setSuccessNotice(null), 3500);
      } else {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save query set.');
      }
    } catch (err: any) {
      throw err;
    }
  };

  const handleRenameQuerySet = async (id: string, newName: string) => {
    const token = await getIdToken();
    if (!token) return;

    try {
      const res = await fetch(`/api/query-sets/${id}/rename`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newName }),
      });

      if (res.ok) {
        const updated = await res.json();
        setQuerySets((prev) => prev.map((qs) => (qs.id === id ? { ...qs, name: newName } : qs)));
        if (activeQuerySet?.id === id) {
          setActiveQuerySet(updated);
        }
        setSuccessNotice(`Renamed to "${newName}"`);
        setTimeout(() => setSuccessNotice(null), 3000);
      }
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to rename query set.');
    }
  };

  const handleDeleteQuerySet = async (id: string) => {
    const token = await getIdToken();
    if (!token) return;

    try {
      const res = await fetch(`/api/query-sets/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setQuerySets((prev) => prev.filter((qs) => qs.id !== id));
        if (activeQuerySet?.id === id) {
          setActiveQuerySet(null);
          setActiveQuerySetOriginalYaml(null);
        }
        setSuccessNotice('Query Set deleted.');
        setTimeout(() => setSuccessNotice(null), 3000);
      }
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to delete query set.');
    }
  };

  const handleTogglePublicApi = async (id: string, enabled: boolean) => {
    const token = await getIdToken();
    if (!token) throw new Error('Session expired. Please sign in again.');

    const res = await fetch(`/api/query-sets/${id}/public-api`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ publicApiEnabled: enabled }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update Public API setting.');
    }

    const updated: QuerySet = await res.json();
    setQuerySets((prev) => prev.map((qs) => (qs.id === id ? updated : qs)));
    if (activeQuerySet?.id === id) {
      setActiveQuerySet(updated);
    }
    setSuccessNotice(
      enabled
        ? `Public API enabled for "${updated.name}"`
        : `Public API disabled for "${updated.name}"`
    );
    setTimeout(() => setSuccessNotice(null), 3000);
  };

  // --- Search Runs Handlers ---

  const handleLoadRunDetails = async (runId: string): Promise<SearchRunDetails | null> => {
    const token = await getIdToken();
    if (!token) return null;

    try {
      const res = await fetch(`/api/search-runs/${runId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        return (await res.json()) as SearchRunDetails;
      }
    } catch (err) {
      console.error('Failed to load run details:', err);
    }
    return null;
  };

  const handleDeleteRun = async (runId: string): Promise<void> => {
    const token = await getIdToken();
    if (!token) return;

    try {
      const res = await fetch(`/api/search-runs/${runId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setSearchRuns((prev) => prev.filter((r) => r.id !== runId));
        setSuccessNotice('Search run deleted.');
        setTimeout(() => setSuccessNotice(null), 3000);
      }
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to delete search run.');
    }
  };

  const handleRunAgain = (
    inputYaml: string,
    querySetId?: string | null,
    querySetName?: string | null
  ) => {
    setYamlInput(inputYaml);
    if (querySetId) {
      const existing = querySets.find((q) => q.id === querySetId);
      if (existing) {
        setActiveQuerySet(existing);
        setActiveQuerySetOriginalYaml(existing.rawYaml);
      } else {
        setActiveQuerySet({
          id: querySetId,
          name: querySetName || 'Historical Query Set',
          rawYaml: inputYaml,
          queryCount: validation.queryCount,
          publicApiEnabled: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        setActiveQuerySetOriginalYaml(inputYaml);
      }
    } else {
      setActiveQuerySet(null);
      setActiveQuerySetOriginalYaml(null);
    }

    setActiveTab('search');
    // Execute search with brief tick to ensure state sync
    setTimeout(() => {
      handleRunSearch(inputYaml, querySetId, querySetName);
    }, 50);
  };

  // --- Manual Validation ---

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

  // --- Run Search Execution ---

  const handleRunSearch = async (
    overrideYaml?: string,
    overrideQuerySetId?: string | null,
    overrideQuerySetName?: string | null
  ) => {
    if (isRunning) return;

    if (!userApiKeyStatus?.configured) {
      setGlobalError('Configure your YouTube API key before running a search.');
      setIsKeyModalOpen(true);
      return;
    }

    const targetYaml = overrideYaml || yamlInput;
    const targetValidation = overrideYaml ? validateYamlString(overrideYaml) : validation;

    if (!targetValidation.valid || !targetValidation.parsed || targetValidation.queryCount === 0) {
      setGlobalError('Please fix YAML validation errors before running search.');
      return;
    }

    setGlobalError(null);
    setManualValidationNotice(null);

    const idToken = await getIdToken();
    if (!idToken) {
      setAuthError('Your session has expired. Please sign in again.');
      setGlobalError('Your session has expired. Please sign in again.');
      return;
    }

    setIsRunning(true);

    const queries = targetValidation.parsed.queries;
    const initialProgress: QueryProgressItem[] = queries.map((q) => ({
      id: q.id,
      q: q.q,
      state: 'pending',
    }));

    setProgressQueries(initialProgress);
    setCompletedCount(0);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const requestPayload = {
      yaml: targetYaml,
      querySetId: overrideQuerySetId !== undefined ? overrideQuerySetId : activeQuerySet?.id || null,
      querySetName: overrideQuerySetName !== undefined ? overrideQuerySetName : activeQuerySet?.name || null,
    };

    try {
      let response = await fetch('/api/youtube/search?stream=true', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(requestPayload),
        signal: controller.signal,
      });

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
          body: JSON.stringify(requestPayload),
          signal: controller.signal,
        });
      }

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
              // Refresh search history list asynchronously
              fetchSearchRuns();
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

  // Auth Loading state
  if (authState === 'loading') {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-400">
        <Loader2 className="w-9 h-9 animate-spin text-red-500 mb-4" />
        <h2 className="text-base font-semibold text-zinc-200">QueryTube</h2>
        <p className="text-xs text-zinc-500 mt-1 font-mono">Authenticating session...</p>
      </div>
    );
  }

  // Unauthenticated Login state
  if (authState === 'unauthenticated') {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-red-500/20 selection:text-red-200">
      {/* Top Navigation & Status */}
      <Header
        activeTab={activeTab}
        onTabChange={handleTabChange}
        keyStatus={userApiKeyStatus}
        checkingKey={checkingKeyStatus}
        onOpenKeySettings={() => setIsKeyModalOpen(true)}
        querySetsCount={querySets.length}
        historyCount={searchRuns.length}
      />

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col gap-4">
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

        {/* Success Notice */}
        {successNotice && (
          <div className="bg-emerald-950/40 border border-emerald-900/60 p-3 rounded-lg text-xs text-emerald-200 flex items-center justify-between gap-3 shadow-sm animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span className="font-mono">{successNotice}</span>
            </div>
            <button
              onClick={() => setSuccessNotice(null)}
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

        {/* Tab 1: Search View */}
        {activeTab === 'search' && (
          <div className="flex-1 flex flex-col gap-4">
            {/* Inline setup warning if user has NO API key configured */}
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
              {/* Left Column: Input YAML with Query Set Bar */}
              <section className="flex flex-col h-full min-h-[460px]">
                <YamlEditor
                  value={yamlInput}
                  onChange={setYamlInput}
                  validation={validation}
                  onValidate={handleManualValidate}
                  onRunSearch={() => handleRunSearch()}
                  isRunning={isRunning}
                  apiKeyConfigured={userApiKeyStatus?.configured ?? null}
                  onOpenKeySettings={() => setIsKeyModalOpen(true)}
                  activeQuerySet={activeQuerySet}
                  hasUnsavedChanges={hasUnsavedChanges}
                  onNew={handleNewQuerySet}
                  onSave={handleTriggerSave}
                  onSaveAs={handleTriggerSaveAs}
                />
              </section>

              {/* Right Column: Output YAML & Video Card Preview */}
              <section className="flex flex-col h-full min-h-[460px]">
                <YamlViewer
                  outputYaml={outputYaml}
                  outputData={outputData}
                  isRunning={isRunning}
                />
              </section>
            </div>
          </div>
        )}

        {/* Tab 2: Queries View */}
        {activeTab === 'queries' && (
          <QueriesView
            querySets={querySets}
            loading={loadingQuerySets}
            onLoadQuerySet={handleLoadQuerySet}
            onCreateNew={() => {
              handleNewQuerySet();
              setActiveTab('search');
            }}
            onRenameQuerySet={handleRenameQuerySet}
            onDeleteQuerySet={handleDeleteQuerySet}
            onTogglePublicApi={handleTogglePublicApi}
            onNavigateToDocs={(querySetId) => {
              setApiDocsContext({ userId: user?.uid, querySetId });
              setActiveTab('docs');
            }}
            currentUserId={user?.uid}
          />
        )}

        {/* Tab 3: History View */}
        {activeTab === 'history' && (
          <HistoryView
            searchRuns={searchRuns}
            loading={loadingSearchRuns}
            onRefresh={fetchSearchRuns}
            onLoadRunDetails={handleLoadRunDetails}
            onRunAgain={handleRunAgain}
            onDeleteRun={handleDeleteRun}
          />
        )}

        {/* Tab 4: API Docs View */}
        {activeTab === 'docs' && (
          <ApiDocsView
            userId={apiDocsContext.userId}
            querySetId={apiDocsContext.querySetId}
          />
        )}
      </main>

      {/* Save / Save-As Query Set Modal */}
      <SaveQuerySetModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        onSave={handleSaveModalConfirm}
        initialName={isSaveAsMode ? (activeQuerySet?.name ? `${activeQuerySet.name} (Copy)` : '') : ''}
        isSaveAs={isSaveAsMode}
      />

      {/* API Key Settings Modal */}
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
