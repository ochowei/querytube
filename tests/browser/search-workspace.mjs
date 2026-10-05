/**
 * Start Vite, then run:
 * PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
 * BROWSER_EXECUTABLE=/absolute/path/to/chromium node tests/browser/search-workspace.mjs
 * Optional: SEARCH_WORKSPACE_URL and SCREENSHOT_DIR. No live API or credentials used.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const url = process.env.SEARCH_WORKSPACE_URL || 'http://127.0.0.1:5174/tests/browser/search-workspace.html';
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
// Intercept AuthContext before it imports Firebase: never use the user's session.
await page.route('**/src/context/AuthContext.tsx', route => route.fulfill({
  contentType: 'text/javascript',
  body: `const user = { uid: 'fixture-owner', displayName: 'Fixture User' };
    export const useAuth = () => ({ user, authState: 'authenticated', authError: null,
      getIdToken: async () => 'fixture-token', expireSession() {}, signOutUser() {},
      signInWithGoogle: async () => {}, setAuthError() {} });`,
}));
await page.route('**/api/**', route => route.abort());
const button = name => page.getByRole('button', { name, exact: true });
const panel = name => page.getByRole('region', { name, exact: true });
async function geometry() {
  return page.evaluate(() => {
    const box = element => { const r = element.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, width: r.width, height: r.height, scroll: element.scrollHeight, client: element.clientHeight }; };
    return {
      height: document.documentElement.scrollHeight, width: document.documentElement.scrollWidth,
      editor: box(document.querySelector('textarea')), output: box(document.querySelector('.viewer-body')),
      controls: [...document.querySelectorAll('button')].filter(b => /^(Validate|Run Search|Copy YAML|Download YAML)$/.test(b.textContent.trim())).map(box),
    };
  });
}
async function screenshot(name) {
  if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/${name}.png`, fullPage: true });
}
try {
  await page.goto(url);
  await page.getByRole('textbox', { name: 'YAML Search Definition' }).waitFor();
  let g = await geometry();
  assert(g.height <= 900, JSON.stringify(g));
  assert(g.width <= 1440);
  assert(g.editor.scroll > 20000 && g.editor.height > 100);
  for (const control of g.controls) assert(control.bottom <= 900 && control.height > 0);
  const raw = panel('Output YAML content');
  assert(await raw.evaluate(e => e.scrollHeight > 50000 && e.scrollWidth > e.clientWidth));
  await page.locator('textarea').evaluate(e => { e.scrollTop = 5000; e.dispatchEvent(new Event('scroll', { bubbles: true })); });
  assert.equal(await page.locator('.editor-body [aria-hidden]').evaluate(e => e.scrollTop), 5000);
  await raw.evaluate(e => { e.scrollTop = 5000; e.scrollLeft = 800; });
  assert.equal(await raw.evaluate(e => e.scrollTop), 5000);
  const heights = await raw.evaluate(e => [e.querySelector('[aria-hidden] > div').getBoundingClientRect().height, parseFloat(getComputedStyle(e.querySelector('pre')).lineHeight)]);
  assert.equal(heights[0], heights[1]);
  await button('Validate').click();
  await page.getByRole('status').filter({ hasText: 'Validated' }).waitFor();
  await screenshot('desktop-large-yaml');
  const oldWidth = (await panel('Search Result').boundingBox()).width;
  await button('Collapse Query YAML').focus();
  await page.keyboard.press('Enter');
  assert.equal(await button('Expand Query YAML').getAttribute('aria-expanded'), 'false');
  assert(await page.locator('textarea').isHidden());
  assert((await panel('Search Result').boundingBox()).width > oldWidth * 1.5);
  await screenshot('desktop-query-collapsed');
  await button('Cards (120)').click();
  const cards = panel('Video cards');
  assert(await cards.evaluate(e => e.scrollHeight > e.clientHeight));
  await cards.evaluate(e => e.scrollTop = 1500);
  await button('Collapse Search Result').click();
  assert(await cards.isHidden());
  assert(await button('Expand Query YAML').isVisible() && await button('Expand Search Result').isVisible());
  await button('Expand Search Result').click();
  assert(await cards.isVisible());
  assert.equal(await cards.evaluate(e => e.scrollTop), 1500);
  await button('Expand Query YAML').click();
  assert((await page.locator('textarea').inputValue()).includes('query-1199'));
  await button('Run Search').click();
  assert(await button('Copy YAML').isDisabled());
  await button('Collapse Search Result').click();
  await button('Expand Search Result').click();
  assert(await button('Cancel search').isVisible());
  await button('Cancel search').click();
  assert(await button('Copy YAML').isEnabled());
  g = await geometry();
  assert(g.height <= 900 && g.output.height > 100);
  await screenshot('desktop-cards-monitor');
  await button('Raw YAML').click();
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await button('Copy YAML').click();
  const yaml = await raw.locator('code').textContent();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), yaml);
  const downloadPromise = page.waitForEvent('download');
  await button('Download YAML').click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), 'youtube-search-results.yaml');
  assert.equal(await readFile(await download.path(), 'utf8'), yaml);

  for (const size of [{ width: 1280, height: 720 }, { width: 1024, height: 768 }, { width: 1440, height: 480 }]) {
    await page.setViewportSize(size);
    g = await geometry();
    assert(g.width <= size.width && g.height <= Math.max(size.height, 720), JSON.stringify({ size, g }));
    assert(g.editor.height > 0 && g.output.height > 0);
    for (const control of g.controls) assert(control.bottom <= Math.max(size.height, 720));
  }
  await screenshot('desktop-short-window');
  for (const width of [320, 390, 768, 1023]) {
    await page.setViewportSize({ width, height: 844 });
    g = await geometry();
    assert(g.width <= width, JSON.stringify({ width, g }));
    assert.equal(g.editor.height, 350);
    assert.equal(g.output.height, 360);
    assert(g.height > 844);
    await button('Collapse Query YAML').click();
    assert(await page.locator('textarea').isHidden());
    await page.setViewportSize({ width: 1280, height: 800 });
    assert(await button('Expand Query YAML').isVisible());
    await page.setViewportSize({ width, height: 844 });
    await button('Expand Query YAML').click();
    await button('Cards (120)').click();
    assert(await cards.evaluate(e => e.scrollHeight > e.clientHeight));
    await button('Raw YAML').click();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await screenshot('mobile-large-yaml');
  await page.goto(`${url}?invalid&missingKey`);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByTitle('View YAML schema documentation').click();
  g = await geometry();
  assert(g.height <= 720 && g.editor.height > 0, JSON.stringify(g));
  assert(await button('Run Search').isDisabled());
  assert(await page.locator('.editor-help').evaluate(e => e.scrollHeight > e.clientHeight));
  await screenshot('desktop-validation-help');
  await page.setViewportSize({ width: 320, height: 844 });
  g = await geometry();
  assert(g.width <= 320, JSON.stringify(g));
  await screenshot('mobile-validation-help');
  await page.goto(`${url}?empty`);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByText('No output generated yet').waitFor();
  assert(await button('Copy YAML').isDisabled() && await button('Download YAML').isDisabled());
  // Exercise the actual App/Header height chain and Search SSE integration with local mocks.
  await page.unroute('**/api/**');
  let configured = true;
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/youtube/search') {
      const events = Array.from({ length: 1200 }, (_, i) => ({ type: 'query_success', id: `query-${i}`, count: 0 }));
      events.push({ type: 'complete', outputYaml: yaml, data: { summary: { queries: 1200, successful: 1200, failed: 0, total_results: 0 }, results: [] } });
      return route.fulfill({ contentType: 'text/event-stream', body: events.map(event => `data: ${JSON.stringify(event)}\n\n`).join('') });
    }
    const data = path === '/api/settings/youtube-api-key' ? { configured, suffix: '1234' }
      : path === '/api/youtube/validate' ? { valid: true, queriesCount: 1200, errors: [] }
      : [];
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.goto(`${url}?app`);
  const input = page.getByRole('textbox', { name: 'YAML Search Definition' });
  await input.fill(`version: 1\nqueries:\n${Array.from({ length: 1200 }, (_, i) => `  - id: query-${i}\n    q: "search ${i}"`).join('\n')}`);
  await button('Run Search').click();
  await raw.waitFor();
  await button('Copy YAML').waitFor();
  for (const size of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 1280, height: 720 }, { width: 1440, height: 480 }, { width: 390, height: 844 }, { width: 320, height: 844 }]) {
    await page.setViewportSize(size);
    g = await geometry();
    assert(g.width <= size.width, JSON.stringify({ size, g }));
    if (size.width >= 1024) {
      assert(g.height <= Math.max(size.height, 720), JSON.stringify({ size, g }));
      for (const control of g.controls) assert(control.bottom <= Math.max(size.height, 720));
    }
    assert(g.editor.height > 0 && g.output.height > 0);
    await screenshot(`app-${size.width}-${size.height}`);
  }
  await button('Queries').click();
  assert.equal(await page.locator('.search-shell').count(), 0);
  await button('Search').click();
  assert((await input.inputValue()).includes('query-1199'));
  assert.equal(await raw.locator('code').textContent(), yaml);
  configured = false;
  await page.goto(`${url}?app`);
  await input.fill('version: 1\nqueries:\n' + Array.from({ length: 100 }, (_, i) => `  - id: error-${i}`).join('\n'));
  await page.getByTitle('View YAML schema documentation').click();
  await page.getByText('Configure your YouTube API key before running a search.').waitFor();
  await page.setViewportSize({ width: 1024, height: 720 });
  g = await geometry();
  assert(g.editor.height > 0 && g.height <= 720, JSON.stringify(g));
  await button('Validate').click();
  g = await geometry();
  assert(g.editor.height > 0 && g.height <= 720, JSON.stringify(g));
  const editorBottom = await page.locator('.yaml-editor').evaluate(e => e.getBoundingClientRect().bottom);
  for (const control of g.controls.slice(0, 2)) assert(control.bottom <= editorBottom, JSON.stringify(g));
  await screenshot('app-missing-key-validation-help');
  for (const control of g.controls) assert(control.bottom <= 720, JSON.stringify(g));
  assert.deepEqual(errors, []);
  console.log('PASS: large YAML/cards, aligned gutters, action access and exports, collapse/state/keyboard, execution/cancel, empty/invalid feedback, desktop/short/mobile/resize.');
} finally {
  await browser.close();
}
