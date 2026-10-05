import React, { useId, useState } from 'react';
import { ChevronDown, ChevronUp, PanelLeft, PanelRight } from 'lucide-react';

interface SearchWorkspaceProps {
  editor: React.ReactNode;
  results: React.ReactNode;
}

/** Presentation only: Search Request and result state remain owned by App. */
export function SearchWorkspace({ editor, results }: SearchWorkspaceProps) {
  const [queryCollapsed, setQueryCollapsed] = useState(false);
  const [resultsCollapsed, setResultsCollapsed] = useState(false);
  const id = useId();
  const panels = [
    { name: 'Query YAML', key: 'query', collapsed: queryCollapsed, toggle: () => setQueryCollapsed(!queryCollapsed), content: editor, icon: PanelLeft },
    { name: 'Search Result', key: 'results', collapsed: resultsCollapsed, toggle: () => setResultsCollapsed(!resultsCollapsed), content: results, icon: PanelRight },
  ];

  return (
    <div className="search-workspace" data-query-collapsed={queryCollapsed} data-results-collapsed={resultsCollapsed}>
      <div className="hidden lg:flex shrink-0 items-center justify-end gap-2" role="group" aria-label="Search panels">
        {panels.map((panel) => (
          <button
            key={panel.key}
            type="button"
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-red-400 ${panel.collapsed ? 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:bg-zinc-900 hover:text-white' : 'border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800'}`}
            aria-label={`${panel.collapsed ? 'Expand' : 'Collapse'} ${panel.name}`}
            aria-expanded={!panel.collapsed}
            aria-controls={`${id}-${panel.key}`}
            onClick={panel.toggle}
          >
            <panel.icon className="h-4 w-4 shrink-0" />
            <span>{panel.name}</span>
            <span className="text-zinc-500">{panel.collapsed ? 'Show' : 'Hide'}</span>
          </button>
        ))}
      </div>
      <div className="search-panels">
        {panels.map((panel) => (
          <section key={panel.key} aria-label={panel.name} className="search-panel" data-collapsed={panel.collapsed}>
            <button
              type="button"
              className="search-panel-toggle lg:hidden flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white focus-visible:outline-2 focus-visible:outline-red-400"
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
      {queryCollapsed && resultsCollapsed && (
        <div className="hidden lg:flex flex-1 items-center justify-center rounded-xl border border-dashed border-zinc-800 p-8 text-sm text-zinc-500">
          Both panels are hidden. Show a panel above to continue.
        </div>
      )}
    </div>
  );
}
