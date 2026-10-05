import React, { useId, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface SearchWorkspaceProps {
  editor: React.ReactNode;
  results: React.ReactNode;
}

/** Presentation only: Search Request and result state remain owned by App. */
export function SearchWorkspace({ editor, results }: SearchWorkspaceProps) {
  const [queryCollapsed, setQueryCollapsed] = useState(false);
  const [resultsCollapsed, setResultsCollapsed] = useState(false);
  const id = useId();

  return (
    <div className="search-workspace" data-query-collapsed={queryCollapsed} data-results-collapsed={resultsCollapsed}>
      {[
        { name: 'Query YAML', key: 'query', collapsed: queryCollapsed, toggle: () => setQueryCollapsed(!queryCollapsed), content: editor },
        { name: 'Search Result', key: 'results', collapsed: resultsCollapsed, toggle: () => setResultsCollapsed(!resultsCollapsed), content: results },
      ].map((panel) => (
        <section key={panel.key} aria-label={panel.name} className="search-panel" data-collapsed={panel.collapsed}>
          <button
            type="button"
            className="search-panel-toggle flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white focus-visible:outline-2 focus-visible:outline-red-400"
            aria-label={`${panel.collapsed ? 'Expand' : 'Collapse'} ${panel.name}`}
            aria-expanded={!panel.collapsed}
            aria-controls={`${id}-${panel.key}`}
            onClick={panel.toggle}
          >
            <span>{panel.name}</span>
            {panel.collapsed ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronUp className="h-4 w-4 shrink-0" />}
          </button>
          <div id={`${id}-${panel.key}`} hidden={panel.collapsed} className="search-panel-content">
            {panel.content}
          </div>
        </section>
      ))}
    </div>
  );
}
