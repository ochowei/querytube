// Credential-free fixture using the real presentation components and styles.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Header } from '../../src/components/Header';
import { SearchWorkspace } from '../../src/components/SearchWorkspace';
import { YamlEditor } from '../../src/components/YamlEditor';
import { YamlViewer } from '../../src/components/YamlViewer';
import { QueryStatusList } from '../../src/components/QueryStatusList';
import { validateYamlString } from '../../src/utils/yamlValidator';
import '../../src/index.css';

const largeInput = `version: 1\nqueries:\n${Array.from({ length: 1200 }, (_, i) => `  - id: query-${i}\n    q: "search ${i}"`).join('\n')}`;
const largeOutput = Array.from({ length: 6000 }, (_, i) => `result_${i}: "${'video metadata '.repeat(20)}"`).join('\n');
const results = Array.from({ length: 120 }, (_, i) => ({
  id: `query-${i}`, query: `search ${i}`, count: 1,
  videos: [{ video_id: `${i}`, title: `Video ${i}`, channel_id: 'channel', channel_title: 'Channel', published_at: '2026-10-05T00:00:00Z', description: 'Description '.repeat(100), url: 'https://example.com', thumbnail_url: '' }],
}));

function Fixture() {
  const [input, setInput] = useState(largeInput);
  const [running, setRunning] = useState(false);
  const [feedback, setFeedback] = useState(false);
  const [notice, setNotice] = useState('');
  const params = new URLSearchParams(location.search);
  const validation = params.has('invalid')
    ? { valid: false, errors: Array.from({ length: 100 }, (_, i) => `Issue ${i}: invalid query`), queryCount: 0 }
    : validateYamlString(input);
  const output = params.has('empty') ? '' : largeOutput;
  return <div className="search-shell min-h-screen flex flex-col bg-zinc-950 text-zinc-100">
    <Header activeTab="search" onTabChange={() => {}} keyStatus={{ configured: true }} checkingKey={false} onOpenKeySettings={() => {}} />
    <main className="app-main flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col gap-4">
      {notice && <div role="status">{notice}</div>}
      <div className="search-view flex-1 flex flex-col gap-4">
        <SearchWorkspace editor={<YamlEditor value={input} onChange={setInput} validation={validation}
          onValidate={() => setNotice('Validated')} onRunSearch={() => { setRunning(true); setFeedback(true); }}
          isRunning={running} apiKeyConfigured={!params.has('missingKey')} activeQuerySet={null} hasUnsavedChanges={false}
          onNew={() => setInput('')} onSave={() => setNotice('Saved')} onSaveAs={() => setNotice('Saved as')} />}
          results={<>
            {feedback && <div className="search-monitor space-y-2"><div className="flex justify-between text-xs"><span>Execution Monitor</span>{running && <button onClick={() => setRunning(false)}>Cancel search</button>}</div>
              <div className="search-monitor-content"><QueryStatusList queries={Array.from({ length: 1200 }, (_, i) => ({ id: `query-${i}`, q: `search ${i}`, state: running ? 'pending' : 'success', count: 1 }))} isRunning={running} completedCount={running ? 0 : 1200} totalCount={1200} /></div>
            </div>}
            <YamlViewer outputYaml={output} outputData={output ? { summary: { queries: 120, successful: 120, failed: 0, total_results: 120 }, results } : null} isRunning={running} />
          </>} />
      </div>
    </main>
  </div>;
}
const root = createRoot(document.getElementById('root')!);
if (new URLSearchParams(location.search).has('app')) {
  import('../../src/App').then(({ default: App }) => root.render(<App />));
} else {
  root.render(<Fixture />);
}
