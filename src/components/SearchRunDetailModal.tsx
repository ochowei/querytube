import React, { useState } from 'react';
import { SearchRunDetails } from '../types';
import {
  X,
  Copy,
  Download,
  RotateCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Layers,
  Video,
  FileCode,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Check,
} from 'lucide-react';

interface SearchRunDetailModalProps {
  run: SearchRunDetails | null;
  isOpen: boolean;
  onClose: () => void;
  onRunAgain: (inputYaml: string, querySetId?: string | null, querySetName?: string | null) => void;
  onDeleteRun: (runId: string) => Promise<void>;
}

export const SearchRunDetailModal: React.FC<SearchRunDetailModalProps> = ({
  run,
  isOpen,
  onClose,
  onRunAgain,
  onDeleteRun,
}) => {
  const [activeTab, setActiveTab] = useState<'results' | 'yaml' | 'input'>('results');
  const [copied, setCopied] = useState(false);
  const [expandedQueries, setExpandedQueries] = useState<Record<string, boolean>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !run) return null;

  const toggleQuery = (id: string) => {
    setExpandedQueries((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyYaml = async () => {
    try {
      await navigator.clipboard.writeText(run.outputYaml);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const handleDownloadYaml = () => {
    const blob = new Blob([run.outputYaml], { type: 'text/yaml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeName = (run.querySetName || 'search_results')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_');
    link.download = `querytube_${safeName}_${run.id}.yaml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDeleteRun(run.id);
      onClose();
    } finally {
      setIsDeleting(false);
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
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="w-full max-w-4xl max-h-[90vh] bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-zinc-950/80 border-b border-zinc-800 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-bold text-zinc-100">
                {run.querySetName || 'Ad-hoc YAML Search Run'}
              </h2>
              {/* Status Badge */}
              {run.status === 'completed' ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 px-2 py-0.5 rounded">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  Completed
                </span>
              ) : run.status === 'partial' ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 bg-amber-950/60 border border-amber-800/50 px-2 py-0.5 rounded">
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  Partial
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-400 bg-red-950/60 border border-red-800/50 px-2 py-0.5 rounded">
                  <XCircle className="w-3 h-3 text-red-400" />
                  Failed
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400 font-mono">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-zinc-500" />
                {formatDate(run.startedAt)}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-zinc-300">
                <Layers className="w-3.5 h-3.5 text-zinc-500" />
                {run.queryCount} {run.queryCount === 1 ? 'query' : 'queries'} (
                <span className="text-emerald-400 font-semibold">{run.successfulQueries} passed</span>
                {run.failedQueries > 0 && (
                  <span className="text-red-400 font-semibold ml-1">· {run.failedQueries} failed</span>
                )}
                )
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-zinc-300">
                <Video className="w-3.5 h-3.5 text-zinc-500" />
                <strong className="text-zinc-100">{run.totalResults}</strong> videos
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher & Quick Actions */}
        <div className="px-5 py-2.5 bg-zinc-950/50 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-zinc-900 p-0.5 rounded-lg border border-zinc-800">
            <button
              type="button"
              onClick={() => setActiveTab('results')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'results'
                  ? 'bg-zinc-800 text-zinc-100 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Queries &amp; Videos ({run.queryResults?.length || 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('yaml')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'yaml'
                  ? 'bg-zinc-800 text-zinc-100 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Output YAML
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('input')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'input'
                  ? 'bg-zinc-800 text-zinc-100 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Input Snapshot
            </button>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyYaml}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
              title="Copy Output YAML"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy YAML'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadYaml}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
              title="Download YAML without calling YouTube API"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download YAML</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onRunAgain(run.inputYaml, run.querySetId, run.querySetName);
              }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              title="Execute a brand new search using this snapshot"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Run Again</span>
            </button>

            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="p-1 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-950/40 transition-colors cursor-pointer"
              title="Delete this Search Run"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Delete Confirmation Warning Bar */}
        {showDeleteConfirm && (
          <div className="px-5 py-3 bg-red-950/50 border-b border-red-900/60 flex items-center justify-between gap-3 text-xs">
            <span className="text-red-200 font-medium">
              Permanently delete this Search Run and all associated videos?
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-white font-semibold cursor-pointer"
              >
                {isDeleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        )}

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'results' && (
            <div className="space-y-4">
              {run.queryResults && run.queryResults.length > 0 ? (
                run.queryResults.map((qr) => {
                  const isExpanded = expandedQueries[qr.id] ?? true;
                  return (
                    <div
                      key={qr.id}
                      className="bg-zinc-950 border border-zinc-800/90 rounded-xl overflow-hidden shadow-xs"
                    >
                      {/* Query Header */}
                      <button
                        type="button"
                        onClick={() => toggleQuery(qr.id)}
                        className="w-full px-4 py-3 bg-zinc-900/60 hover:bg-zinc-900 flex items-center justify-between text-left transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-zinc-500" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-zinc-500" />
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-semibold text-zinc-200 bg-zinc-800 px-1.5 py-0.5 rounded">
                                {qr.sourceQueryId}
                              </span>
                              <span className="text-xs font-semibold text-zinc-100">"{qr.query}"</span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-mono mt-0.5">
                              {qr.relevanceLanguage && <span>lang: {qr.relevanceLanguage}</span>}
                              {qr.regionCode && <span>region: {qr.regionCode}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5">
                          {qr.status === 'success' ? (
                            <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded font-mono">
                              {qr.resultCount} videos
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-red-400 bg-red-950/40 border border-red-800/40 px-2 py-0.5 rounded font-mono">
                              Failed
                            </span>
                          )}
                        </div>
                      </button>

                      {/* Video List / Error details */}
                      {isExpanded && (
                        <div className="p-4 border-t border-zinc-850">
                          {qr.status === 'failed' ? (
                            <div className="p-3 bg-red-950/30 border border-red-900/40 rounded-lg text-xs text-red-300 font-mono">
                              {qr.errorMessage || qr.errorCode || 'Query execution failed.'}
                            </div>
                          ) : !qr.videos || qr.videos.length === 0 ? (
                            <div className="text-xs text-zinc-500 font-mono py-2">
                              No videos found matching this query.
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {qr.videos.map((vid) => (
                                <a
                                  key={vid.videoId}
                                  href={vid.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="group flex gap-3 p-2.5 bg-zinc-900/80 hover:bg-zinc-850 border border-zinc-800/80 hover:border-zinc-700 rounded-lg transition-all"
                                >
                                  {/* Thumbnail */}
                                  <div className="relative w-28 h-18 bg-zinc-950 rounded overflow-hidden flex-shrink-0">
                                    {vid.thumbnailUrl ? (
                                      <img
                                        src={vid.thumbnailUrl}
                                        alt={vid.title}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-zinc-600">
                                        <Video className="w-5 h-5" />
                                      </div>
                                    )}
                                  </div>

                                  {/* Info */}
                                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                                    <h4 className="text-xs font-medium text-zinc-200 line-clamp-2 group-hover:text-red-400 transition-colors">
                                      {vid.title}
                                    </h4>
                                    <div className="text-[11px] text-zinc-400 truncate mt-1 flex items-center gap-1">
                                      <span className="truncate">{vid.channelTitle}</span>
                                      <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 flex-shrink-0" />
                                    </div>
                                  </div>
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-xs text-zinc-500 text-center py-8">
                  No individual query records stored for this run.
                </div>
              )}
            </div>
          )}

          {activeTab === 'yaml' && (
            <div className="relative">
              <pre className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl font-mono text-xs text-zinc-200 overflow-x-auto leading-relaxed max-h-[60vh]">
                {run.outputYaml}
              </pre>
            </div>
          )}

          {activeTab === 'input' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
                <FileCode className="w-4 h-4 text-zinc-500" />
                <span>Exact YAML input executed for this historical run:</span>
              </div>
              <pre className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl font-mono text-xs text-zinc-200 overflow-x-auto leading-relaxed max-h-[60vh]">
                {run.inputYaml}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
