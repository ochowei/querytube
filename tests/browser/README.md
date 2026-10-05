# Search workspace browser regression

This credential-free fixture exercises real Search presentation components and the actual App/Header with mocked authentication and API responses. It never reads a real session, calls YouTube, or writes persisted data. The runner covers 2,402 input lines, 6,000 output lines, 120 card groups, 1,200 execution entries, copy/download contents, collapse/restore state and keyboard access, invalid/empty output, schema help, missing-key setup, and desktop/mobile/short-window resizing.

Start the installed Vite executable from the repository root:

```sh
./node_modules/.bin/vite --host 127.0.0.1 --port 5174
```

With an existing Playwright installation and Chromium available:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
BROWSER_EXECUTABLE=/absolute/path/to/chromium \
node tests/browser/search-workspace.mjs
```

If Playwright is resolvable locally and its browser is installed, omit those variables. Optional `SEARCH_WORKSPACE_URL` overrides the fixture URL; optional `SCREENSHOT_DIR` saves screenshots to an existing directory. Browser checks are separate from `npm test` to avoid adding application dependencies or requiring Chromium for existing Node tests. Do not use the fixture without the runner's authentication interception: Header imports the normal AuthContext module.
