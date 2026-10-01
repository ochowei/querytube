import React from 'react';
import { ExternalLink, Calendar, User, Video, Globe } from 'lucide-react';

export interface VideoItem {
  video_id: string;
  title: string;
  channel_id: string;
  channel_title: string;
  published_at: string;
  description: string;
  url: string;
  thumbnail_url: string;
}

export interface QueryGroupResult {
  id: string;
  query: string;
  relevance_language?: string;
  region_code?: string;
  count: number;
  videos: VideoItem[];
}

interface VideoCardsPreviewProps {
  results: QueryGroupResult[];
  errors?: Array<{ id: string; query: string; error: string }>;
}

export const VideoCardsPreview: React.FC<VideoCardsPreviewProps> = ({ results, errors = [] }) => {
  if (results.length === 0 && errors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-zinc-500">
        <Video className="w-10 h-10 mb-3 text-zinc-600 stroke-1" />
        <p className="text-sm font-medium text-zinc-400">No search results to display</p>
        <p className="text-xs text-zinc-600 mt-1 max-w-sm">
          Run your search to preview video cards and metadata here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Errors group if any */}
      {errors.length > 0 && (
        <div className="p-3.5 bg-red-950/30 border border-red-900/50 rounded-lg space-y-2">
          <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wider">
            Query Execution Errors ({errors.length})
          </h4>
          <div className="space-y-1.5 font-mono text-xs">
            {errors.map((err, idx) => (
              <div key={idx} className="bg-red-950/60 p-2 rounded border border-red-900/30 text-red-200">
                <span className="font-semibold text-red-300">[{err.id}]</span>{' '}
                <span className="text-zinc-400">&ldquo;{err.query}&rdquo;</span> —{' '}
                <span className="text-red-300">{err.error}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Query Groups */}
      {results.map((group) => (
        <div key={group.id} className="bg-zinc-900/90 border border-zinc-800 rounded-lg overflow-hidden">
          {/* Group Header */}
          <div className="px-4 py-3 bg-zinc-950/60 border-b border-zinc-800/80 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold text-zinc-100">
                  {group.id}
                </span>
                <span className="text-xs text-zinc-400 font-normal">
                  &ldquo;{group.query}&rdquo;
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-1 font-mono">
                {group.relevance_language && (
                  <span className="flex items-center gap-1">
                    <Globe className="w-3 h-3 text-zinc-400" />
                    lang: {group.relevance_language}
                  </span>
                )}
                {group.region_code && (
                  <span>· region: {group.region_code}</span>
                )}
              </div>
            </div>

            <div className="text-xs font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2.5 py-1 rounded">
              {group.count} {group.count === 1 ? 'video' : 'videos'}
            </div>
          </div>

          {/* Video List */}
          <div className="divide-y divide-zinc-800/60">
            {group.videos.length === 0 ? (
              <div className="p-4 text-xs text-zinc-500 italic">No videos returned for this query.</div>
            ) : (
              group.videos.map((vid) => (
                <div key={vid.video_id} className="p-3.5 hover:bg-zinc-850/50 transition-colors flex flex-col sm:flex-row gap-3">
                  {/* Thumbnail */}
                  <div className="relative flex-shrink-0 w-full sm:w-40 aspect-video rounded overflow-hidden bg-zinc-800 border border-zinc-700/50 group">
                    {vid.thumbnail_url ? (
                      <img
                        src={vid.thumbnail_url}
                        alt={vid.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-600">
                        <Video className="w-6 h-6" />
                      </div>
                    )}
                    <a
                      href={vid.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                    >
                      <ExternalLink className="w-5 h-5 drop-shadow" />
                    </a>
                  </div>

                  {/* Metadata */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <h5 className="text-sm font-medium text-zinc-200 line-clamp-2 hover:text-white transition-colors">
                        <a href={vid.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                          {vid.title}
                        </a>
                      </h5>
                      <p className="text-xs text-zinc-400 line-clamp-2 mt-1">
                        {vid.description || 'No description provided.'}
                      </p>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-zinc-800/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 text-zinc-400 font-medium truncate max-w-[160px]">
                          <User className="w-3 h-3 text-zinc-500 flex-shrink-0" />
                          {vid.channel_title}
                        </span>
                        <span className="flex items-center gap-1 font-mono">
                          <Calendar className="w-3 h-3 text-zinc-500 flex-shrink-0" />
                          {vid.published_at ? new Date(vid.published_at).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>

                      <a
                        href={vid.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-red-400 hover:text-red-300 font-mono text-[11px] hover:underline"
                      >
                        Watch on YouTube
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
