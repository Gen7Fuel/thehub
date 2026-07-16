# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Services Overview

This is a multi-service monorepo with four independently deployable apps:

| Service | Port | Description |
|---|---|---|
| `frontend` | 5173 (dev) / 3000 (prod via Caddy) | React + TanStack Router SPA |
| `backend` | 5000 | Main Express API |
| `auth-backend` | 5005 | Auth/login service |
| `cdn` | 5001 | File upload/download service |

Production traffic flows through **Caddy** (reverse proxy) which routes to `backend` and `auth-backend`. The CDN and auth-backend are also directly exposed. All services share MongoDB and Redis on an internal Docker bridge network (`172.22.0.0/24`).

## Commands

### Frontend
```bash
cd frontend
npm run dev          # Vite dev server on port 5173
npm run build        # tsc + vite build
npm test             # Run all tests (vitest)
npm run test:watch   # Watch mode
# Run a single test file:
npx vitest run src/routes/_navbarLayout/__tests__/cash-summary.test.tsx
```

### Backend
```bash
cd backend
npm run dev    # nodemon -L app.js
npm start      # node app.js
vitest run     # Run all tests
# Run a single test file:
vitest run __tests__/cashSummary.test.js
```

### Auth Backend
```bash
cd auth-backend
npm run dev    # nodemon app.js
npm start      # node app.js
```

### CDN
```bash
cd cdn
node index.js
```

### Docker
```bash
docker compose -f compose.dev.yaml up    # Development (hot-reload)
docker compose -f compose.yaml up        # Production
```

## Architecture

### Request Flow
```
Browser → Caddy (:3000) → backend (:5000)     [/api/*]
                        → auth-backend (:5005)  [/login-auth/*]
Browser → CDN (:5001) directly                 [/cdn/*]
```

### Authentication & Permissions

Auth is JWT-based. The token is sent as `Authorization: Bearer <token>` on every request.

**`backend/middleware/authMiddleware.js`** exports two middleware functions:
- `auth` — HTTP request middleware; verifies JWT, loads user+role from MongoDB
- `authSocket` — Socket.IO handshake middleware (token via `socket.handshake.auth.token`)

**Permission system** is two-tier: user-level overrides take priority, then role-based permissions. Permissions are dot-separated strings (e.g., `accounting.cashSummary.form`). Routes pass the required permission via the custom header `X-Required-Permission`. A global permission map is cached in memory.

**Maintenance mode** is enforced inside `auth` middleware — all requests blocked except `/api/maintenance` and users with `settings.maintenance` permission.

In `backend/app.js`, routes mounted *before* `app.use(auth)` are public. Everything after requires a valid token.

### Frontend Routing

File-based routing via TanStack Router Vite plugin. Route files live in `frontend/src/routes/`. The generated route tree (`src/routeTree.gen.ts`) is auto-updated — never edit it manually.

- `__root.tsx` — root layout (providers, global wrappers)
- `_navbarLayout.tsx` — shared navbar layout for authenticated pages
- Route loaders handle data fetching server-side (before render); use `useLoaderData()` to consume

Auth context is at `frontend/src/context/AuthContext` — use `useAuth()` to get the current user and their `access` object.

### Backend Structure

- `backend/app.js` — entry point; registers all routes, middleware, cron jobs, Socket.IO
- `backend/routes/` — one file per feature (e.g., `cashRecRoutes.js`, `cycleCountRoutes.js`)
- `backend/models/` — Mongoose schemas
- `backend/middleware/` — `authMiddleware.js`, permission checking
- Cron jobs: `cycleCountCron`, `fuelInventoryReportCron`, `auditIssueReportCron`, `mongoCsvExportCron`, `logoutUsersCron`
- BullMQ email queue backed by Redis
- SFTP integrations for multiple store locations (Rankin, Couchiching, Jocko Point, etc.)
- Azure Blob Storage for file backups
- MSSQL (external, not in Docker) for legacy data

**auth-backend shares backend's models, not its own copies.** `auth-backend/models/` is a tracked-but-empty directory; `compose.dev.yaml`/`compose.yaml` bind-mount `backend/models` (and `backend/utils/attachSiteAlias.js`) straight into the auth-backend container at runtime. If a model file gains a new `require("../utils/...")`, that util file needs a matching bind mount added to both compose files' `auth-backend` service, or auth-backend will crash at startup with `MODULE_NOT_FOUND`. Also note `backend` and `auth-backend` run different major Mongoose versions (8 vs 9) with independent `node_modules` — any code shared this way must avoid Mongoose 9's removed callback-style (`next`) middleware.

### CDN Service

Simple Express app (`cdn/index.js`). Files stored on disk in `uploads/`. Supports multipart and base64 upload. Admin endpoints (`GET /cdn/files`, `DELETE /cdn/delete/:id`) require `Authorization: Bearer <CDN_ADMIN_TOKEN>` (set via environment variable).

## Test Patterns

### Backend tests (`backend/__tests__/`)
- Use `vitest` with Node environment
- Import Mongoose models directly — **no DB connection**; use `.validateSync()` for schema validation
- Helper factory functions (e.g., `baseShift()`) build minimal valid documents

### Frontend tests (`frontend/src/routes/**/__tests__/`)
- Use `vitest` with jsdom + React Testing Library
- `vi.hoisted()` — declare mutable mock state before `vi.mock()` factories
- Wrap renders in `<React.Suspense>` (lazy-loaded route components require it)
- Use `waitFor({ timeout: 5000 })` on the first assertion — lazy component load can take >1s
- Mock `global.fetch` for components that call APIs directly
- `fireEvent.submit(form)` bypasses HTML5 `required` validation; use it when testing form validation logic

### TanStack Router mock pattern (frontend tests)
```ts
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    createFileRoute: () => (config) => ({
      ...config,
      fullPath: '/your-route',
      useLoaderData: mockUseLoaderData,
      useSearch: mockUseSearch,
    }),
    useNavigate: () => mockNavigate,
  }
})
```

## Key External Integrations

- **MongoDB** (`mongo:8`) — primary datastore
- **Redis** (`redis:7`) — BullMQ job queue + caching
- **MSSQL** — external SQL Server (env vars: `MSSQL_*`)
- **SFTP** — per-location file ingestion (shift worksheets, SFT files)
- **Azure Blob Storage** — backup exports
- **Nodemailer** — transactional email via BullMQ queue
- **pdfkit** — PDF generation for reports

## Desk Integration

**Desk** (`C:\Users\MohammadHasan\workspace\desk`) is a sibling internal tool for Gen7 Fuel covering fuel invoicing, personnel, assets, credentials, subscriptions, and Sage accounting. Its frontend "Hub" pages call Hub APIs directly from the browser, and its backend proxies Sage Intacct calls.

### Desk backend structure (`desk/backend/`)
```
backend/
├── index.js              # Entry point; mounts all app routers
├── middleware/
│   └── auth.js           # JWT middleware (Desk-issued tokens)
└── apps/                 # Feature domains — each has *.model.js + *.routes.js
    ├── sage/             – Proxies to Sage Intacct REST API
    │   └── sage.routes.js    POST /api/sage/connect, /bill, /invoice,
    │                          /other-receipt, /attachment;
    │                          GET  /api/sage/entity/:key, /department/:key
    ├── fuel-invoicing/   – Kardpoll Excel parsing, fuel invoice upload
    ├── auth/             – Login, JWT issuance (embeds externalToken from Hub)
    ├── users/ roles/ personnel/ credentials/ assets/ access/
    ├── subscriptions/ cipher/ inventory/
    └── ...
```

### Desk frontend structure (`desk/frontend/src/`)
```
src/
├── routes/
│   ├── _appbar.tsx               # Authenticated layout + nav
│   ├── _appbar/_sidebar/hub/    # Pages that call Hub APIs directly
│   │   ├── cash-management.tsx   – Multi-day cash rec + Sage Other Receipt
│   │   ├── payables.tsx
│   │   ├── receivables.tsx
│   │   └── cdn.tsx
│   └── (auth)/login.tsx
├── lib/
│   ├── api.ts            # apiFetch() — wraps fetch with Desk JWT
│   └── permissions.ts    # getTokenPayload(), can(), getExternalToken pattern
└── components/custom/
    └── SitePicker.tsx    # Dropdown fetching /api/locations from Hub
```

### Auth flow between Desk and Hub
1. User logs in to Desk → Desk `auth` backend validates credentials and calls Hub to obtain a short-lived `externalToken`.
2. Desk issues its own JWT containing the Hub `externalToken` as a nested field.
3. Desk frontend hub pages extract `externalToken` from the Desk JWT and use it as the Bearer token for all Hub API calls.
4. Hub's `authMiddleware.js` validates the `externalToken` on every request.

### Hub endpoints called by Desk

| Hub endpoint | Desk file |
|---|---|
| `GET /api/cash-rec/entries` | `hub/cash-management.tsx` |
| `GET /api/cash-rec/tags` | `hub/cash-management.tsx` |
| `POST /api/cash-rec/tags` | `hub/cash-management.tsx` |
| `DELETE /api/cash-rec/tags` | `hub/cash-management.tsx` |
| `GET /api/cash-rec/kardpoll-entries` | `hub/cash-management.tsx` |
| `GET /api/locations` | `SitePicker.tsx`, `hub/cash-management.tsx` |
| `GET /api/purchase-orders` | `hub/cash-management.tsx` |
