import React, { useRef, useState, useId } from 'react';
import {
  Upload,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Play,
  RotateCcw,
  FileCode,
  Layers,
  HelpCircle,
  KeyRound,
} from 'lucide-react';
import { SAMPLE_YAMLS, ValidationResult } from '../utils/yamlValidator';

interface YamlEditorProps {
  value: string;
  onChange: (val: string) => void;
  validation: ValidationResult;
  onValidate: () => void;
  onRunSearch: () => void;
  isRunning: boolean;
  apiKeyConfigured: boolean | null;
  onOpenKeySettings?: () => void;
}

export const YamlEditor: React.FC<YamlEditorProps> = ({
  value,
  onChange,
  validation,
  onValidate,
  onRunSearch,
  isRunning,
  apiKeyConfigured,
  onOpenKeySettings,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const textareaId = useId();

  const handleFileUpload = (file: File) => {
    if (!file.name.endsWith('.yaml') && !file.name.endsWith('.yml')) {
      alert('Please upload a .yaml or .yml file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (typeof content === 'string') {
        onChange(content);
      }
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const lineCount = value.split('\n').length;
  const lineNumbers = Array.from({ length: Math.max(lineCount, 15) }, (_, i) => i + 1);

  const canRunSearch = Boolean(
    !isRunning &&
      validation.valid &&
      validation.queryCount > 0 &&
      apiKeyConfigured === true
  );

  return (
    <div className="flex flex-col h-full bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
      {/* Header Bar */}
      <div className="px-4 py-3 bg-zinc-950/70 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-zinc-400" />
          <h2 className="text-sm font-semibold text-zinc-200">Input YAML</h2>
          <span className="text-[11px] font-mono text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded">
            UTF-8
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 text-xs">
          {/* File Upload */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFileUpload(e.target.files[0]);
              }
            }}
            accept=".yaml,.yml"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isRunning}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
            title="Upload .yaml or .yml file"
          >
            <Upload className="w-3.5 h-3.5 text-zinc-400" />
            <span>Upload</span>
          </button>

          {/* Load Example Presets */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowPresets(!showPresets)}
              disabled={isRunning}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Load Example</span>
            </button>

            {showPresets && (
              <div
                className="absolute right-0 mt-1.5 w-64 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl p-2 z-20 space-y-1"
                onMouseLeave={() => setShowPresets(false)}
              >
                <div className="px-2 py-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Select Example
                </div>
                {Object.entries(SAMPLE_YAMLS).map(([key, item]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      onChange(item.yaml);
                      setShowPresets(false);
                    }}
                    className="w-full text-left p-2 rounded hover:bg-zinc-800 transition-colors cursor-pointer group"
                  >
                    <div className="text-xs font-medium text-zinc-200 group-hover:text-white">
                      {item.title}
                    </div>
                    <div className="text-[11px] text-zinc-500 line-clamp-1 mt-0.5">
                      {item.description}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Schema Help Toggle */}
          <button
            type="button"
            onClick={() => setShowHelp(!showHelp)}
            className="p-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="View YAML schema documentation"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>

          {/* Clear button */}
          <button
            type="button"
            onClick={() => onChange('')}
            disabled={isRunning || !value}
            className="p-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-40"
            title="Clear editor"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Optional Schema Help Drawer */}
      {showHelp && (
        <div className="bg-zinc-950 border-b border-zinc-800 p-3.5 text-xs text-zinc-400 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-zinc-200">YAML Schema Specification</span>
            <button
              onClick={() => setShowHelp(false)}
              className="text-zinc-500 hover:text-zinc-300 font-mono"
            >
              close ✕
            </button>
          </div>
          <p className="text-[11px] text-zinc-400">
            Define global defaults and a list of search queries. Each query requires <code className="text-zinc-300 bg-zinc-800 px-1 py-0.5 rounded">id</code> and <code className="text-zinc-300 bg-zinc-800 px-1 py-0.5 rounded">q</code>.
          </p>
          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-zinc-400 bg-zinc-900/80 p-2 rounded border border-zinc-800">
            <div>
              <span className="text-zinc-300 font-semibold block mb-0.5">Query Properties:</span>
              • id (string, unique)<br />
              • q (search terms)<br />
              • max_results (1-50)<br />
              • order (relevance, date, rating, title, viewCount)
            </div>
            <div>
              <span className="text-zinc-300 font-semibold block mb-0.5">Filters:</span>
              • relevance_language (e.g. en, ja, ko)<br />
              • region_code (e.g. US, JP, TW, GB)<br />
              • published_after / published_before<br />
              • safe_search (none, moderate, strict)
            </div>
          </div>
        </div>
      )}

      {/* Editor Body with Drag & Drop & Line Numbers */}
      <div
        className={`relative flex-1 min-h-[360px] flex font-mono text-xs overflow-hidden ${
          isDragging ? 'ring-2 ring-red-500 bg-red-950/10' : 'bg-zinc-950'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="absolute inset-0 z-10 bg-zinc-950/90 backdrop-blur-sm flex flex-col items-center justify-center text-zinc-200 pointer-events-none">
            <Upload className="w-10 h-10 text-red-500 mb-2 animate-bounce" />
            <p className="font-semibold text-sm">Drop your YAML file here</p>
            <p className="text-xs text-zinc-500 mt-1">.yaml or .yml files supported</p>
          </div>
        )}

        {/* Line Numbers Gutter */}
        <div
          aria-hidden="true"
          className="w-10 py-3 text-right pr-2 text-zinc-600 bg-zinc-950/80 border-r border-zinc-800/80 select-none overflow-hidden font-mono leading-relaxed"
        >
          {lineNumbers.map((num) => (
            <div key={num} className="text-[11px]">
              {num}
            </div>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          id={textareaId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`# Paste your YAML here or drop a .yaml file\nversion: 1\ndefaults:\n  max_results: 10\nqueries:\n  - id: sample\n    q: "example query"\n`}
          spellCheck={false}
          disabled={isRunning}
          className="flex-1 p-3 bg-transparent text-zinc-100 placeholder-zinc-600 resize-none outline-none font-mono text-xs leading-relaxed overflow-y-auto selection:bg-red-500/30 selection:text-white"
        />
      </div>

      {/* Validation Feedback Banner */}
      <div className="px-4 py-2.5 bg-zinc-950/90 border-t border-zinc-800 flex flex-col gap-2">
        {validation.valid ? (
          <div className="flex items-center justify-between text-xs text-emerald-400">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span>YAML is valid &amp; ready to search</span>
            </div>
            <span className="text-[11px] font-mono text-emerald-300/80">
              {validation.queryCount} {validation.queryCount === 1 ? 'query' : 'queries'} defined
            </span>
          </div>
        ) : (
          <div className="text-xs text-red-400 space-y-1">
            <div className="flex items-center gap-1.5 font-medium">
              <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
              <span>Validation Issues ({validation.errors.length}):</span>
            </div>
            <ul className="list-disc list-inside text-[11px] text-red-300/90 space-y-0.5 max-h-24 overflow-y-auto pl-1">
              {validation.errors.map((err, idx) => (
                <li key={idx} className="font-mono">{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Warning if API Key is missing */}
        {apiKeyConfigured === false && (
          <div className="flex items-center justify-between gap-2 p-2 bg-amber-950/30 border border-amber-800/50 rounded-lg text-xs text-amber-300">
            <div className="flex items-center gap-2">
              <KeyRound className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span>Configure your YouTube API key before running a search.</span>
            </div>
            {onOpenKeySettings && (
              <button
                type="button"
                onClick={onOpenKeySettings}
                className="text-[11px] text-amber-200 hover:text-white font-semibold underline underline-offset-2 cursor-pointer flex-shrink-0"
              >
                Set Up Key
              </button>
            )}
          </div>
        )}

        {/* Bottom Toolbar: Query Count, Estimated Calls, Validate, Run Search */}
        <div className="pt-2 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-3">
          {/* Metrics */}
          <div className="flex items-center gap-3 text-xs text-zinc-400 font-mono">
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-zinc-500" />
              <span>Queries:</span>
              <strong className="text-zinc-200">{validation.valid ? validation.queryCount : 0}</strong>
            </div>
            <span className="text-zinc-700">|</span>
            <div className="flex items-center gap-1.5">
              <span>Estimated API Calls:</span>
              <strong className="text-zinc-200">{validation.valid ? validation.queryCount : 0}</strong>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onValidate}
              disabled={isRunning || !value.trim()}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
            >
              Validate
            </button>

            <button
              type="button"
              onClick={onRunSearch}
              disabled={!canRunSearch}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer ${
                isRunning
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  : !canRunSearch
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-60'
                  : 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/20 hover:shadow'
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isRunning ? 'Searching...' : 'Run YouTube Search'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
