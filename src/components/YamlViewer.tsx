import React, { useState } from 'react';
import { Copy, Check, Download, Code, LayoutGrid, FileText, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';
import { VideoCardsPreview, QueryGroupResult } from './VideoCardsPreview';

interface YamlViewerProps {
  outputYaml: string;
  outputData: any | null;
  isRunning: boolean;
}

export const YamlViewer: React.FC<YamlViewerProps> = ({
  outputYaml,
  outputData,
  isRunning,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'yaml' | 'preview'>('yaml');

  const handleCopy = async () => {
    if (!outputYaml) return;
    try {
      await navigator.clipboard.writeText(outputYaml);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = outputYaml;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (!outputYaml) return;
    const blob = new Blob([outputYaml], { type: 'text/yaml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'youtube-search-results.yaml';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const summary = outputData?.summary;
  const results: QueryGroupResult[] = outputData?.results || [];
  const errors: Array<{ id: string; query: string; error: string }> = outputData?.errors || [];

  const lineCount = outputYaml ? outputYaml.split('\n').length : 0;
  const lineNumbers = Array.from({ length: Math.max(lineCount, 15) }, (_, i) => i + 1);

  return (
    <div className="yaml-viewer flex flex-col min-h-0 min-w-0 flex-1 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
      {/* Header Bar */}
      <div className="shrink-0 px-4 py-3 bg-zinc-950/70 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-zinc-400" />
          <h2 className="text-sm font-semibold text-zinc-200">Output YAML</h2>
          {summary && (
            <span className="text-[11px] font-mono text-zinc-400 bg-zinc-800/60 px-2 py-0.5 rounded border border-zinc-700/50">
              {summary.total_results} results
            </span>
          )}
        </div>

        {/* Controls: Tab Toggle, Copy, Download */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* View Toggle Tabs */}
          {outputYaml && (
            <div className="flex items-center p-0.5 bg-zinc-800/80 rounded-lg border border-zinc-700/50">
              <button
                type="button"
                onClick={() => setActiveTab('yaml')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === 'yaml'
                    ? 'bg-zinc-700 text-white shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                <span>Raw YAML</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === 'preview'
                    ? 'bg-zinc-700 text-white shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Cards ({results.length})</span>
              </button>
            </div>
          )}

          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            disabled={!outputYaml || isRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
            title="Copy YAML to clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-medium">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-zinc-400" />
                <span>Copy YAML</span>
              </>
            )}
          </button>

          {/* Download Button */}
          <button
            type="button"
            onClick={handleDownload}
            disabled={!outputYaml || isRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
            title="Download as youtube-search-results.yaml"
          >
            <Download className="w-3.5 h-3.5 text-zinc-400" />
            <span>Download YAML</span>
          </button>
        </div>
      </div>

      {/* Summary Banner if results present */}
      {summary && (
        <div className="shrink-0 px-4 py-2 bg-zinc-950/90 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-zinc-400 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-zinc-500" />
              Queries: <strong className="text-zinc-200">{summary.queries}</strong>
            </span>
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Successful: <strong>{summary.successful}</strong>
            </span>
            {summary.failed > 0 && (
              <span className="text-red-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                Failed: <strong>{summary.failed}</strong>
              </span>
            )}
          </div>
          <div className="text-zinc-400">
            Total Videos: <strong className="text-zinc-100">{summary.total_results}</strong>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="viewer-body relative min-h-0 min-w-0 bg-zinc-950 overflow-hidden flex flex-col">
        {!outputYaml ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-500">
            <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600 mb-3">
              <Code className="w-6 h-6 stroke-1" />
            </div>
            <p className="text-sm font-medium text-zinc-400">No output generated yet</p>
            <p className="text-xs text-zinc-600 mt-1 max-w-sm">
              Configure your search queries on the left and click &ldquo;Run Search&rdquo; to execute queries and generate normalized YAML.
            </p>
          </div>
        ) : activeTab === 'preview' ? (
          <div className="min-h-0 flex-1 p-4 overflow-auto" tabIndex={0} role="region" aria-label="Video cards">
            <VideoCardsPreview results={results} errors={errors} />
          </div>
        ) : (
          <div className="min-h-0 flex-1 flex font-mono text-xs overflow-auto" tabIndex={0} role="region" aria-label="Output YAML content">
            {/* Line Numbers */}
            <div
              aria-hidden="true"
              className="sticky left-0 z-10 self-start min-h-full w-12 shrink-0 py-3 text-right pr-2 text-zinc-600 bg-zinc-950 border-r border-zinc-800/80 select-none overflow-hidden font-mono leading-relaxed"
            >
              {lineNumbers.map((num) => (
                <div key={num} className="text-xs leading-relaxed">
                  {num}
                </div>
              ))}
            </div>

            {/* Read-only Code View */}
            <pre className="flex-1 p-3 text-zinc-200 font-mono text-xs leading-relaxed selection:bg-red-500/30 selection:text-white">
              <code>{outputYaml}</code>
            </pre>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="shrink-0 px-4 py-2 bg-zinc-950/90 border-t border-zinc-800 flex flex-wrap gap-2 items-center justify-between text-[11px] text-zinc-500 font-mono">
        <div>
          {outputYaml ? (
            <span>Generated as normalized YAML · utf-8</span>
          ) : (
            <span>Awaiting search execution</span>
          )}
        </div>
        <div>
          {outputYaml && (
            <span>Filename: youtube-search-results.yaml</span>
          )}
        </div>
      </div>
    </div>
  );
};
