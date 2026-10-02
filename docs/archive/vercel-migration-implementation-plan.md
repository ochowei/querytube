# QueryTube Vercel Migration — Historical Implementation Plan

> Archived planning document. The implementation plan below is retained as historical material and describes an earlier repository state. It is not a deployment checklist or current architecture description.

## Status checked against current `main` (2026-10-02)

| Work area | Current assessment |
|---|---|
| Express app extraction and runtime entrypoints (Phase A) | Implemented in the repository: `server/app.ts` is shared by `api/index.ts` and `server/dev.ts`; `dev` and `start` point to `server/dev.ts`. |
| Vite static build and Vercel Function routing (Phase B) | Implemented in repository configuration: Vite outputs `public/`; `vercel.json` selects Vite, includes Function files, and rewrites unmatched requests to `/api/index`. Actual Preview/Production routing is not verifiable from this checkout. |
| Firebase/Admin configuration (Phase C) | Explicit env-variable checks for Vercel and service-account support are implemented. Actual deployed project/database IDs and whether the configured encryption key can read existing documents are not verifiable here. The checked-in browser Firebase project differs from the server's fallback project; see the [Deployment View](../architecture/deployment-view.md). |
| OpenAPI, public API and process memory (Phase D) | The public router, per-process rate-limit map, OpenAPI loading, and Vercel Function file inclusion are present. Vercel WAF or other account-level settings are outside the repository and unverified. |
| JSON/SSE search (Phase E) | Both response modes, a three-worker query runner, and awaited persistence promises are present in `server/app.ts`. Vercel streaming behavior and effective Function duration require a live deployment check; no `maxDuration` is set in this repository. |
| Documentation and smoke checks (Phase F) | A deployment README exists. The plan's Preview/production smoke checks are not evidenced as completed. The old statement that no test script or test files exist is superseded: `package.json` defines `test` and `tests/` contains test files. |
| Cutover and rollback (Phase G) | Production cutover, active deployments, and availability of the prior deployment cannot be established from repository state. Treat them as unverified operational work. |

The source/configuration work for migration is largely present. Live environment validation, streaming checks, cutover, and rollback status remain unverified, so this archive does not claim that Production has migrated.

### Superseded repository-state statements in the historical plan

The plan's original baseline and some phase descriptions are now stale: the server lifecycle is no longer rooted in the former `server.ts`; the Admin module reads `FIREBASE_PROJECT_ID` and `FIRESTORE_DATABASE_ID` environment variables/fallbacks instead of deriving them from the browser config; `.env.example` now lists both IDs and Admin service-account variables; the AES encryption helper has no source-code key fallback; Vite output is `public/`; and a test script/files now exist. In particular, do not use the historical claims that `firebase-applet-config.json` overrides the server project ID or that the browser and server use the same named database as current facts.

The original plan follows for historical context; its remaining text is preserved as authored and should be read with this status assessment.

這份計劃根據 repo 現況修訂，目標是把部署從 Express 同時提供前後端，改成 Vite 靜態前端加 Vercel Node.js Function，同時保留現有 API、Firestore 資料格式、登入方式、搜尋流程與本機開發方式。

本文件只規劃工作；建立時沒有修改程式碼、安裝依賴、執行測試或部署。

## 1. Repo 現況與原計劃差異

| 項目 | Repo 現況 | 對實作計劃的調整 |
|---|---|---|
| Express lifecycle | `server.ts` 建立 app、註冊 API、掛 Vite middleware 或 `dist`，最後呼叫 `app.listen()`。 | 抽出可匯出的 app；保留薄的本機／Cloud Run 啟動器，避免 migration 期間破壞現有 `dev`、`start` 與 rollback 路徑。 |
| Firebase Admin | 使用 `getApps()` 避免重複初始化；目前未設定 service-account credential，依賴執行環境憑證。Server 會讀 `firebase-applet-config.json`，而且該檔案中的 project ID 會覆蓋 `FIREBASE_PROJECT_ID`。 | Vercel 改用明確的 Admin credential 與環境變數；先查明 Cloud Run 實際使用的 project/database，再設定相同值，避免靜默切換專案。前端仍需保留 `firebase-applet-config.json`。 |
| Firestore database | 使用 named database，ID 由 `firebase-applet-config.json` 讀取；另有程式內 fallback。`.env.example` 尚未列 `FIRESTORE_DATABASE_ID`。 | 將目前實際 database ID 明確設為 `FIRESTORE_DATABASE_ID`，Admin SDK、REST URL 與前端 client 都必須指向同一個既有 database。 |
| Firestore access | 存取方式是混合的：Query Set 與 Search Run 列表、Public API 讀取會用 Admin SDK；部分單筆讀取、建立／更新／刪除及搜尋結果寫入會用使用者 ID token 呼叫 Firestore REST API。 | 不要在拆 app 時順便把整個 service 改成單一存取方式。逐項保留目前讀寫路徑、UID 範圍與錯誤回應。 |
| Public API | 公開讀取透過 Admin SDK 直接讀 Firestore；Query Set 以 `publicApiEnabled` 篩選，Search Run 以自己的 `visibility` 篩選，兩者可獨立公開。另有 query-set 下的 search-runs 相容路由。 | 保留篩選來源、DTO 欄位、404 行為及相容路由；不得用快取決定公開權限。 |
| Memory state | `userSessionKeyMap` 保存解密後的 YouTube key；`FirestoreService` 有 Query Set、Search Run、detail 快取；Public API 有每 IP 每分鐘 100 次的 `Map` rate limiter。部分登入後讀取在暖 instance 會先回快取或遇到 Firestore 失敗時回退快取。 | 不做全域快取刪除或限流策略重設。保留可安全保留的 best-effort 行為，確認 cold start 可從 Firestore 還原；權限與公開可見性仍以 token／Firestore 為準。將 rate limiter 標示為 per-instance 保護，Vercel WAF 門檻另作營運設定。 |
| API key encryption | 基線加密格式為 AES-256-GCM；資料位於 `users/{uid}/integrations/youtube`。原始 `getEncryptionKey()` 在 env 缺少時會採用程式內 fallback；`.env.example` 有列 `USER_API_KEY_ENCRYPTION_KEY`。目前儲存函式會攔下 REST 寫入錯誤，API 仍回成功。 | 上線前必須從現有 Cloud Run 設定確認實際生效的 key，Vercel 設相同值。不 rotate、不改 payload/schema；不能假設 repo fallback 就是 production 使用值。實作已移除 fallback，Vercel 缺少此 env 時啟動失敗。不要讓 process cache 掩蓋持久化失敗。 |
| Frontend | React/Vite；API 使用同源相對 URL。Firebase Google Sign-In 使用 popup 與 local persistence。`App.tsx` 以 React state 切換 tabs，沒有 React Router 或 `/queries`、`/results`、`/settings` 等 URL routes。 | 保留同源 `/api/...` URL 與目前 tab 行為；SPA fallback 不能被誤寫成已支援 URL 深連結，也不加入新 router。 |
| API docs | `/openapi.json` 和 Express Swagger UI `/api-docs/` 由 server 提供；應用內另有 `ApiDocsView`，使用 `swagger-ui-react` 並 fetch `/openapi.json`。YAML 來源為 `openapi/public-api.yaml`。 | 三個入口都要保留；如果 app 移到 `server/app.ts`，修正 YAML 的檔案相對路徑並確保它被 Function bundle 包含。 |
| Local run/build | `dev`、`start` 都執行 `tsx server.ts`；dev 由 Express 掛 Vite middleware，production 分支 serve `dist`；`build` 是 `vite build`；`lint` 是 `tsc --noEmit`。 | 保留現有本機開發及舊 runtime 啟動器，除非之後有明確的切換需求。Vercel preview 另用 `vercel dev` 或部署 preview 確認路由。 |
| Package manager/docs | Repo 有 `bun.lock`，沒有 npm/pnpm lockfile；沒有 `README.md`，也沒有 test script。 | 保留單一 Bun lockfile；不要加入另一種 lockfile。部署說明需新增文件。這次不新增測試框架。 |

### 必須維持的路由與行為

- Authenticated API：`/api/settings/youtube-api-key`、`/api/config`、`/api/youtube/status`、`/api/query-sets...`、`/api/search-runs...`、`/api/youtube/validate`、`/api/youtube/search`。
- Public API：`/api/public/users/:userId/query-sets`、單筆 Query Set、Search Run 列表與單筆詳情，以及 `/api/public/users/:userId/query-sets/:querySetId/search-runs` 相容路由。
- 文件入口：`/openapi.json`、`/api-docs/`，以及 app 內 Swagger 頁面。
- Search endpoint 同時支援 JSON 和 `?stream=true`／`Accept: text/event-stream`。
- Firestore path 維持 `users/{uid}/querySets`、`searchRuns`、`searchRuns/{runId}/queryResults/{queryResultId}/videos/{videoId}`、`integrations/youtube`；不搬資料、不改 schema。

## 2. 實作前置條件與決策門

1. 從 Cloud Run 現有環境設定確認實際 Firebase project ID、named Firestore database ID、`USER_API_KEY_ENCRYPTION_KEY` 的生效值及 Admin 身分來源。這些值不能從 repo 推定；若無法確認舊 encryption key，先不切換使用者 key 的讀寫流量。
2. 在 Vercel 專案確認 Node runtime 版本、方案／Fluid Compute 設定及函式最長執行時間。Search YAML 沒有目前可見的 query 數上限；不能只依範例把 `maxDuration` 寫成 300 秒。依實際方案設定並用正常最大工作量驗證 SSE。若工作可能超出上限，暫停 cutover，另行討論相容方案，不在 migration 中悄悄改成 polling 或非同步 job。
3. 用 Vercel preview/`vercel dev` 驗證 Vite 靜態輸出與 `api/index.ts` Express Function 的 route mapping。使用 Vite preset 發布 build 產生的 `public/`；未匹配靜態檔的請求 rewrite 到單一 Express Function。確認巢狀 `/api/*`、`/openapi.json`、`/api-docs/` 會到 Express，且 Express 收到的 pathname 保持原值。
4. Vercel 文件目前說明 Express app 會作為單一 Function 部署，且 `express.static()` 不負責提供靜態檔；本 repo 應由 Vite build 輸出靜態前端，Function 只負責 backend。參考：[Express on Vercel](https://vercel.com/docs/frameworks/backend/express)、[Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite)。

## 3. 分階段 Implementation Plan

### Phase A — 抽出 Express app，保持舊啟動器

**新增／調整**

- 新增 `server/app.ts`：建立 Express app、JSON middleware、認證 middleware 與現有 routes，最後 export app；不呼叫 `listen()`、不掛 Vite、不 serve 靜態檔。
- 新增 `server/firebaseAdmin.ts`：集中初始化 Admin app、Auth、named Firestore database；沿用 `getApps()` 防止 warm instance 重複初始化。
- 使用 `api/index.ts` 作為 Vercel Function entrypoint，default export 同一個 app；`server.ts` 保留 root Express export，`server/dev.ts` 保留 Vite dev middleware、本機／Cloud Run static + SPA fallback 與 `PORT` listener。
- `dev`、`start` scripts 改指向 `server/dev.ts`，維持命令與本機／Cloud Run listener 行為；Vercel entrypoint 不呼叫 `listen()`，也不讀取 `PORT`。部署環境若使用自訂命令直接執行 `server.ts`，cutover 前須確認改用 `npm start`／`bun run start`。

**相容性檢查**：保留 route 順序、middleware、JSON 10 MB limit、status code、錯誤 body、SSE 事件內容及同源路徑。搬移檔案後檢查 `__dirname`／`import.meta.url` 相對路徑，尤其是 OpenAPI YAML。

### Phase B — Vercel Function 與 Vite 靜態部署

**新增／調整**

- 使用 `api/index.ts` 作為 Vercel Node Function entrypoint，匯出同一個 Express app；明確設定 `framework: "vite"`、`outputDirectory: "public"`，並將未匹配靜態檔的請求 rewrite 到 Express。原生 Express preset 沒有收集 build 時才產生的 Vite 資源，已實測造成 JS URL 回傳 SPA HTML，因此改由 Vite preset 發布靜態產物。
- 新增最小 `vercel.json`：執行 Vite build，並將 `openapi/public-api.yaml` 與 SPA entry file 納入 Function。Function duration 沿用 Vercel project 設定，不在未知方案下硬編上限；preview 時確認最長正常 SSE request 可在實際 duration 內完成。
- Vite 改輸出 `public/`，讓 Vercel 透過 CDN 提供靜態檔；Express 不負責 Vercel production 的 `express.static()`。
- Vercel 靜態檔交由 CDN 提供，非靜態請求需到 Express。舊 production launcher 的最後一條 `app.get('*')` 會把未知 GET path（包含未定義的 `/api/*`）回傳為 SPA；目前 app 保留這個行為。已列出的 API path 必須完全相容；若要調整未知 API path 的 fallback，先確認沒有 client 依賴並把差異限制在未定義路徑。

**相容性檢查**：Vercel preview 逐一確認 `/api/query-sets`、`/api/public/...`、`/openapi.json`、`/api-docs/`，並確認前端呼叫仍是同源 URL，不需大量更改 `src`。

### Phase C — Admin credentials 與既有 Firebase 資料

**環境變數**

| 變數 | Repo 現況 | 實作要求 |
|---|---|---|
| `USER_API_KEY_ENCRYPTION_KEY` | 已在 `.env.example`；source 有 fallback。 | Vercel 設為 Cloud Run 實際生效的同一值；不得 rotate。 |
| `FIREBASE_PROJECT_ID` | 已在 `.env.example`；目前可被 applet JSON 覆蓋。 | Vercel 明確設定舊 backend 實際使用的 project；取消 server 對 frontend JSON 的執行期依賴前，先比對一致。 |
| `FIRESTORE_DATABASE_ID` | `.env.example` 未列；目前從 applet JSON 取得並有程式內 fallback。 | 新增至範例；設定成目前 named database，供 Admin 與 REST URL 共用。 |
| `FIREBASE_CLIENT_EMAIL`、`FIREBASE_PRIVATE_KEY` | 範例未列；Admin 目前使用環境身分。 | Vercel 使用安全的環境變數注入 Admin service-account credential；private key 僅存在 Vercel server environment，不放入 repo、不加 `VITE_` prefix。 |
| `PORT` | 範例與舊啟動器有使用。 | 保留給本機／Cloud Run 相容啟動器；Vercel app 不依賴它。 |

前端繼續從 `firebase-applet-config.json` 讀 Firebase Web config、Google Auth 與同一個 named database。該檔案中的 Web API key 是 client config，不等同 Admin private key；不要因 credential migration 移除前端必要設定。

**資料存取相容性**

- 建立 route/service 存取矩陣，保留現有 Admin SDK 與使用者 ID token + Firestore REST 混用方式；這次不做全服務改寫。
- Admin SDK 必須連到同一 project 與 named database；Public API 保持直接讀 Firestore，並保持 Query Set 與 Search Run 各自的公開判定。
- 保留 Firebase Auth popup、ID token 驗證、protected route 的 UID 範圍與 Firestore rules；不得把 Admin 權限暴露至 client。
- 保留 AES-256-GCM 欄位、`keyVersion` 與既有 integration document path；新 instance 必須能從 Firestore REST 讀取並解密既有 key。
- Repo 目前的 `persistUserIntegration()` 會吞掉 REST 寫入失敗，而 API 仍回成功；搜尋結果與 summary 寫入也有攔下失敗的路徑。抽離 app 時先保留既有 response/event contract，不把 memory 命中當作已持久化。若要讓失敗寫入回報不同 HTTP/event 結果，列為明確、範圍受限的相容性變更，不隨架構拆分暗中加入。

### Phase D — Memory、Public API 與 OpenAPI 部署檔

- 逐項標記目前 module-level `Map` 的用途、讀取順序、失敗 fallback 與可見性影響。保留安全的效能快取；確認冷啟動時來源資料可從 Firestore 載入。Public API 的 `publicApiEnabled`／`visibility` 判斷不可依賴 cache。
- 保留 `server/publicApi.ts` 現行每 IP 每分鐘 100 次的 limiter 作為 per-instance best effort，且文件不宣稱它是 distributed limit。若要配置 Vercel WAF，門檻與生效環境列為部署設定，不能默默以另一組規則替代。
- `server/app.ts` 從穩定的 module-relative path 讀取 `openapi/public-api.yaml`，並在 Vercel Function 設定中確認該 YAML 有被打包。保持 JSON endpoint、Express Swagger UI 與應用內 Swagger UI 的既有路徑／功能。

### Phase E — SSE Search 與執行時間

- 保留 `POST /api/youtube/search` 的 JSON 回應與 SSE 模式，不換 polling、不改 event schema、不新增 query 數限制。
- 保留現有 `start`、`query_start`、`query_success`、`query_error`、`fatal_error`、`complete` 事件名稱和欄位；目前 3 個 query 並行，完成事件在 query/video 寫入 promises 與 Search Run summary 更新後才送出，實作時維持此先後關係。寫入 helper 目前會攔下部分 Firestore 錯誤；promise settled 不保證 Firestore 接受所有文件，將此列為既有 persistence risk。
- 在 Vercel Node Function 上確認 `res.write()` 確實逐段送到瀏覽器、事件在多 query 下可交錯但欄位正確，且標準 JSON 模式仍可用。
- 依實際 Vercel plan/project duration 與正常最大 YAML 執行時間判斷是否需要設定 `maxDuration`；Vercel Express 使用 Fluid Compute 時目前文件列出 300 秒預設值，Pro／Enterprise 可依方案提高。參考：[Streaming](https://vercel.com/docs/functions/streaming-functions)、[Function duration](https://vercel.com/docs/functions/configuring-functions/duration)。不要只靠本機測試推斷最長時間。

### Phase F — Preview 驗證與設定文件

Repo 目前沒有測試工具或 `test` script；migration 不額外引入測試框架。使用現有 `bun.lock` 對應的 Bun 安裝方式，執行既有 `lint`／`build` scripts，再用 Vercel preview 和人工 smoke checklist 驗證。

人工 smoke checklist：

1. 首頁載入、Google Sign-In／Sign-Out；Vercel domain 已加入 Firebase Authorized domains。
2. 有效／無效 ID token 的 2xx／401 行為一致。
3. API key 新增、驗證、刪除；確認既有 Firestore 加密資料在新 instance 可解密。
4. Query Set CRUD、public toggle；Search Run list/detail/delete/visibility。
5. JSON search、SSE search 及完成後資料可在重新請求／cold start 後載入。
6. Public Query Set／Search Run 的公開與 private 邊界、相容 route、404 行為。
7. `/openapi.json`、`/api-docs/`、應用內 Swagger 與使用者／resource 預填資訊。
8. 首頁和任意目前由 Express fallback 接受的 frontend URL 可載入；未知 GET 路徑維持目前回傳 SPA 的行為，包括尚未定義的 `/api/*`。
9. 檢查 production client bundle 不含 Admin private key、encryption key 或 YouTube key。保留 Firebase Web config。
10. 檢查 production logs 不輸出 ID token、API key 或 private key；目前 YouTube key 新增／刪除 log 會帶完整 UID，依原計劃要求改成 UID prefix，且不要記錄 key 值。

新增 `README.md`，說明 local dev 命令、Bun 安裝、Vercel build／output、環境變數名稱、Firebase Authorized domains 與 service account 設定方式；文件只列敏感變數名稱，不列值。

### Phase G — Cutover 與 rollback

- 先部署 Vercel Preview 並完成上節檢查，再建立 Production 環境變數和 Vercel production deployment。
- migration 範圍不刪除 Cloud Run service、AI Studio metadata、Firebase 資源或 production data；維持舊部署可用，確認 Vercel 穩定後再另行決定停止舊部署。
- 若錯誤指向 project/database/key、路由或 SSE timeout，回復流量到舊部署，不執行 Firestore data migration 或 schema 修改。

## 4. 交付檔案預期

實作階段新增：`server/app.ts`、`server/firebaseAdmin.ts`、`server/dev.ts`、`api/index.ts`、`vercel.json`、`README.md`。修改：`server.ts`、`package.json`、`.env.example`、`.gitignore`、`vite.config.ts`。不改 Firestore schema、API URL、React UI 流程或 Firebase provider。

## 5. Cutover Acceptance Criteria

- Function 與 Vite 靜態前端都能從同一 Vercel domain 工作；現有 API、OpenAPI 和 docs URL 沒有變更。
- Google Sign-In、token verification、API key 加解密、Query Set、Search Run、Public API、SSE 與 JSON search 維持既有 contract。
- Admin SDK、Firestore REST 與 Firebase client 指向已核實的同一 project/database；既有文件無需搬遷。
- Cold start 不依賴任何 instance memory 才能取得持久資料；Public API 不會因 cache 暴露 private resource。
- SSE 的正常最大工作量在 Vercel 該方案可用執行時間內完成；否則不 cut over，先處理架構／方案決策。
- Vercel client bundle 無 server-side secrets；Cloud Run／AI Studio rollback 路徑仍在。
- 本機 `npm run lint`、`npm run build` 已通過；Vercel Preview 路由、SSE、Firestore 與 Firebase Auth smoke checks 尚待部署時執行。
