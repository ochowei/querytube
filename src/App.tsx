/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { Header, AppTab } from './components/Header';
import { SearchWorkspace } from './components/SearchWorkspace';
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
import { authenticatedFetch } from './utils/authenticatedFetch';
import { resolveSearchRunSource, type SearchRunAssociation } from './utils/searchRunSource';
import { validateYamlString, SAMPLE_YAMLS, ValidationResult } from './utils/yamlValidator';
import { QuerySet, SearchRun, SearchRunDetails, ApiDocsNavigationContext, ResourceVisibility } from './types';
import { AlertCircle, X, Terminal, CheckCircle2, Loader2 } from 'lucide-react';

export default function App() {
  const { user, authState, authError, getIdToken, expireSession } = useAuth();
  const authenticatedUid = authState === 'authenticated' ? user?.uid ?? null : null;

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<AppTab>('search');
  const [apiDocsContext, setApiDocsContext] = useState<ApiDocsNavigationContext>({});

  const handleTabChange = (tab: AppTab) => {
    if (tab === 'docs') {
      setApiDocsContext({});
    }
    setActiveTab(tab);
  };

  const handleNavigateToDocs = (context: ApiDocsNavigationContext) => {
    setApiDocsContext({
      userId: user?.uid,
      ...context,
    });
    setActiveTab('docs');
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
  const [userApiKeyStatusError, setUserApiKeyStatusError] = useState<string | null>(null);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState<boolean>(false);

  // Query Sets persistence state
  const [querySets, setQuerySets] = useState<QuerySet[]>([]);
  const [loadingQuerySets, setLoadingQuerySets] = useState<boolean>(false);
  const [querySetsError, setQuerySetsError] = useState<string | null>(null);
  const [activeQuerySet, setActiveQuerySet] = useState<QuerySet | null>(null);
  const [activeQuerySetOriginalYaml, setActiveQuerySetOriginalYaml] = useState<string | null>(null);
  const [historicalQuerySetAssociation, setHistoricalQuerySetAssociation] = useState<SearchRunAssociation | null>(null);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState<boolean>(false);
  const [isSaveAsMode, setIsSaveAsMode] = useState<boolean>(false);

  // Search Runs persistence state
  const [searchRuns, setSearchRuns] = useState<SearchRun[]>([]);
  const [loadingSearchRuns, setLoadingSearchRuns] = useState<boolean>(false);
  const [searchRunsError, setSearchRunsError] = useState<string | null>(null);

  // Notifications
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [manualValidationNotice, setManualValidationNotice] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const initialDataAbortRef = useRef<AbortController | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const dataGenerationRef = useRef(0);

  const isCurrentUser = (uid: string, generation?: number) =>
    currentUserIdRef.current === uid &&
    (generation === undefined || dataGenerationRef.current === generation);

  const authenticatedApiFetch = (
    input: RequestInfo | URL,
    init: RequestInit = {},
    expectedUid = user?.uid
  ) => {
    if (!expectedUid) throw new Error('Authentication is not ready.');
    return authenticatedFetch(input, init, getIdToken, () => expireSession(expectedUid));
  };

  useLayoutEffect(() => {
    if (currentUserIdRef.current === authenticatedUid) return;

    currentUserIdRef.current = authenticatedUid;
    dataGenerationRef.current += 1;
    initialDataAbortRef.current?.abort();
    initialDataAbortRef.current = null;
    abortControllerRef.current?.abort();

    // Clear every user-owned value before the next user's UI is painted.
    setUserApiKeyStatus(null);
    setUserApiKeyStatusError(null);
    setCheckingKeyStatus(false);
    setQuerySets([]);
    setQuerySetsError(null);
    setLoadingQuerySets(false);
    setActiveQuerySet(null);
    setActiveQuerySetOriginalYaml(null);
    setHistoricalQuerySetAssociation(null);
    setSearchRuns([]);
    setSearchRunsError(null);
    setLoadingSearchRuns(false);
    setYamlInput(SAMPLE_YAMLS.default.yaml);
    setOutputYaml('');
    setOutputData(null);
    setProgressQueries([]);
    setCompletedCount(0);
    setIsRunning(false);
    setApiDocsContext({});
    setIsSaveModalOpen(false);
    setIsSaveAsMode(false);
    setGlobalError(null);
    setSuccessNotice(null);
    setManualValidationNotice(null);
    setIsKeyModalOpen(false);
  }, [authenticatedUid]);

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
  const fetchUserApiKeyStatus = async (
    uid = user?.uid,
    generation = dataGenerationRef.current,
    signal?: AbortSignal
  ) => {
    if (!uid) return;
    setCheckingKeyStatus(true);
    setUserApiKeyStatusError(null);
    try {
      const res = await authenticatedApiFetch('/api/settings/youtube-api-key', { signal }, uid);
      if (!isCurrentUser(uid, generation)) return;

      if (res.ok) {
        const data = await res.json();
        if (!isCurrentUser(uid, generation)) return;
        setUserApiKeyStatus({
          configured: Boolean(data.configured),
          suffix: data.suffix,
          verifiedAt: data.verifiedAt,
        });
      } else {
        throw new Error('Failed to load YouTube API key settings.');
      }
    } catch (error) {
      if (isCurrentUser(uid, generation) && !signal?.aborted) {
        console.error('[Settings] Failed to load YouTube API key status.');
        setUserApiKeyStatusError('Failed to load YouTube API key settings.');
      }
    } finally {
      if (isCurrentUser(uid, generation)) setCheckingKeyStatus(false);
    }
  };

  // Fetch Query Sets
  const fetchQuerySets = async (
    uid = user?.uid,
    generation = dataGenerationRef.current,
    signal?: AbortSignal
  ) => {
    if (!uid) return;
    setLoadingQuerySets(true);
    setQuerySetsError(null);
    try {
      const res = await authenticatedApiFetch('/api/query-sets', { signal }, uid);
      if (!isCurrentUser(uid, generation)) return;

      if (res.ok) {
        const list = await res.json();
        if (!Array.isArray(list)) throw new Error('Invalid query sets response.');
        if (!isCurrentUser(uid, generation)) return;
        setQuerySets(list);
      } else {
        throw new Error(`Query sets request failed (${res.status}).`);
      }
    } catch (err) {
      if (isCurrentUser(uid, generation) && !signal?.aborted) {
        console.error('[QuerySets] Failed to load Query Sets.');
        setQuerySetsError('Failed to load Query Sets. Retry.');
      }
    } finally {
      if (isCurrentUser(uid, generation)) setLoadingQuerySets(false);
    }
  };

  // Fetch Search Runs
  const fetchSearchRuns = async (
    uid = user?.uid,
    generation = dataGenerationRef.current,
    signal?: AbortSignal
  ) => {
    if (!uid) return;
    setLoadingSearchRuns(true);
    setSearchRunsError(null);
    try {
      const res = await authenticatedApiFetch('/api/search-runs?limit=50', { signal }, uid);
      if (!isCurrentUser(uid, generation)) return;

      if (res.ok) {
        const list = await res.json();
        if (!Array.isArray(list)) throw new Error('Invalid search runs response.');
        if (!isCurrentUser(uid, generation)) return;
        setSearchRuns(list);
      } else {
        throw new Error(`Search runs request failed (${res.status}).`);
      }
    } catch (err) {
      if (isCurrentUser(uid, generation) && !signal?.aborted) {
        console.error('[SearchRuns] Failed to load search runs.');
        setSearchRunsError('Failed to load search history. Retry.');
      }
    } finally {
      if (isCurrentUser(uid, generation)) setLoadingSearchRuns(false);
    }
  };

  useEffect(() => {
    if (authState !== 'authenticated' || !user) return;

    const uid = user.uid;
    const generation = dataGenerationRef.current;
    const controller = new AbortController();
    initialDataAbortRef.current = controller;
    console.info(`[App] Loading authenticated data for uid=${uid.slice(0, 6)}`);

    void Promise.all([
      fetchUserApiKeyStatus(uid, generation, controller.signal),
      fetchQuerySets(uid, generation, controller.signal),
      fetchSearchRuns(uid, generation, controller.signal),
    ]);

    return () => {
      controller.abort();
      if (initialDataAbortRef.current === controller) initialDataAbortRef.current = null;
    };
  }, [authState, user?.uid]);

  // YouTube API Key handlers
  const handleSaveUserKey = async (apiKey: string): Promise<{ success: boolean; error?: string }> => {
    const ownerUid = user?.uid;
    if (!ownerUid) {
      return { success: false, error: 'Your session has expired. Please sign in again.' };
    }

    try {
      const res = await authenticatedApiFetch('/api/settings/youtube-api-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey }),
      }, ownerUid);

      const data = await res.json();

      if (res.ok && data.success) {
        if (!isCurrentUser(ownerUid)) return { success: false, error: 'Your session changed. Please try again.' };
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
    const ownerUid = user?.uid;
    if (!ownerUid) return false;

    try {
      const res = await authenticatedApiFetch('/api/settings/youtube-api-key', {
        method: 'DELETE',
      }, ownerUid);

      if (res.ok) {
        if (!isCurrentUser(ownerUid)) return false;
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
    setHistoricalQuerySetAssociation(null);
    setYamlInput(SAMPLE_YAMLS.default.yaml);
    setOutputYaml('');
    setOutputData(null);
    setProgressQueries([]);
    setSuccessNotice('Started a new YAML Search Definition.');
    setTimeout(() => setSuccessNotice(null), 3000);
  };

  const handleLoadQuerySet = (qs: QuerySet) => {
    setActiveQuerySet(qs);
    setActiveQuerySetOriginalYaml(qs.rawYaml);
    setHistoricalQuerySetAssociation(null);
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
    const ownerUid = user?.uid;
    if (!ownerUid) return;

    try {
      const res = await authenticatedApiFetch(`/api/query-sets/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          rawYaml: yamlInput,
          queryCount: validation.queryCount,
        }),
      }, ownerUid);

      if (res.ok) {
        const updated = await res.json();
        if (!isCurrentUser(ownerUid)) return;
        setActiveQuerySet(updated);
        setActiveQuerySetOriginalYaml(yamlInput);
        setHistoricalQuerySetAssociation(null);
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
    const ownerUid = user?.uid;
    if (!ownerUid) throw new Error('Your session has expired. Please sign in again.');

    try {
      const res = await authenticatedApiFetch('/api/query-sets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          rawYaml: yamlInput,
          queryCount: validation.queryCount,
        }),
      }, ownerUid);

      if (res.ok) {
        const created = await res.json();
        if (!isCurrentUser(ownerUid)) return;
        setActiveQuerySet(created);
        setActiveQuerySetOriginalYaml(yamlInput);
        setHistoricalQuerySetAssociation(null);
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
    const ownerUid = user?.uid;
    if (!ownerUid) return;

    try {
      const res = await authenticatedApiFetch(`/api/query-sets/${id}/rename`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newName }),
      }, ownerUid);

      if (res.ok) {
        const updated = await res.json();
        if (!isCurrentUser(ownerUid)) return;
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
    const ownerUid = user?.uid;
    if (!ownerUid) return;

    try {
      const res = await authenticatedApiFetch(`/api/query-sets/${id}`, {
        method: 'DELETE',
      }, ownerUid);

      if (res.ok) {
        if (!isCurrentUser(ownerUid)) return;
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
    const ownerUid = user?.uid;
    if (!ownerUid) throw new Error('Session expired. Please sign in again.');

    const res = await authenticatedApiFetch(`/api/query-sets/${id}/public-api`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ publicApiEnabled: enabled }),
    }, ownerUid);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update Public API setting.');
    }

    const updated: QuerySet = await res.json();
    if (!isCurrentUser(ownerUid)) return;
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
    const ownerUid = user?.uid;
    if (!ownerUid) return null;

    try {
      const res = await authenticatedApiFetch(`/api/search-runs/${runId}`, {}, ownerUid);
      if (res.ok) {
        const details = (await res.json()) as SearchRunDetails;
        return isCurrentUser(ownerUid) ? details : null;
      }
    } catch (err) {
      console.error('Failed to load run details:', err);
    }
    return null;
  };

  const handleDeleteRun = async (runId: string): Promise<void> => {
    const ownerUid = user?.uid;
    if (!ownerUid) return;

    try {
      const res = await authenticatedApiFetch(`/api/search-runs/${runId}`, {
        method: 'DELETE',
      }, ownerUid);

      if (res.ok) {
        if (!isCurrentUser(ownerUid)) return;
        setSearchRuns((prev) => prev.filter((r) => r.id !== runId));
        setSuccessNotice('Search run deleted.');
        setTimeout(() => setSuccessNotice(null), 3000);
      }
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to delete search run.');
    }
  };

  const handleToggleSearchRunVisibility = async (runId: string, visibility: ResourceVisibility) => {
    const ownerUid = user?.uid;
    if (!ownerUid) throw new Error('Session expired. Please sign in again.');

    const res = await authenticatedApiFetch(`/api/search-runs/${runId}/visibility`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ visibility }),
    }, ownerUid);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update visibility.');
    }

    const updated: SearchRun = await res.json();
    if (!isCurrentUser(ownerUid)) return;
    setSearchRuns((prev) => prev.map((r) => (r.id === runId ? { ...r, visibility: updated.visibility } : r)));
    setSuccessNotice(
      visibility === 'public'
        ? 'Search run marked as Public. Public API is now accessible.'
        : 'Search run marked as Private. Public API access is disabled.'
    );
    setTimeout(() => setSuccessNotice(null), 3000);
  };

  const handleRunAgain = (
    inputYaml: string,
    querySetId?: string | null,
    querySetName?: string | null
  ) => {
    setYamlInput(inputYaml);
    const source = resolveSearchRunSource(querySets, { querySetId, querySetName });
    setActiveQuerySet(source.querySet);
    setActiveQuerySetOriginalYaml(source.originalYaml);
    setHistoricalQuerySetAssociation(source.association);

    setActiveTab('search');
    void handleRunSearch(inputYaml, source.association.querySetId, source.association.querySetName);
  };

  // --- Manual Validation ---

  const handleManualValidate = async () => {
    if (!validation.valid) {
      setManualValidationNotice(`Validation failed with ${validation.errors.length} error(s). See details below.`);
      setTimeout(() => setManualValidationNotice(null), 4500);
      return;
    }

    const ownerUid = user?.uid;
    if (!ownerUid) {
      setGlobalError('Your session has expired. Please sign in again.');
      return;
    }

    try {
      const res = await authenticatedApiFetch('/api/youtube/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ yaml: yamlInput }),
      }, ownerUid);
      if (!isCurrentUser(ownerUid)) return;

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

    const ownerUid = user?.uid;
    if (!ownerUid) {
      setGlobalError('Your session has expired. Please sign in again.');
      return;
    }

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
      querySetId: overrideQuerySetId !== undefined
        ? overrideQuerySetId
        : activeQuerySet?.id ?? historicalQuerySetAssociation?.querySetId ?? null,
      querySetName: overrideQuerySetName !== undefined
        ? overrideQuerySetName
        : activeQuerySet?.name ?? historicalQuerySetAssociation?.querySetName ?? null,
    };

    try {
      const response = await authenticatedApiFetch('/api/youtube/search?stream=true', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(requestPayload),
        signal: controller.signal,
      }, ownerUid);
      if (!isCurrentUser(ownerUid)) return;

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
        if (!isCurrentUser(ownerUid)) break;
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
              void fetchSearchRuns(ownerUid, dataGenerationRef.current);
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
      if (isCurrentUser(ownerUid)) {
        if (err.name === 'AbortError') {
          setGlobalError('Search stopped by user.');
        } else {
          setGlobalError(err.message || 'Failed to execute search. Check your network or server status.');
        }
      }
    } finally {
      if (isCurrentUser(ownerUid)) setIsRunning(false);
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
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
        <p className="text-xs text-zinc-500 mt-1 font-mono">
          {authError || 'Authenticating session...'}
        </p>
      </div>
    );
  }

  // Unauthenticated Login state
  if (authState === 'unauthenticated') {
    return <LoginPage />;
  }

  return (
    <div className={`min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-red-500/20 selection:text-red-200 ${activeTab === 'search' ? 'search-shell' : ''}`}>
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
      <main className="app-main flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col gap-4">
        {(globalError || successNotice || manualValidationNotice) && (
          <div className="search-notices flex flex-col gap-4">
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
          </div>
        )}

        {/* Tab 1: Search View */}
        {activeTab === 'search' && (
          <div className="search-view flex-1 flex flex-col gap-4">
            {userApiKeyStatusError && (
              <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-amber-800/60 bg-amber-950/30 p-3 text-xs text-amber-200">
                <span>{userApiKeyStatusError}</span>
                <button
                  type="button"
                  onClick={() => void fetchUserApiKeyStatus()}
                  disabled={checkingKeyStatus}
                  className="rounded-md bg-amber-900/50 px-2.5 py-1.5 font-semibold hover:bg-amber-900 disabled:opacity-50"
                >
                  Retry
                </button>
              </div>
            )}

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

            <SearchWorkspace
              editor={
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
              }
              results={
                <>
                  {/* Query Progress Monitor (visible during or after search) */}
                  {progressQueries.length > 0 && (
                    <div className="search-monitor space-y-2">
                      <div className="flex items-center justify-between gap-2">
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
                      <div className="search-monitor-content">
                        <QueryStatusList
                          queries={progressQueries}
                          isRunning={isRunning}
                          completedCount={completedCount}
                          totalCount={progressQueries.length}
                        />
                      </div>
                    </div>
                  )}
                  <YamlViewer
                    outputYaml={outputYaml}
                    outputData={outputData}
                    isRunning={isRunning}
                  />
                </>
              }
            />
          </div>
        )}

        {/* Tab 2: Queries View */}
        {activeTab === 'queries' && (
          <QueriesView
            key={user?.uid}
            querySets={querySets}
            loading={loadingQuerySets}
            error={querySetsError}
            onRetry={() => void fetchQuerySets()}
            onLoadQuerySet={handleLoadQuerySet}
            onCreateNew={() => {
              handleNewQuerySet();
              setActiveTab('search');
            }}
            onRenameQuerySet={handleRenameQuerySet}
            onDeleteQuerySet={handleDeleteQuerySet}
            onTogglePublicApi={handleTogglePublicApi}
            onNavigateToDocs={handleNavigateToDocs}
            currentUserId={user?.uid}
          />
        )}

        {/* Tab 3: History View */}
        {activeTab === 'history' && (
          <HistoryView
            key={user?.uid}
            searchRuns={searchRuns}
            loading={loadingSearchRuns}
            error={searchRunsError}
            onRefresh={() => void fetchSearchRuns()}
            onLoadRunDetails={handleLoadRunDetails}
            onRunAgain={handleRunAgain}
            onDeleteRun={handleDeleteRun}
            onToggleVisibility={handleToggleSearchRunVisibility}
            onNavigateToDocs={handleNavigateToDocs}
            currentUserId={user?.uid}
          />
        )}

        {/* Tab 4: API Docs View */}
        {activeTab === 'docs' && (
          <ApiDocsView
            userId={apiDocsContext.userId}
            querySetId={apiDocsContext.querySetId}
            runId={apiDocsContext.runId}
            targetOperationId={apiDocsContext.targetOperationId}
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
