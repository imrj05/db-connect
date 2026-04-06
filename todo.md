## DB Client App Feature Checklist

Legend: `[x]` Done · `[~]` Partial · `[ ]` Not started

---

## Core Features

### Database Connections

- [x] Connect to multiple databases — simultaneous connections, each with its own state in Zustand
- [x] MySQL support — SQLx driver in `src-tauri/src/db/mysql.rs`
- [x] PostgreSQL support — SQLx driver in `src-tauri/src/db/postgres.rs`
- [x] SQLite support — SQLx driver in `src-tauri/src/db/sqlite.rs`
- [x] MongoDB support — full driver in `src-tauri/src/db/mongodb.rs`; `run_query()` handles SQL UPDATE/DELETE mapped to MongoDB ops; `get_table_data()` paginates collections
- [x] Redis support — basic driver in `src-tauri/src/db/redis_driver.rs` (key-value command execution)
- [ ] SQL Server support — no driver; not in roadmap yet
- [x] Save connections — persisted in Tauri-side SQLite via `src-tauri/src/storage.rs`; credentials remain encrypted at rest
- [x] Group connections (dev, staging, prod) — optional `group` field on `ConnectionConfig`; persisted in SQLite `group_name` column; sidebar renders collapsible group headers with folder icons
- [x] Quick connect — one-click preset chips (Local PG, Local MySQL, SQLite, MongoDB, Redis) at top of ConnectionDialog; clicking fills engine + connection fields automatically

---

### Storage Improvements (Priority)

- [x] **Migrate connection storage from localStorage to SQLite (Tauri side)** — `src-tauri/src/storage.rs` manages a SQLite DB at `{app_data_dir}/storage.db` via sqlx; 6 new Tauri commands handle CRUD; one-time migration from legacy localStorage on first launch
- [x] **Encrypt connection credentials at rest with a machine-generated key** — Rust generates a random 32-byte key on first run; AES-256-GCM is used on the storage layer and the key is kept out of JS
- [x] **Persist Zustand saved queries to SQLite** — `saveQuery` / `deleteSavedQuery` now call `storage_save_query` / `storage_delete_query` Tauri commands; loaded from SQLite on startup
- [x] **Zustand store reads/writes via Tauri commands** — `loadConnections` is now async and calls `storage_load_connections`; writes are fire-and-forget Tauri calls keeping Zustand API synchronous for callers
- [x] **Separate connection metadata from credentials** — SQLite stores host/port/type/prefix in plaintext columns; only `encrypted_password` column holds the AES-GCM ciphertext; decrypted in Rust before returning to frontend
- [x] **OS keychain for encryption key** — `keyring` crate stores the key in macOS Keychain / Windows Credential Manager / Linux Secret Service; legacy `storage.key` file is migrated and deleted on first launch

---

### Connection Security

- [x] SSH tunneling — connection dialog includes SSH tunnel fields and backend tunnel setup/cleanup is handled in `src-tauri/src/commands.rs` + `src-tauri/src/ssh.rs`
- [x] SSL or TLS encryption — PostgreSQL and MySQL drivers apply `ssl` via `PgSslMode` / `MySqlSslMode`; Redis URI export also supports `rediss://`
- [x] Credential management — passwords and SSH secrets are encrypted in the Tauri storage layer and decrypted only when Rust returns connection configs to the frontend
- [x] Secure password storage — AES-256-GCM at rest with a per-machine key stored via OS keychain integration
- [x] Test connection — "Test Connection" button in ConnectionDialog validates credentials before saving

---

### Query Editor

- [x] SQL editor — CodeMirror 6 in `FunctionOutput.tsx` with One Dark theme
- [x] Syntax highlighting — `@codemirror/lang-sql` with keyword coloring
- [x] Auto completion — schema-aware autocomplete using table/column names injected into CodeMirror
- [x] Multi query tabs — multiple `ResultTab[]` managed in Zustand; tabs persist across function switches
- [x] Query history — per-connection history (max 100 entries), `QueryHistoryEntry[]`
- [x] Favorite queries — `SavedQuery` records are persisted to SQLite via `storage_save_query` / `storage_load_queries`; inline save UI lives in the editor panel

---

### Table Management

- [x] View tables — `prefix_list()` fetches all tables; shown in sidebar tree
- [x] Create table — "+ Table" button in table header opens a column-builder dialog with live SQL preview; executes `CREATE TABLE`
- [x] Alter table — "+ Add Column" button in Structure tab footer opens column dialog with type select + NULL toggle + live SQL preview; trash icon on each column row opens Drop Column confirmation; both execute `ALTER TABLE … ADD/DROP COLUMN`
- [x] Drop table — "Drop table" button in table header opens confirmation dialog with generated `DROP TABLE` SQL
- [x] Rename table — pencil icon in table header opens dialog pre-filled with current name; live SQL preview; Enter or Rename button executes `ALTER TABLE … RENAME TO …`
- [x] Manage indexes — trash icon on each index row drops it (MySQL: `DROP INDEX … ON table`, others: `DROP INDEX …`); "+ Add Index" button in Structure footer opens dialog with column checkboxes, UNIQUE toggle, and live SQL preview; executes `CREATE [UNIQUE] INDEX … ON … (cols)`
- [ ] Visual schema editor — Structure tab is read-only; no editing UI

---

### Data Viewer

- [x] Spreadsheet view — TanStack React Table v8 with sortable columns and row numbers
- [x] Inline editing — double-click cell OR press Enter when cell is selected; generates UPDATE with primary key WHERE clause; Escape cancels
- [x] Edit in modal — Shift+Enter or right-click → "Edit in modal"; CodeMirror editor with format dropdown (Text/JSON/HTML), gear menu (Minify text, Wrap Text), Copy and Apply buttons
- [x] Form view — single-row vertical key→value editor with prev/next navigation, inline double-click editing, and per-row delete
- [x] Pagination — configurable rows per page (25/50/100/200) with navigation controls in table footer
- [x] Column resizing — drag column header borders to resize; widths stored in local state
- [x] Column visibility — right-click column header → Hide; Reset layout restores all hidden columns
- [x] Row selection — click row number cell → full row amber highlight; click again to deselect
- [x] Cell selection — single-click any data cell → amber ring on selected cell; tracks rowIdx + colId
- [x] Column selection — click column header → full column amber highlight; click again to deselect
- [x] Row/cell right-click context menu — Edit in modal, Set as NULL, Quick Filter (hover submenu with 5 operators), Copy, Copy Column Name, Copy as TSV, Copy as JSON, Copy as Markdown, Copy as SQL, Copy for IN statement, Paste, Clone row, Delete row, See details
- [x] Column header right-click context menu — Set column to NULL, Copy column values (plain/TSV/JSON/Markdown/SQL/IN), Sort asc/desc, Resize to fit content, Resize all columns to match, Hide column, Reset layout, Open filter for column
- [x] Quick filter from cell — right-click → Quick Filter submenu; applies = / ≠ / Contains / IS NULL / IS NOT NULL filter for that cell's value instantly
- [x] Clone row — right-click → Clone row; generates INSERT with same values; refreshes page
- [x] Insert rows — via CSV/JSON import panel (batched INSERT statements, 200 rows/batch)
- [x] Update rows — inline cell editing with auto-generated UPDATE
- [x] Delete rows — right-click → Delete row opens confirmation dialog with generated DELETE SQL; executes on confirm

---

### Data Filtering and Search

- [x] Advanced filters — visual WHERE builder with column/operator/value inputs
- [x] Multi condition filtering — per-row AND/OR toggle between filter rows; click badge to switch; WHERE clause respects each row's join type
- [x] Quick search — table filter in sidebar (by name); full-text cell search in data grid via Search icon button or ⌘F; filters all visible rows client-side across all columns instantly; shows "N of M" match count; Escape closes
- [x] Column type icons in sidebar — data type icons displayed next to column names in sidebar tree

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
- [x] Export SQL dump — "Export as SQL" in dropdown generates `INSERT INTO … VALUES (…);` statements for all rows in current view

---

## Advanced Features

### Query Execution

- [~] Run multiple queries — can write multiple statements in editor; executed as single batch, not individually
- [x] Async execution — all Tauri commands are `async fn`; UI non-blocking
- [ ] Streaming results — results loaded in full; no streaming for large datasets
- [x] Result tabs — multiple result tabs open at once per SQL editor session

---

### Safety and Review

- [x] Preview SQL before execution — SQL editor includes a Preview dialog with current SQL plus Explain and Run actions; destructive SQL still flows through the existing confirmation step
- [x] Safe mode — confirmation dialog intercepts DELETE / DROP / TRUNCATE before execution; "Run anyway" proceeds
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
- [x] Query plan viewer — "Explain" button in SQL editor toolbar; prepends `EXPLAIN` and renders result in the standard results grid
- [ ] Index suggestions — no automatic index recommendations

---

### Productivity

- [x] TitleBar back navigation — back button for nested view navigation with drag region support
- [x] Keyboard shortcuts — ⌘K (command palette), ⌘↵ (execute SQL), ⌘T (new tab), ⌘W (close tab), ⌘1…⌘9 (switch tabs), Esc (cancel edit), Enter (inline edit selected cell), Shift+Enter (edit selected cell in modal), ⌘F (open search bar)
- [x] Switch tabs — `Cmd/Ctrl+1..9` jumps instantly to the first nine open result tabs in left-to-right tab order
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
- [x] Settings dialog — multi-section settings (Appearance, Editor, Table, Storage, About) with persistent preferences; accessible via TitleBar gear icon and Command Palette
- [x] UI zoom levels — 5 zoom options (100%, 110%, 125%, 140%, 150%) via Settings › Appearance
- [x] Onboarding experience — first-run welcome flow with DB type selection, feature showcase cards, and setup guidance; skippable

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

- [x] Query logs — per-connection history with timestamps, row counts, and duration; persisted to SQLite via `storage_save_history_entry`
- [~] Error logs — errors shown as toast notifications; not persisted or filterable
- [ ] Debug mode — no verbose logging toggle or debug panel

---

## Collaboration Features

- [x] Share connections — Import/Export dialog supports JSON, URI / `.env`, and DBeaver formats; JSON exports can include passphrase-protected passwords
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

- [x] ER diagram generator — read-only ER mode added to table viewer for PostgreSQL, MySQL, and SQLite with pan/zoom, auto-layout, and node click-through navigation
- [x] Schema visualization — connection-wide schema graph renders tables and foreign-key relationships for relational databases
- [ ] Drag and edit relations — not implemented

---

### Multi Database Insights

- [ ] Compare databases — no schema comparison tool
- [ ] Sync schema — not implemented
- [ ] Diff viewer — no diff UI for schemas or data

---

### Offline Features

- [x] Local query history — persisted to SQLite via `storage_save_history_entry`; survives app restarts
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
- [x] Remote database management — standard host/port and URI-based remote connections work, and SSH tunneling covers bastion-style access

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

_Last audited: 2026-04-06. Counts reflect actual codebase state, not just todo entries._

| Category | Done | Partial | Todo |
|---|---|---|---|
| Connections | 9 | 0 | 1 |
| Storage | 6 | 0 | 0 |
| Security | 5 | 0 | 0 |
| Query Editor | 6 | 0 | 0 |
| Table Management | 6 | 0 | 1 |
| Data Viewer | 17 | 0 | 0 |
| Filtering | 4 | 0 | 0 |
| Workspace | 3 | 0 | 0 |
| Import/Export | 5 | 0 | 0 |
| Query Execution | 2 | 1 | 1 |
| Safety | 2 | 0 | 2 |
| DB Management | 0 | 0 | 3 |
| Performance | 2 | 0 | 1 |
| Productivity | 5 | 0 | 0 |
| UI/UX | 10 | 0 | 0 |
| Code Generation | 0 | 0 | 2 |
| Versioning | 0 | 0 | 2 |
| Logs | 1 | 1 | 1 |
| Collaboration | 1 | 0 | 2 |
| AI Features | 0 | 0 | 3 |
| Visual Tools | 2 | 0 | 1 |
| Multi DB Insights | 0 | 0 | 3 |
| Offline | 1 | 1 | 1 |
| Plugin System | 0 | 0 | 3 |
| DevOps | 0 | 0 | 2 |
| Cloud | 3 | 0 | 1 |
| **Total** | **90** | **3** | **30** |

**~73% of planned features implemented.** DDL surface is complete. Data Viewer is now a full-featured spreadsheet: row/cell/column selection with amber highlights, rich right-click context menus (copy as TSV/JSON/Markdown/SQL, quick filter, clone row, set NULL), Edit in Modal with CodeMirror + format switching (Text/JSON/HTML), keyboard-driven editing (Enter / Shift+Enter), and column visibility. Key remaining work: streaming results, visual schema editing, change tracking / undo, and schema comparison workflows.

---

## Next Steps (Prioritized)

### Completed ✓
- [x] **Delete row UI** — trash icon per row with confirm dialog and generated DELETE SQL
- [x] **Safe mode** — intercepts DELETE / DROP / TRUNCATE; shows SQL + "Run anyway" / "Cancel"
- [x] **Query plan viewer** — "Explain" button prepends `EXPLAIN`; renders in results grid
- [x] **OS keychain** — `keyring` v3 crate; migrates legacy file on first launch
- [x] **Full DDL surface** — Create/Alter/Drop/Rename table + Create/Drop index with live SQL preview
- [x] **SSH tunneling** — SSH port-forward is implemented in `src-tauri/src/ssh.rs` and wired into connection setup / teardown in `src-tauri/src/commands.rs`

### Tier 1 — High Value, Low Effort (Frontend only)
- [x] **Full-text cell search** — Search icon button + ⌘F shortcut; thin bar above filter bar; filters `effectiveResult.rows` client-side across all columns; "N of M" count badge; Escape closes; resets on new query
- [x] **Column resizing** — drag column header borders to resize; TanStack Table `columnResizing` plugin; widths stored in local state
- [x] **Row / cell / column selection** — click row number for full-row amber highlight; single-click cell for amber ring; click column header for full-column amber tint; all three are mutually tracked in state
- [x] **Context menus** — right-click row number, data cell, or column header opens a portal-rendered menu with copy variants (TSV/JSON/Markdown/SQL/IN), Quick Filter submenu, clone row, set NULL, edit in modal, delete row, hide column, sort, resize
- [x] **Edit in modal** — CodeMirror editor dialog; "Editing as" dropdown (Text/JSON/HTML) for syntax highlighting; gear menu with Minify and Wrap Text; auto-detects JSON/HTML on open; Apply runs UPDATE; Copy copies without saving
- [x] **Keyboard editing shortcuts** — Enter opens inline edit on selected cell; Shift+Enter opens edit-in-modal; both fire only when a cell is selected and no input is focused

### Tier 2 — High Value, Medium Effort
- [x] **SSL/TLS wiring** — `ssl` is persisted in storage and applied in the PostgreSQL / MySQL drivers via `PgSslMode` / `MySqlSslMode`
- [x] **Group connections (dev/staging/prod)** — add optional `group` tag field to `ConnectionConfig`; sidebar renders connections grouped under collapsible headers
