import React, { useState } from 'react';
import { QuerySet, ApiDocsNavigationContext } from '../types';
import {
  FolderCode,
  Plus,
  Edit2,
  Trash2,
  Play,
  Clock,
  Layers,
  Search as SearchIcon,
  Loader2,
  AlertCircle,
  Check,
  X,
  FileCode,
  Globe,
  Copy,
  ExternalLink,
  BookOpen,
  RefreshCw,
} from 'lucide-react';

interface QueriesViewProps {
  querySets: QuerySet[];
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  onLoadQuerySet: (qs: QuerySet) => void;
  onCreateNew: () => void;
  onRenameQuerySet: (id: string, newName: string) => Promise<void>;
  onDeleteQuerySet: (id: string) => Promise<void>;
  onTogglePublicApi?: (id: string, enabled: boolean) => Promise<void>;
  onNavigateToDocs?: (context: ApiDocsNavigationContext) => void;
  currentUserId?: string | null;
}

export const QueriesView: React.FC<QueriesViewProps> = ({
  querySets,
  loading,
  error,
  onRetry,
  onLoadQuerySet,
  onCreateNew,
  onRenameQuerySet,
  onDeleteQuerySet,
  onTogglePublicApi,
  onNavigateToDocs,
  currentUserId,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingRename, setIsSavingRename] = useState(false);
  const [togglingPublicId, setTogglingPublicId] = useState<string | null>(null);
  const [publicToggleError, setPublicToggleError] = useState<{ id: string; error: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredSets = querySets.filter((qs) =>
    qs.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const startRename = (qs: QuerySet) => {
    setEditingId(qs.id);
    setEditName(qs.name);
  };

  const handleSaveRename = async (id: string) => {
    if (!editName.trim()) return;
    setIsSavingRename(true);
    try {
      await onRenameQuerySet(id, editName.trim());
      setEditingId(null);
    } finally {
      setIsSavingRename(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    try {
      await onDeleteQuerySet(id);
      setDeleteConfirmId(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTogglePublic = async (id: string, nextState: boolean) => {
    if (!onTogglePublicApi) return;
    setTogglingPublicId(id);
    setPublicToggleError(null);
    try {
      await onTogglePublicApi(id, nextState);
    } catch (err: any) {
      setPublicToggleError({ id, error: err.message || 'Failed to update Public API setting' });
    } finally {
      setTogglingPublicId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Top Header & Search Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-zinc-800">
        <div>
          <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <FolderCode className="w-5 h-5 text-red-500" />
            <span>My Query Sets</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Manage and load your saved YAML query configurations
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
              placeholder="Filter query sets..."
              className="w-full pl-9 pr-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-red-500/80 transition-colors"
            />
          </div>

          {/* Public API Header Button */}
          {currentUserId && onNavigateToDocs && (
            <button
              type="button"
              onClick={() => onNavigateToDocs({ userId: currentUserId, targetOperationId: 'listPublicQuerySets' })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-300 hover:text-white text-xs font-medium transition-colors cursor-pointer flex-shrink-0"
              title="Open Public Query Sets API in Swagger documentation"
            >
              <BookOpen className="w-3.5 h-3.5 text-red-500" />
              <span>Public API</span>
            </button>
          )}

          {/* New Query Set Button */}
          <button
            type="button"
            onClick={onCreateNew}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer flex-shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Query Set</span>
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-amber-800/60 bg-amber-950/30 p-3 text-xs text-amber-200">
          <span>{error}</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-md bg-amber-900/50 px-2.5 py-1.5 font-semibold hover:bg-amber-900 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Retry
            </button>
          )}
        </div>
      )}

      {/* Loading Indicator */}
      {loading && querySets.length === 0 ? (
        <div className="py-16 flex flex-col items-center justify-center text-zinc-500">
          <Loader2 className="w-8 h-8 animate-spin text-red-500 mb-3" />
          <p className="text-xs font-mono">Loading saved query sets...</p>
        </div>
      ) : error && querySets.length === 0 ? null : filteredSets.length === 0 ? (
        /* Empty State */
        <div className="py-16 px-4 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-xl bg-zinc-800/60 border border-zinc-700/50 flex items-center justify-center text-zinc-500">
            <FileCode className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-zinc-200">
            {searchTerm ? 'No matching query sets found' : 'No saved query sets yet'}
          </h3>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            {searchTerm
              ? 'Try adjusting your search terms.'
              : 'Save your multi-query YAML templates so you can easily reload and rerun them anytime.'}
          </p>
          {!searchTerm && (
            <button
              type="button"
              onClick={onCreateNew}
              className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create your first query set</span>
            </button>
          )}
        </div>
      ) : (
        /* Grid of Query Set Cards */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSets.map((qs) => {
            const isEditing = editingId === qs.id;
            const isDeletingThis = deleteConfirmId === qs.id;

            return (
              <div
                key={qs.id}
                className="bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700/80 rounded-xl p-4 flex flex-col justify-between gap-4 transition-all shadow-sm hover:shadow group"
              >
                {/* Header & Title */}
                <div className="space-y-2">
                  {isEditing ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveRename(qs.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className="flex-1 px-2.5 py-1 bg-zinc-950 border border-red-500 rounded text-xs font-semibold text-zinc-100 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveRename(qs.id)}
                        disabled={isSavingRename}
                        className="p-1 rounded bg-red-600 hover:bg-red-500 text-white cursor-pointer"
                        title="Save rename"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="p-1 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 cursor-pointer"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-zinc-100 line-clamp-1 group-hover:text-red-400 transition-colors">
                        {qs.name}
                      </h3>
                      <button
                        type="button"
                        onClick={() => startRename(qs)}
                        className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-zinc-300 p-1 rounded transition-opacity"
                        title="Rename query set"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {/* Metadata Chips */}
                  <div className="flex items-center gap-3 text-[11px] text-zinc-400 font-mono">
                    <span className="flex items-center gap-1 bg-zinc-800/80 px-2 py-0.5 rounded border border-zinc-700/50 text-zinc-300">
                      <Layers className="w-3 h-3 text-zinc-400" />
                      {qs.queryCount} {qs.queryCount === 1 ? 'query' : 'queries'}
                    </span>
                    <span className="flex items-center gap-1 text-zinc-500">
                      <Clock className="w-3 h-3" />
                      Updated {formatDate(qs.updatedAt)}
                    </span>
                  </div>

                  {/* Public API Toggle Box */}
                  <div className="mt-3 pt-3 border-t border-zinc-800/70 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-0.5 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-zinc-200">Public API</span>
                          {qs.publicApiEnabled ? (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Enabled
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-mono font-medium bg-zinc-800 text-zinc-400 border border-zinc-700/50">
                              Disabled
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-400 leading-snug">
                          Allow this Query Set and its search runs to be accessed through the public read-only API.
                        </p>
                      </div>

                      {/* Toggle Switch Button */}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={Boolean(qs.publicApiEnabled)}
                        disabled={togglingPublicId === qs.id}
                        onClick={() => handleTogglePublic(qs.id, !qs.publicApiEnabled)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-red-500 disabled:opacity-50 mt-0.5 ${
                          qs.publicApiEnabled ? 'bg-emerald-600' : 'bg-zinc-700'
                        }`}
                        title={qs.publicApiEnabled ? 'Disable Public API' : 'Enable Public API'}
                      >
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                            qs.publicApiEnabled ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Loading feedback */}
                    {togglingPublicId === qs.id && (
                      <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 font-mono">
                        <Loader2 className="w-3 h-3 animate-spin text-red-500" />
                        <span>Updating Public API setting...</span>
                      </div>
                    )}

                    {/* Error message */}
                    {publicToggleError?.id === qs.id && (
                      <p className="text-[11px] text-red-400 font-medium">
                        {publicToggleError.error}
                      </p>
                    )}

                    {/* Public Endpoint Helper when enabled */}
                    {qs.publicApiEnabled && currentUserId && (
                      <div className="p-1.5 rounded bg-zinc-950/80 border border-zinc-800 flex items-center justify-between gap-1 text-[10px] font-mono text-zinc-400">
                        <span className="truncate" title={`/api/public/users/${currentUserId}/query-sets/${qs.id}`}>
                          /api/public/users/{currentUserId.slice(0, 8)}.../query-sets/{qs.id}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              const url = `${window.location.origin}/api/public/users/${currentUserId}/query-sets/${qs.id}`;
                              navigator.clipboard.writeText(url);
                              setCopiedId(qs.id);
                              setTimeout(() => setCopiedId(null), 2000);
                            }}
                            className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] cursor-pointer"
                            title="Copy full public API URL"
                          >
                            {copiedId === qs.id ? 'Copied' : 'Copy URL'}
                          </button>
                          {onNavigateToDocs && (
                            <button
                              type="button"
                              onClick={() => onNavigateToDocs({
                                userId: currentUserId,
                                querySetId: qs.id,
                                targetOperationId: 'getPublicQuerySet',
                              })}
                              className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[10px] cursor-pointer flex items-center gap-1"
                              title="Open Swagger API Docs in SPA"
                            >
                              <BookOpen className="w-2.5 h-2.5 text-red-500" />
                              <span>Docs</span>
                            </button>
                          )}
                          <a
                            href={`/api/public/users/${currentUserId}/query-sets/${qs.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 cursor-pointer"
                            title="Open public endpoint in browser"
                          >
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Delete Confirmation Box */}
                {isDeletingThis ? (
                  <div className="p-3 bg-red-950/40 border border-red-900/60 rounded-lg space-y-2 text-xs">
                    <p className="text-red-200 font-medium">Delete this Query Set?</p>
                    <p className="text-[11px] text-red-300/80">Historical search runs will be preserved.</p>
                    <div className="flex items-center justify-end gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(null)}
                        disabled={isDeleting}
                        className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(qs.id)}
                        disabled={isDeleting}
                        className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-[11px] font-semibold cursor-pointer"
                      >
                        {isDeleting ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Action Buttons */
                  <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(qs.id)}
                      className="p-1.5 text-zinc-500 hover:text-red-400 rounded hover:bg-red-950/30 transition-colors cursor-pointer"
                      title="Delete query set"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onLoadQuerySet(qs)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-red-600 text-zinc-200 hover:text-white text-xs font-medium transition-colors cursor-pointer"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Load into Editor</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
