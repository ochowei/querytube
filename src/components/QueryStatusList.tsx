import React from 'react';
import { AlertCircle, Check, Loader2, Video } from 'lucide-react';

export type QueryExecutionState = 'pending' | 'running' | 'success' | 'failed';

export interface QueryProgressItem {
  id: string;
  q: string;
  state: QueryExecutionState;
  count?: number;
  error?: string;
}

interface QueryStatusListProps {
  queries: QueryProgressItem[];
  isRunning: boolean;
  completedCount: number;
  totalCount: number;
}

export const QueryStatusList: React.FC<QueryStatusListProps> = ({
  queries,
  isRunning,
  completedCount,
  totalCount,
}) => {
  if (queries.length === 0) return null;

  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const successCount = queries.filter((q) => q.state === 'success').length;
  const failedCount = queries.filter((q) => q.state === 'failed').length;
  const runningItem = queries.find((q) => q.state === 'running');

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3.5 space-y-3 shadow-inner">
      {/* Overall Progress Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          {isRunning ? (
            <>
              <Loader2 className="w-3.5 h-3.5 text-red-500 animate-spin" />
              <span className="font-medium text-zinc-100 font-mono">
                Searching {completedCount + (runningItem ? 1 : 0)} / {totalCount} queries...
              </span>
            </>
          ) : (
            <span className="font-medium text-zinc-300 font-mono">
              Batch Execution Summary ({completedCount} / {totalCount} finished)
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-[11px] font-mono">
          <span className="text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            {successCount} ok
          </span>
          {failedCount > 0 && (
            <span className="text-red-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
              {failedCount} failed
            </span>
          )}
          <span className="text-zinc-500">{percentage}%</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            failedCount > 0 && successCount === 0
              ? 'bg-red-500'
              : failedCount > 0
              ? 'bg-gradient-to-r from-emerald-500 to-amber-500'
              : 'bg-emerald-500'
          }`}
          style={{ width: `${Math.max(percentage, isRunning ? 5 : 0)}%` }}
        />
      </div>

      {/* Individual Query Status List */}
      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 font-mono text-xs select-text">
        {queries.map((q) => {
          let iconContent;
          let textColor = 'text-zinc-400';
          let bgColor = 'bg-zinc-950/60 border-zinc-800/80';

          if (q.state === 'success') {
            iconContent = <Check className="w-3.5 h-3.5 text-emerald-400" />;
            textColor = 'text-zinc-200';
            bgColor = 'bg-emerald-950/15 border-emerald-900/30';
          } else if (q.state === 'running') {
            iconContent = <span className="text-amber-400 font-bold text-sm leading-none animate-pulse">●</span>;
            textColor = 'text-amber-200';
            bgColor = 'bg-amber-950/20 border-amber-800/40';
          } else if (q.state === 'failed') {
            iconContent = <AlertCircle className="w-3.5 h-3.5 text-red-400" />;
            textColor = 'text-red-200';
            bgColor = 'bg-red-950/20 border-red-900/40';
          } else {
            // pending
            iconContent = <span className="text-zinc-600 text-sm leading-none">○</span>;
            textColor = 'text-zinc-500';
            bgColor = 'bg-zinc-950/40 border-zinc-900';
          }

          return (
            <div
              key={q.id}
              className={`flex items-start justify-between gap-2 px-2.5 py-1.5 rounded border transition-colors ${bgColor}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-4 flex items-center justify-center flex-shrink-0" title={q.state}>
                  {iconContent}
                </span>
                <span className={`font-semibold truncate ${textColor}`}>
                  {q.id}
                </span>
                <span className="text-zinc-500 truncate text-[11px]" title={q.q}>
                  &ldquo;{q.q}&rdquo;
                </span>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0 text-[11px]">
                {q.state === 'success' && q.count !== undefined && (
                  <span className="text-emerald-400 flex items-center gap-1 font-mono">
                    <Video className="w-3 h-3" />
                    {q.count} {q.count === 1 ? 'video' : 'videos'}
                  </span>
                )}
                {q.state === 'failed' && (
                  <span className="text-red-400 text-[10px] max-w-xs truncate" title={q.error}>
                    {q.error || 'Failed'}
                  </span>
                )}
                {q.state === 'running' && (
                  <span className="text-amber-400 text-[11px] animate-pulse">searching...</span>
                )}
                {q.state === 'pending' && (
                  <span className="text-zinc-600 text-[11px]">queued</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
