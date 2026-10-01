import React, { useEffect, useState } from 'react';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import {
  BookOpen,
  Copy,
  Check,
  ExternalLink,
  Code2,
  RefreshCw,
  Loader2,
} from 'lucide-react';

interface ApiDocsViewProps {
  userId?: string;
  querySetId?: string;
  runId?: string;
  targetOperationId?: string;
}

interface OpenApiParameter {
  name?: string;
  example?: unknown;
  schema?: Record<string, unknown>;
}

interface OpenApiOperation {
  parameters?: OpenApiParameter[];
  operationId?: string;
  [key: string]: unknown;
}

interface OpenApiDocument {
  paths?: Record<string, OpenApiOperation>;
  [key: string]: unknown;
}

const operationMethods = new Set(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']);

const applyApiDocsContext = (
  source: OpenApiDocument,
  userId?: string,
  querySetId?: string,
  runId?: string,
): OpenApiDocument => {
  // The fetched JSON is plain data, so a JSON clone also works in browsers
  // without structuredClone and keeps the server-provided document untouched.
  const contextualSpec = JSON.parse(JSON.stringify(source)) as OpenApiDocument;

  const applyToParameters = (parameters?: OpenApiParameter[]) => {
    parameters?.forEach((parameter) => {
      if (parameter.name === 'userId' && userId !== undefined) {
        parameter.example = userId;
        if (parameter.schema && typeof parameter.schema === 'object') {
          parameter.schema.default = userId;
        }
      } else if (parameter.name === 'querySetId' && querySetId !== undefined) {
        parameter.example = querySetId;
        if (parameter.schema && typeof parameter.schema === 'object') {
          parameter.schema.default = querySetId;
        }
      } else if (parameter.name === 'runId' && runId !== undefined) {
        parameter.example = runId;
        if (parameter.schema && typeof parameter.schema === 'object') {
          parameter.schema.default = runId;
        }
      }
    });
  };

  Object.values(contextualSpec.paths ?? {}).forEach((pathItem) => {
    applyToParameters(pathItem.parameters as OpenApiParameter[] | undefined);

    Object.entries(pathItem).forEach(([method, operation]) => {
      if (!operationMethods.has(method) || !operation || typeof operation !== 'object') return;
      applyToParameters((operation as OpenApiOperation).parameters);
    });
  });

  return contextualSpec;
};

const getErrorMessage = (error: unknown): string => (
  error instanceof Error ? error.message : 'An unknown error occurred.'
);

const formatContextValue = (value: string): string => (
  value.length > 20 ? `${value.slice(0, 10)}...` : value
);

export const ApiDocsView: React.FC<ApiDocsViewProps> = ({
  userId,
  querySetId,
  runId,
  targetOperationId,
}) => {
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedBase, setCopiedBase] = useState(false);
  const [swaggerKey, setSwaggerKey] = useState(0);
  const [openApiSpec, setOpenApiSpec] = useState<OpenApiDocument | null>(null);
  const [isLoadingSpec, setIsLoadingSpec] = useState(true);
  const [specLoadError, setSpecLoadError] = useState<string | null>(null);

  const openApiJsonUrl = `${window.location.origin}/openapi.json`;
  const publicApiBaseUrl = `${window.location.origin}/api/public`;

  useEffect(() => {
    const controller = new AbortController();

    const loadSpec = async () => {
      setIsLoadingSpec(true);
      setSpecLoadError(null);
      setOpenApiSpec(null);

      try {
        const response = await fetch('/openapi.json', {
          cache: 'no-cache',
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`The server returned ${response.status} ${response.statusText}.`);
        }

        const sourceSpec = await response.json() as OpenApiDocument;
        const contextualSpec = applyApiDocsContext(sourceSpec, userId, querySetId, runId);
        if (!controller.signal.aborted) {
          setOpenApiSpec(contextualSpec);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setSpecLoadError(getErrorMessage(error));
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingSpec(false);
        }
      }
    };

    void loadSpec();
    return () => controller.abort();
  }, [swaggerKey, userId, querySetId, runId]);

  // Deep-link / scroll & expand target operation when specified
  useEffect(() => {
    if (!openApiSpec || !targetOperationId) return;

    const timer = setTimeout(() => {
      // Find element in Swagger UI DOM matching the target operation
      const selector = `[id$="${targetOperationId}"], [data-operation-id="${targetOperationId}"]`;
      const opElement = document.querySelector(selector) as HTMLElement | null;

      if (opElement) {
        // Expand the accordion if collapsed
        const summaryBtn = opElement.querySelector('button.opblock-summary-control') as HTMLButtonElement | null;
        if (summaryBtn && summaryBtn.getAttribute('aria-expanded') !== 'true') {
          summaryBtn.click();
        }

        // Smooth scroll to the operation
        opElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [openApiSpec, targetOperationId]);

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
    setSwaggerKey((prev) => prev + 1);
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
              Read-only API for publicly shared Query Sets and Search Runs (independent access)
            </p>
          </div>
        </div>

        {(userId || querySetId || runId || targetOperationId) && (
          <div className="mr-auto min-w-0 border-l border-zinc-800 pl-3 text-[10px] leading-4 text-zinc-400 flex flex-wrap items-center gap-x-3 gap-y-1">
            <div className="font-semibold uppercase tracking-wide text-zinc-500">Context</div>
            {userId && (
              <div title={userId}>
                User: <span className="font-mono text-zinc-300 font-semibold">{formatContextValue(userId)}</span>
              </div>
            )}
            {querySetId && (
              <div title={querySetId}>
                Query Set: <span className="font-mono text-zinc-300">{formatContextValue(querySetId)}</span>
              </div>
            )}
            {runId && (
              <div title={runId}>
                Run ID: <span className="font-mono text-emerald-400 font-semibold">{formatContextValue(runId)}</span>
              </div>
            )}
            {targetOperationId && (
              <div title={targetOperationId}>
                Target: <span className="font-mono text-zinc-300">{targetOperationId}</span>
              </div>
            )}
          </div>
        )}

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

          {/* Reload Swagger UI */}
          <button
            type="button"
            onClick={handleRefresh}
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
            title="Reload API Docs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {/* Optional Open in standalone tab link */}
          <a
            href="/api-docs/"
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
            title="Open standalone Swagger UI in new tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Embedded React Swagger UI Container */}
      <div className="flex-1 w-full bg-white rounded-xl border border-zinc-800 overflow-y-auto shadow-md p-2 sm:p-4 text-zinc-900">
        {isLoadingSpec ? (
          <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-zinc-600" role="status">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading OpenAPI schema...</span>
          </div>
        ) : specLoadError ? (
          <div className="mx-auto mt-12 max-w-xl rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
            <h3 className="font-semibold">Could not load API documentation</h3>
            <p className="mt-1">The OpenAPI schema could not be loaded from /openapi.json.</p>
            <p className="mt-1 text-xs">{specLoadError}</p>
          </div>
        ) : openApiSpec ? (
          <SwaggerUI
            key={`${swaggerKey}-${userId ?? ''}-${querySetId ?? ''}-${runId ?? ''}-${targetOperationId ?? ''}`}
            spec={openApiSpec}
            deepLinking={true}
          />
        ) : null}
      </div>
    </div>
  );
};
