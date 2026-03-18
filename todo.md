## DB Client App Feature Checklist

Legend: `[x]` Done · `[~]` Partial · `[ ]` Not started

---

## Core Features

### Database Connections

- [x] Connect to multiple databases — simultaneous connections, each with its own state in Zustand
- [x] MySQL support — SQLx driver in `src-tauri/src/db/mysql.rs`
- [x] PostgreSQL support — SQLx driver in `src-tauri/src/db/postgres.rs`
- [x] SQLite support — SQLx driver in `src-tauri/src/db/sqlite.rs`
- [x] MongoDB support — basic driver in `src-tauri/src/db/mongodb.rs` (schema-less, limited query support)
- [x] Redis support — basic driver in `src-tauri/src/db/redis_driver.rs` (key-value command execution)
- [ ] SQL Server support — no driver; not in roadmap yet
- [x] Save connections — AES-encrypted in localStorage (`db_connections_v3`)
- [ ] Group connections (dev, staging, prod) — connections are flat in sidebar; no tagging or grouping
- [~] Quick connect — URI/connection string field supported; no one-click presets

---

### Storage Improvements (Priority)

- [x] **Migrate connection storage from localStorage to SQLite (Tauri side)** — `src-tauri/src/storage.rs` manages a SQLite DB at `{app_data_dir}/storage.db` via sqlx; 6 new Tauri commands handle CRUD; one-time migration from legacy localStorage on first launch
- [x] **Encrypt connection credentials at rest with a machine-generated key** — replaced hardcoded AES key in `encryption.ts` with a random 32-byte key generated on first run and stored at `{app_data_dir}/storage.key`; AES-256-GCM used on the Rust side; key never touches JS
- [x] **Persist Zustand saved queries to SQLite** — `saveQuery` / `deleteSavedQuery` now call `storage_save_query` / `storage_delete_query` Tauri commands; loaded from SQLite on startup
- [x] **Zustand store reads/writes via Tauri commands** — `loadConnections` is now async and calls `storage_load_connections`; writes are fire-and-forget Tauri calls keeping Zustand API synchronous for callers
- [x] **Separate connection metadata from credentials** — SQLite stores host/port/type/prefix in plaintext columns; only `encrypted_password` column holds the AES-GCM ciphertext; decrypted in Rust before returning to frontend
- [ ] **OS keychain for encryption key** — current approach stores the key as a file in app data dir; next step is `tauri-plugin-stronghold` or `tauri-plugin-keychain` for true OS keychain storage

---

### Connection Security

- [ ] SSH tunneling — not implemented; listed in README upcoming
- [~] SSL or TLS encryption — `ssl` field exists in `ConnectionConfig` but not wired into drivers
- [x] Credential management — passwords stored encrypted via AES (`src/lib/encryption.ts`)
- [x] Secure password storage — AES encryption on save/load; note: default key is hardcoded — see Storage Improvements below

---

### Query Editor

- [x] SQL editor — CodeMirror 6 in `FunctionOutput.tsx` with One Dark theme
- [x] Syntax highlighting — `@codemirror/lang-sql` with keyword coloring
- [x] Auto completion — schema-aware autocomplete using table/column names injected into CodeMirror
- [x] Multi query tabs — multiple `ResultTab[]` managed in Zustand; tabs persist across function switches
- [x] Query history — per-connection history (max 100 entries), `QueryHistoryEntry[]`
- [x] Favorite queries — `SavedQuery` type persisted to localStorage; inline save UI in editor panel

---

### Table Management

- [x] View tables — `prefix_list()` fetches all tables; shown in sidebar tree
- [ ] Create table — no DDL UI; writable via SQL editor only
- [ ] Alter table — no UI; manual SQL only
- [ ] Drop table — no UI; manual SQL only
- [ ] Rename table — no UI; manual SQL only
- [~] Manage indexes — index info shown in Structure tab (columns, uniqueness, type) but read-only
- [ ] Visual schema editor — Structure tab is read-only; no editing UI

---

### Data Viewer

- [x] Spreadsheet view — TanStack React Table v8 with sortable columns and row numbers
- [x] Inline editing — double-click cell generates UPDATE with primary key WHERE clause
- [ ] Form view — grid only; no single-row form layout
- [x] Pagination — 50 rows per page with navigation controls in table footer
- [x] Insert rows — via CSV/JSON import panel (batched INSERT statements, 200 rows/batch)
- [x] Update rows — inline cell editing with auto-generated UPDATE
- [ ] Delete rows — no delete row UI; requires manual DELETE in SQL editor

---

### Data Filtering and Search

- [x] Advanced filters — visual WHERE builder with column/operator/value inputs
- [x] Multi condition filtering — multiple AND conditions, SQL WHERE clause generated and applied
- [~] Quick search — table filter in sidebar (by name); no full-text cell search in grid

---

### Multi Tabs and Workspace

- [x] Multiple tabs — result tab bar at top of main panel; tabs closeable
- [x] Open multiple databases — database selector dropdown per connection; switching re-fetches schema
- [x] Quick switching — tab bar + Command Palette (⌘K) for fast function/table navigation

---

## Data Import and Export

- [x] Import CSV — file upload, CSV parse, batched INSERT
- [x] Import JSON — file upload, JSON array parse, batched INSERT
- [x] Export CSV — download from grid data
- [x] Export JSON — download from grid data
- [ ] Export SQL dump — no schema+data dump; data export only (CSV/JSON)

---

## Advanced Features

### Query Execution

- [~] Run multiple queries — can write multiple statements in editor; executed as single batch, not individually
- [x] Async execution — all Tauri commands are `async fn`; UI non-blocking
- [ ] Streaming results — results loaded in full; no streaming for large datasets
- [x] Result tabs — multiple result tabs open at once per SQL editor session

---

### Safety and Review

- [ ] Preview SQL before execution — no dry-run or preview mode; executes on Run
- [ ] Safe mode — no confirmation dialog for destructive queries (DELETE, DROP, TRUNCATE)
- [ ] Change tracking — no transaction/undo UI
- [ ] Undo changes — no undo for inline cell edits once committed

---

### Database Management

- [ ] Backup database — not implemented
- [ ] Restore database — not implemented
- [ ] Clone database — not implemented

---

### Performance Tools

- [x] Query execution time — shown in ms in result header after each query
- [ ] Query plan viewer — no EXPLAIN/ANALYZE UI
- [ ] Index suggestions — no automatic index recommendations

---

### Productivity

- [x] Keyboard shortcuts — ⌘K (command palette), ⌘↵ (execute SQL), Esc (cancel edit)
- [x] Command palette — fuzzy search across all functions grouped by connection prefix
- [x] Quick navigation — sidebar tree + command palette cover all navigation needs

---

## UI and UX

- [x] Clean minimal UI — shadcn/ui + Tailwind CSS v4 with custom design tokens
- [x] Native like performance — Tauri 2 (Rust backend), no Electron overhead
- [x] Dark mode — full dark theme with CSS custom properties
- [x] Light mode — light theme toggle via Command Palette or theme switcher
- [x] Split view layout — `react-resizable-panels` for sidebar/main split + editor/results vertical split
- [x] Sidebar navigation — collapsible connection tree with DB logos, table list, quick access
- [x] Resizable panels — drag-to-resize sidebar and editor/results panels

---

## Developer Features

### Code Generation

- [ ] Generate SQL queries — no AI or template-based SQL generation
- [ ] Generate ORM models — no TypeScript/Python/Go model export from schema

---

### Versioning

- [ ] Schema version tracking — no migration history or schema snapshots
- [ ] Migration support — no migration runner or tracking UI

---

### Logs and Debugging

- [x] Query logs — in-memory query history per connection with timestamps and duration
- [~] Error logs — errors shown as toast notifications; not persisted or filterable
- [ ] Debug mode — no verbose logging toggle or debug panel

---

## Collaboration Features

- [ ] Share connections — connections stored in local storage only
- [ ] Team workspace — single-user app; no sync or sharing
- [ ] Role based access — no user/role system

---

## Unique Features

### AI Features

- [ ] AI query generator — no LLM integration
- [ ] Natural language to SQL — no text-to-SQL feature
- [ ] Query optimization suggestions — no AI-based recommendations

---

### Visual Tools

- [ ] ER diagram generator — in README upcoming list
- [ ] Schema visualization — no visual schema or relationship map
- [ ] Drag and edit relations — not implemented

---

### Multi Database Insights

- [ ] Compare databases — no schema comparison tool
- [ ] Sync schema — not implemented
- [ ] Diff viewer — no diff UI for schemas or data

---

### Offline Features

- [x] Local query history — in-memory per-session history (lost on app restart)
- [~] Offline schema browsing — schema cached in Zustand after first connect; requires live connection to refresh
- [ ] Sync later — no offline queue or deferred sync

---

### Plugin System

- [ ] Plugin architecture — no extension API
- [ ] Install extensions — not supported
- [ ] Custom drivers — drivers are built-in; no dynamic loading

---

## Next Level Features

### DevOps Integration

- [ ] CI or CD database checks — no CI integration
- [ ] Migration automation — no migration execution or tracking

---

### Cloud Integration

- [x] AWS RDS support — works via standard PostgreSQL/MySQL connection config + URI field
- [x] Supabase support — PostgreSQL driver connects to Supabase using connection string
- [ ] Firebase support — no Firestore/Firebase driver
- [~] Remote database management — URI field supports remote connections; no SSH/bastion/proxy

---

## MVP Priority

- [x] Database connections
- [x] Query editor
- [x] Table viewer
- [x] Data editing
- [x] Basic filtering
- [x] Import and export

---

## Key Focus

- [x] Fast query execution
- [x] Clean UI
- [x] Keyboard driven workflow

---

## Progress Summary

| Category | Done | Partial | Todo |
|---|---|---|---|
| Connections | 6 | 1 | 3 |
| Security | 2 | 1 | 1 |
| Query Editor | 6 | 0 | 0 |
| Table Management | 2 | 1 | 5 |
| Data Viewer | 5 | 0 | 2 |
| Filtering | 2 | 1 | 0 |
| Workspace | 3 | 0 | 0 |
| Import/Export | 4 | 0 | 1 |
| Query Execution | 2 | 1 | 1 |
| Safety | 0 | 0 | 4 |
| DB Management | 0 | 0 | 3 |
| Performance | 1 | 0 | 2 |
| Productivity | 3 | 0 | 0 |
| UI/UX | 7 | 0 | 0 |
| Code Generation | 0 | 0 | 2 |
| Versioning | 0 | 0 | 2 |
| Logs | 1 | 1 | 1 |
| Collaboration | 0 | 0 | 3 |
| AI Features | 0 | 0 | 3 |
| Visual Tools | 0 | 0 | 3 |
| Multi DB Insights | 0 | 0 | 3 |
| Offline | 1 | 1 | 1 |
| Plugin System | 0 | 0 | 3 |
| DevOps | 0 | 0 | 2 |
| Cloud | 2 | 1 | 1 |
| **Total** | **57** | **9** | **47** |

**~50% of planned features implemented.** Core database client functionality (connect, query, browse, edit, import/export) is solid. Major upcoming work: SSH tunneling, DDL UI, safety/review mode, ER diagrams, AI features, and collaboration.
