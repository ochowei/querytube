import React, { useState } from 'react';
import {
  BookOpen,
  Copy,
  Check,
  ExternalLink,
  Code2,
  RefreshCw,
  Loader2,
  Sparkles,
} from 'lucide-react';

export const ApiDocsView: React.FC = () => {
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedBase, setCopiedBase] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [iframeKey, setIframeKey] = useState(0);

  const openApiJsonUrl = `${window.location.origin}/openapi.json`;
  const publicApiBaseUrl = `${window.location.origin}/api/public`;

  const copyToClipboard = (text: string, isJson: boolean) => {
    navigator.clipboard.writeText(text);
    if (isJson) {
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    } else {
      setCopiedBase(true);
      setTimeout(() => setCopiedBase(false), 2000);
    }
  };

  const handleRefresh = () => {
    setIsLoading(true);
    setIframeKey((prev) => prev + 1);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-125px)] min-h-[650px] space-y-3 animate-in fade-in duration-200">
      {/* Top Banner & Control Bar */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-500 shadow-sm shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-zinc-100">Public API Documentation</h2>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-red-950/60 text-red-400 border border-red-800/60 font-semibold">
                OpenAPI 3.1
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                Swagger UI
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Read-only API for publicly shared Query Sets and historical search runs
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Copy Base URL Button */}
          <button
            type="button"
            onClick={() => copyToClipboard(publicApiBaseUrl, false)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 text-zinc-300 hover:text-white text-xs font-mono transition-colors cursor-pointer"
            title="Copy Public API Base URL"
          >
            {copiedBase ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="text-[11px]">{copiedBase ? 'Base Copied!' : 'Copy Base URL'}</span>
          </button>

          {/* Copy openapi.json Button */}
          <button
            type="button"
            onClick={() => copyToClipboard(openApiJsonUrl, true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 text-zinc-300 hover:text-white text-xs font-mono transition-colors cursor-pointer"
            title="Copy machine-readable OpenAPI schema URL (for AI agents & CLI tools)"
          >
            {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Code2 className="w-3.5 h-3.5" />}
            <span className="text-[11px]">{copiedJson ? 'Schema Copied!' : 'openapi.json'}</span>
          </button>

          {/* Reload Swagger frame */}
          <button
            type="button"
            onClick={handleRefresh}
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
            title="Reload API Docs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-red-500' : ''}`} />
          </button>

          {/* Optional Open in new tab link */}
          <a
            href="/api-docs/"
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
            title="Open in standalone tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Embedded Swagger UI Container */}
      <div className="relative flex-1 w-full bg-white rounded-xl border border-zinc-800 overflow-hidden shadow-md">
        {isLoading && (
          <div className="absolute inset-0 z-10 bg-zinc-950/80 backdrop-blur-xs flex flex-col items-center justify-center text-zinc-400 space-y-2">
            <Loader2 className="w-7 h-7 text-red-500 animate-spin" />
            <p className="text-xs font-mono">Loading Swagger UI in SPA...</p>
          </div>
        )}

        <iframe
          key={iframeKey}
          src="/api-docs/"
          title="QueryTube Public API Documentation (Swagger UI)"
          onLoad={() => setIsLoading(false)}
          className="w-full h-full border-0 block"
        />
      </div>
    </div>
  );
};
