import React, { useState } from 'react';
import { SearchRun, SearchRunDetails, ApiDocsNavigationContext, ResourceVisibility } from '../types';
import {
  History,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Layers,
  Video,
  Download,
  RotateCw,
  Eye,
  Trash2,
  Search as SearchIcon,
  Loader2,
  RefreshCw,
  FileCode,
  Globe,
  Lock,
  BookOpen,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';
import { SearchRunDetailModal } from './SearchRunDetailModal';

interface HistoryViewProps {
  searchRuns: SearchRun[];
  loading: boolean;
  error?: string | null;
  onRefresh: () => void;
  onLoadRunDetails: (runId: string) => Promise<SearchRunDetails | null>;
  onRunAgain: (inputYaml: string, querySetId?: string | null, querySetName?: string | null) => void;
  onDeleteRun: (runId: string) => Promise<void>;
  onToggleVisibility?: (runId: string, visibility: ResourceVisibility) => Promise<void>;
  onNavigateToDocs?: (context: ApiDocsNavigationContext) => void;
  currentUserId?: string | null;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  searchRuns,
  loading,
  error,
  onRefresh,
  onLoadRunDetails,
  onRunAgain,
  onDeleteRun,
  onToggleVisibility,
  onNavigateToDocs,
  currentUserId,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeModalRun, setActiveModalRun] = useState<SearchRunDetails | null>(null);
  const [loadingRunId, setLoadingRunId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [togglingVisibilityId, setTogglingVisibilityId] = useState<string | null>(null);
  const [visibilityError, setVisibilityError] = useState<{ id: string; error: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredRuns = searchRuns.filter((run) => {
    const term = searchTerm.toLowerCase();
    const nameMatch = (run.querySetName || 'ad-hoc').toLowerCase().includes(term);
    const dateMatch = run.startedAt.toLowerCase().includes(term);
    const statusMatch = run.status.toLowerCase().includes(term);
    const visibilityMatch = (run.visibility || 'private').toLowerCase().includes(term);
    return nameMatch || dateMatch || statusMatch || visibilityMatch;
  });

  const handleOpenRun = async (runId: string) => {
    setLoadingRunId(runId);
    try {
      const details = await onLoadRunDetails(runId);
      if (details) {
        setActiveModalRun(details);
      }
    } finally {
      setLoadingRunId(null);
    }
  };

  const handleDownloadYaml = async (runId: string, runName?: string | null) => {
    setLoadingRunId(runId);
    try {
      const details = await onLoadRunDetails(runId);
      if (!details || !details.outputYaml) return;

      const blob = new Blob([details.outputYaml], { type: 'text/yaml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeName = (runName || 'search_results')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_');
      link.download = `querytube_${safeName}_${runId}.yaml`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setLoadingRunId(null);
    }
  };

  const handleDelete = async (runId: string) => {
    setIsDeleting(true);
    try {
      await onDeleteRun(runId);
      setDeleteConfirmId(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleVisibility = async (runId: string, currentVis: ResourceVisibility) => {
    if (!onToggleVisibility) return;
    const nextVis: ResourceVisibility = currentVis === 'public' ? 'private' : 'public';
    setTogglingVisibilityId(runId);
    setVisibilityError(null);
    try {
      await onToggleVisibility(runId, nextVis);
      if (activeModalRun && activeModalRun.id === runId) {
        setActiveModalRun({ ...activeModalRun, visibility: nextVis });
      }
    } catch (err: any) {
      setVisibilityError({ id: runId, error: err.message || 'Failed to update visibility' });
    } finally {
      setTogglingVisibilityId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-zinc-800">
        <div>
          <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <History className="w-5 h-5 text-red-500" />
            <span>Search History</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Manage search results and control independent Public API access
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Search Filter */}
          <div className="relative flex-1 sm:w-64">
            <SearchIcon className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter history..."
              className="w-full pl-9 pr-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-red-500/80 transition-colors"
            />
          </div>

          {/* Results List Public API Entrance */}
          {currentUserId && onNavigateToDocs && (
            <button
              type="button"
              onClick={() => onNavigateToDocs({
                userId: currentUserId,
                targetOperationId: 'listPublicSearchRuns',
              })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-300 hover:text-white text-xs font-medium transition-colors cursor-pointer flex-shrink-0"
              title="Open Public Search Runs API endpoint documentation"
            >
              <BookOpen className="w-3.5 h-3.5 text-red-500" />
              <span>Public API</span>
            </button>
          )}

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
            title="Refresh history"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-amber-800/60 bg-amber-950/30 p-3 text-xs text-amber-200">
          <span>{error}</span>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md bg-amber-900/50 px-2.5 py-1.5 font-semibold hover:bg-amber-900 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Retry
          </button>
        </div>
      )}

      {/* Loading Indicator */}
      {loading && searchRuns.length === 0 ? (
        <div className="py-16 flex flex-col items-center justify-center text-zinc-500">
          <Loader2 className="w-8 h-8 animate-spin text-red-500 mb-3" />
          <p className="text-xs font-mono">Loading search history...</p>
        </div>
      ) : error && searchRuns.length === 0 ? null : filteredRuns.length === 0 ? (
        /* Empty State */
        <div className="py-16 px-4 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-xl bg-zinc-800/60 border border-zinc-700/50 flex items-center justify-center text-zinc-500">
            <FileCode className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-zinc-200">
            {searchTerm ? 'No matching search runs found' : 'No search runs recorded yet'}
          </h3>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            {searchTerm
              ? 'Try adjusting your search terms.'
              : 'Every time you execute a batch search from the Search tab, a run record and its results will be saved here.'}
          </p>
        </div>
      ) : (
        /* List of Search Runs */
        <div className="space-y-3">
          {filteredRuns.map((run) => {
            const isTargetDeleting = deleteConfirmId === run.id;
            const isLoadingThis = loadingRunId === run.id;
            const isPublic = run.visibility === 'public';
            const isToggling = togglingVisibilityId === run.id;

            return (
              <div
                key={run.id}
                className="p-4 bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700/80 rounded-xl flex flex-col gap-3 transition-all shadow-sm group"
              >
                {/* Main Row: Info & Top Actions */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  {/* Left: Info */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      {/* Timestamp */}
                      <span className="text-xs text-zinc-400 font-mono flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-zinc-500" />
                        {formatDate(run.startedAt)}
                      </span>

                      {/* Query Set Name */}
                      <span className="text-xs font-semibold text-zinc-100 truncate max-w-[260px]">
                        {run.querySetName || 'Ad-hoc YAML Search'}
                      </span>

                      {/* Status Badge */}
                      {run.status === 'completed' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 px-1.5 py-0.5 rounded">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          Completed
                        </span>
                      ) : run.status === 'partial' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-300 bg-amber-950/60 border border-amber-800/50 px-1.5 py-0.5 rounded">
                          <AlertTriangle className="w-3 h-3 text-amber-400" />
                          Partial
                        </span>
                      ) : run.status === 'running' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-400 bg-sky-950/60 border border-sky-800/50 px-1.5 py-0.5 rounded">
                          <Loader2 className="w-3 h-3 animate-spin text-sky-400" />
                          Running
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-400 bg-red-950/60 border border-red-800/50 px-1.5 py-0.5 rounded">
                          <XCircle className="w-3 h-3 text-red-400" />
                          Failed
                        </span>
                      )}

                      {/* Visibility Badge */}
                      {isPublic ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-medium text-emerald-400 bg-emerald-950/50 border border-emerald-800/40 px-1.5 py-0.5 rounded">
                          <Globe className="w-2.5 h-2.5" />
                          Public
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-medium text-zinc-400 bg-zinc-800/70 border border-zinc-700/50 px-1.5 py-0.5 rounded">
                          <Lock className="w-2.5 h-2.5 text-zinc-500" />
                          Private
                        </span>
                      )}
                    </div>

                    {/* Metrics */}
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-400 font-mono">
                      <span className="flex items-center gap-1">
                        <Layers className="w-3 h-3 text-zinc-500" />
                        {run.queryCount} {run.queryCount === 1 ? 'query' : 'queries'}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-zinc-300">
                        <Video className="w-3 h-3 text-zinc-500" />
                        <strong className="text-zinc-200">{run.totalResults}</strong> videos found
                      </span>
                      {run.failedQueries > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-red-400">
                            {run.failedQueries} {run.failedQueries === 1 ? 'failure' : 'failures'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  {isTargetDeleting ? (
                    <div className="flex items-center gap-2 p-2 bg-red-950/40 border border-red-900/60 rounded-lg text-xs">
                      <span className="text-red-200 font-medium">Delete run?</span>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(null)}
                        disabled={isDeleting}
                        className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[11px] cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(run.id)}
                        disabled={isDeleting}
                        className="px-2.5 py-0.5 rounded bg-red-600 hover:bg-red-500 text-white text-[11px] font-semibold cursor-pointer"
                      >
                        {isDeleting ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* View Results Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenRun(run.id)}
                        disabled={isLoadingThis}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
                      >
                        {isLoadingThis ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Eye className="w-3.5 h-3.5 text-zinc-400" />
                        )}
                        <span>View Results</span>
                      </button>

                      {/* Download YAML Button */}
                      <button
                        type="button"
                        onClick={() => handleDownloadYaml(run.id, run.querySetName)}
                        disabled={isLoadingThis}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-850 hover:bg-zinc-750 border border-zinc-800 text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
                        title="Download output YAML without calling YouTube API"
                      >
                        <Download className="w-3.5 h-3.5 text-zinc-400" />
                        <span className="hidden sm:inline">YAML</span>
                      </button>

                      {/* Run Again Button */}
                      <button
                        type="button"
                        onClick={() => onRunAgain(run.inputYaml, run.querySetId, run.querySetName)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/90 hover:bg-red-600 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                        title="Execute this exact search again as a new run"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                        <span>Run Again</span>
                      </button>

                      {/* Delete Run Button */}
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(run.id)}
                        className="p-1.5 text-zinc-500 hover:text-red-400 rounded hover:bg-red-950/30 transition-colors cursor-pointer"
                        title="Delete search run and videos"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Bottom Row: Independent Visibility & Public API Access Bar */}
                <div className="pt-2 border-t border-zinc-800/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-400 text-[11px] font-medium">Visibility:</span>

                    {/* Private / Public Toggle Switch */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isPublic}
                        disabled={isToggling}
                        onClick={() => handleToggleVisibility(run.id, run.visibility || 'private')}
                        className={`relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-red-500 disabled:opacity-50 ${
                          isPublic ? 'bg-emerald-600' : 'bg-zinc-700'
                        }`}
                        title={isPublic ? 'Make Private' : 'Make Public'}
                      >
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                            isPublic ? 'translate-x-3.5' : 'translate-x-0'
                          }`}
                        />
                      </button>

                      <span className={`text-[11px] font-medium font-mono ${isPublic ? 'text-emerald-400' : 'text-zinc-400'}`}>
                        {isToggling ? (
                          <span className="flex items-center gap-1 text-zinc-400">
                            <Loader2 className="w-2.5 h-2.5 animate-spin text-red-500" />
                            Updating...
                          </span>
                        ) : isPublic ? (
                          'Public'
                        ) : (
                          'Private'
                        )}
                      </span>
                    </div>

                    {visibilityError?.id === run.id && (
                      <span className="text-[11px] text-red-400 font-medium">
                        {visibilityError.error}
                      </span>
                    )}
                  </div>

                  {/* Public API Action (shown only if Public) */}
                  {isPublic && currentUserId && (
                    <div className="flex items-center gap-1.5 bg-zinc-950/70 border border-emerald-950/60 px-2 py-1 rounded-lg">
                      <span className="text-[10px] font-mono text-zinc-400 truncate max-w-[200px] sm:max-w-[300px]">
                        /api/public/.../search-runs/{run.id}
                      </span>

                      <button
                        type="button"
                        onClick={() => {
                          const url = `${window.location.origin}/api/public/users/${currentUserId}/search-runs/${run.id}`;
                          navigator.clipboard.writeText(url);
                          setCopiedId(run.id);
                          setTimeout(() => setCopiedId(null), 2000);
                        }}
                        className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] cursor-pointer"
                        title="Copy Public API URL"
                      >
                        {copiedId === run.id ? 'Copied' : 'Copy'}
                      </button>

                      {onNavigateToDocs && (
                        <button
                          type="button"
                          onClick={() => onNavigateToDocs({
                            userId: currentUserId,
                            runId: run.id,
                            targetOperationId: 'getPublicSearchRunDetails',
                          })}
                          className="px-2 py-0.5 rounded bg-emerald-950/70 hover:bg-emerald-900/80 border border-emerald-700/60 text-emerald-300 hover:text-white text-[10px] font-semibold cursor-pointer flex items-center gap-1 transition-colors"
                          title="Open Swagger API documentation prefilled with this run"
                        >
                          <BookOpen className="w-2.5 h-2.5 text-emerald-400" />
                          <span>Public API</span>
                        </button>
                      )}

                      <a
                        href={`/api/public/users/${currentUserId}/search-runs/${run.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 cursor-pointer"
                        title="Open public endpoint in browser"
                      >
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      <SearchRunDetailModal
        run={activeModalRun}
        isOpen={Boolean(activeModalRun)}
        onClose={() => setActiveModalRun(null)}
        onRunAgain={onRunAgain}
        onDeleteRun={onDeleteRun}
        onToggleVisibility={onToggleVisibility}
        onNavigateToDocs={onNavigateToDocs}
        currentUserId={currentUserId}
      />
    </div>
  );
};
