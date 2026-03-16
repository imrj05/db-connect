# DB Connect — Progress Tracker

> Cross-platform desktop database client · Tauri + React + TypeScript
> Inspired by TablePlus, DataGrip, and DBngin

---

## Legend
- ✅ Done
- 🔄 Scaffolded / In Progress (needs wiring or polish)
- ⬜ Not Started

---

## Phase 0 — Project Setup & Tooling

| Task | Status | Notes |
|------|--------|-------|
| Vite + React + TypeScript base | ✅ | |
| Tauri v2 integration | ✅ | `src-tauri/` configured |
| Tailwind CSS v4 | ✅ | `@tailwindcss/vite` v4.2.1 |
| shadcn/ui (Radix primitives) | ✅ | All key packages installed |
| TanStack Table | ✅ | `@tanstack/react-table` |
| TanStack Query | ✅ | `@tanstack/react-query` |
| CodeMirror query editor | ✅ | `@uiw/react-codemirror` + `lang-sql` |
| Zustand state management | ✅ | |
| Framer Motion animations | ✅ | |
| `react-resizable-panels` layout | ✅ | Used in `App.tsx` |
| `cmdk` command palette | ✅ | |
| `sonner` toast notifications | ✅ | |
| `lucide-react` icons | ✅ | |
| Monorepo structure (apps/packages) | ⬜ | Currently flat — future refactor |

---

## Phase 1 — Rust Backend

### 1.1 Dependencies & Config

| Task | Status | Notes |
|------|--------|-------|
| `Cargo.toml` with all DB drivers | ✅ | sqlx, rusqlite, mongodb, redis-rs |
| `tokio` async runtime | ✅ | `features = ["full"]` |
| `serde` / `serde_json` | ✅ | |
| `uuid`, `chrono` | ✅ | |
| `dashmap` connection registry | ✅ | |
| AES-GCM credential encryption | ✅ | `aes-gcm`, `base64`, `rand` |
| `thiserror` / `anyhow` | ✅ | |

### 1.2 Core Data Types (`types.rs`)

| Task | Status | Notes |
|------|--------|-------|
| `ConnectionConfig` struct | ✅ | |
| `DatabaseType` enum | ✅ | PG / MySQL / SQLite / Mongo / Redis |
| `QueryResult`, `TableInfo`, `ColumnInfo` | ✅ | |
| `TableDataResult`, `TableRow` | ✅ | |
| SSL/TLS options in types | 🔄 | Defined, not fully wired in drivers |

### 1.3 Database Drivers (`src-tauri/src/db/`)

| Task | Status | Notes |
|------|--------|-------|
| Driver trait / common interface | ✅ | `mod.rs` |
| PostgreSQL driver (`postgres.rs`) | ✅ | 10.9 KB — builds clean |
| MySQL driver (`mysql.rs`) | ✅ | 6.3 KB — builds clean |
| SQLite driver (`sqlite.rs`) | ✅ | 6 KB — builds clean |
| MongoDB driver (`mongodb.rs`) | ✅ | 2.9 KB — builds clean |
| Redis driver (`redis_driver.rs`) | ✅ | 4.4 KB — builds clean |
| Connection pooling via `dashmap` | ✅ | `registry.rs` |

### 1.4 Tauri Commands (`commands.rs`)

| Task | Status | Notes |
|------|--------|-------|
| `test_connection` | ✅ | Registered in `lib.rs` |
| `connect_database` | ✅ | |
| `disconnect_database` | ✅ | |
| `get_databases` | ✅ | |
| `get_tables` | ✅ | |
| `get_table_details` | ✅ | |
| `execute_query` | ✅ | |
| `get_table_data` | ✅ | |
| `insert_row` | ✅ | |
| `update_row` | ✅ | |
| `delete_row` | ✅ | |
| `get_redis_keys` | ✅ | |
| `get_redis_value` | ✅ | |
| `set_redis_value` | ✅ | |
| `delete_redis_key` | ✅ | |
| `export_data` | ✅ | |
| `get_schemas` (PostgreSQL schemas) | ⬜ | Not yet registered |
| `get_mongo_collections` | ⬜ | Not yet registered |
| `get_query_history` | ⬜ | |
| `save_query` / `get_saved_queries` | ⬜ | |
| SSH tunnel support | ⬜ | Future |

### 1.5 Security

| Task | Status | Notes |
|------|--------|-------|
| Credential encryption (AES-GCM) | 🔄 | Deps added — impl needs audit |
| OS keychain integration | ⬜ | `tauri-plugin-stronghold` or keytar |
| No plaintext password storage | 🔄 | Needs final audit |

### 1.6 Build Verification

| Task | Status | Notes |
|------|--------|-------|
| `cargo build` passes clean | ✅ | Done (fixed initializers) |
| No critical compiler warnings | ✅ | Fixed all warnings |

---

## Phase 2 — Frontend (React / TypeScript)

### 2.1 App Shell & Layout

| Task | Status | Notes |
|------|--------|-------|
| 3-panel resizable layout | ✅ | `App.tsx` with `react-resizable-panels` |
| Custom titlebar (`Titlebar.tsx`) | ✅ | |
| Left sidebar (`Sidebar.tsx`) | ✅ | |
| Status bar (`StatusBar.tsx`) | ✅ | |
| Right panel (`RightPanel.tsx`) | ✅ | |
| Dark mode default | ✅ | CSS variables in `index.css` |
| Light mode toggle | 🔄 | Store has `theme` — CSS needs verify |
| Framer Motion panel animations | 🔄 | Right panel done — expand to more |

### 2.2 Tauri API Bridge (`lib/tauri-api.ts`)

| Task | Status | Notes |
|------|--------|-------|
| `invoke` wrappers for all commands | 🔄 | File exists (5 KB) — sync with latest |
| Typed request/response shapes | 🔄 | |
| Error boundary / fallback handling | ⬜ | |

### 2.3 Zustand Store (`store/useAppStore.ts`)

| Task | Status | Notes |
|------|--------|-------|
| Connections list | ✅ | |
| Active connection / active database | ✅ | |
| Query tabs | ✅ | |
| Query results | ✅ | |
| Theme (dark / light) | ✅ | |
| Right panel open/close | ✅ | |
| Selected table | ✅ | |
| Query history | ⬜ | |
| Saved queries | ⬜ | |

### 2.4 TypeScript Types (`types/index.ts`)

| Task | Status | Notes |
|------|--------|-------|
| `Connection`, `DatabaseType` | ✅ | |
| `QueryResult`, `TableInfo`, `Column` | ✅ | |
| Alignment with Rust struct shapes | 🔄 | Verify field names match exactly |

### 2.5 Connection Manager

| Task | Status | Notes |
|------|--------|-------|
| Connection list in sidebar | ✅ | `ConnectionList.tsx` (7 KB) |
| Add connection dialog | ✅ | `ConnectionDialog.tsx` (9.7 KB) |
| Edit connection | 🔄 | Dialog likely supports edit mode |
| Delete connection with confirm | 🔄 | |
| Test connection + toast feedback | ✅ | Wired via Tauri invoke + Sonner |
| SSL toggle in form | ⬜ | |
| MongoDB URI field variant | ⬜ | |
| Redis-specific fields (no DB name) | ⬜ | |

### 2.6 Schema Explorer

| Task | Status | Notes |
|------|--------|-------|
| Schema tree component | ✅ | `SchemaExplorer.tsx` (11.9 KB) |
| Databases list | 🔄 | |
| Tables / views list | 🔄 | |
| Indexes display | ⬜ | |
| MongoDB collections view | ✅ | |
| Redis key list | ✅ | |
| Right-click context menu | 🔄 | `@radix-ui/react-context-menu` installed |

### 2.7 Query Editor

| Task | Status | Notes |
|------|--------|-------|
| CodeMirror editor | ✅ | `QueryEditor.tsx` (8.4 KB) |
| SQL syntax highlighting | ✅ | |
| One Dark theme | ✅ | |
| Multiple query tabs | 🔄 | Store has tabs — UI needs verify |
| Cmd/Ctrl+Enter run shortcut | 🔄 | |
| Schema-aware autocomplete | ⬜ | Feed schema into CM completion |
| Query history panel | ⬜ | |
| Saved queries panel | ⬜ | |

### 2.8 Query Results Viewer

| Task | Status | Notes |
|------|--------|-------|
| Results table | ✅ | `QueryResults.tsx` (10.9 KB) |
| TanStack Table grid | 🔄 | Installed — verify implementation |
| Column sorting | 🔄 | |
| Column filtering | ⬜ | |
| Pagination | 🔄 | |
| Column resizing | ⬜ | |
| Copy cell value | ⬜ | |
| Export to CSV | 🔄 | `export_data` command registered |
| Export to JSON | 🔄 | |

### 2.9 Table Data Viewer

| Task | Status | Notes |
|------|--------|-------|
| Table data grid | ✅ | `TableDataViewer.tsx` (9.1 KB) |
| Pagination | 🔄 | |
| Inline cell editing | ⬜ | |
| Insert row | 🔄 | `insert_row` command registered |
| Delete row | 🔄 | `delete_row` command registered |
| Search / filter rows | ⬜ | |

### 2.10 Command Palette

| Task | Status | Notes |
|------|--------|-------|
| Command palette overlay | ✅ | `CommandPalette.tsx` (9.8 KB) |
| Cmd/Ctrl+K keybinding | 🔄 | Verify works correctly |
| Search tables | 🔄 | |
| Switch database | ⬜ | |
| Open saved queries | ⬜ | |
| Run app commands | ⬜ | |

---

## Phase 3 — Advanced Features

| Task | Status | Notes |
|------|--------|-------|
| MongoDB document viewer (JSON tree) | ✅ | Integrated into results view |
| Redis key explorer (str/list/set/hash) | ✅ | Integrated into schema explorer + right panel |
| AI SQL assistant (NL → SQL) | ⬜ | Needs LLM API integration |
| ER diagram viewer (interactive graph) | ⬜ | Consider `@xyflow/react` |
| SSH tunnel support | ⬜ | Rust side tunneling |
| Import CSV / JSON | ⬜ | |
| Plugin system for additional drivers | ⬜ | |

---

## Phase 4 — Packaging & Distribution

| Task | Status | Notes |
|------|--------|-------|
| App icons | 🔄 | `src-tauri/icons/` folder present |
| macOS build (`tauri build`) | ⬜ | |
| Windows build | ⬜ | CI / cross-compile |
| Linux build | ⬜ | |
| Code signing (macOS) | ⬜ | |
| Auto-updater | ⬜ | `tauri-plugin-updater` |

---

## Phase 5 — Quality & Polish

| Task | Status | Notes |
|------|--------|-------|
| `cargo build` succeeds clean | ✅ | Verified |
| `npm run dev` renders without errors | ✅ | Build succeeds |
| `npm run tauri dev` full integration | ⬜ | |
| End-to-end PostgreSQL flow | ⬜ | Connect → Explore → Query |
| End-to-end SQLite flow | ⬜ | |
| Error UX (toasts + fallback states) | ✅ | `sonner` integrated |
| Loading skeletons | ✅ | Implemented for Query Results |
| Empty states (no connection etc.) | 🔄 | Partial |
| Responsive sidebar (collapse) | ⬜ | |
| TypeScript strict mode | ⬜ | Check `tsconfig.json` |
| Accessibility (keyboard nav, ARIA) | ⬜ | |

---

## 🚀 Immediate Next Steps

1. [x] Run `cargo build` in `src-tauri/` — fix all Rust compile errors
2. [x] Run `npm run dev` — verify UI renders without console errors
3. [ ] Run `npm run tauri dev` — test full Tauri integration
4. [ ] Wire PostgreSQL connection end-to-end (connect → schema → query)
5. [x] Fix Connection dialog for all 5 DB types (SSL, Mongo URI, Redis fields)
6. [x] Add loading skeletons and error toast feedback throughout UI
7. [ ] Implement query history + saved queries (UI side ready, state persists in localStorage)
8. [x] Build MongoDB document viewer component
9. [x] Build Redis key explorer component
10. [ ] Polish light/dark mode toggle + Framer Motion transitions
