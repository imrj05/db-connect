# DB Connect

A fast, native desktop database client built with **Tauri 2 · React 19 · TypeScript · Rust** — no Electron, no browser overhead.

Supports PostgreSQL, MySQL, SQLite, MongoDB, and Redis from a single window. Every connection auto-generates a typed function registry (`prefix_list()`, `prefix_query()`, `prefix_tableName()`, …) inspired by the [dbcooper](https://github.com/pipeline-tools/dbcooper) R package, so you navigate databases the same way you'd use code.

---

## Features

### Connections
- Connect to **PostgreSQL, MySQL, SQLite, MongoDB, and Redis** simultaneously
- SSH tunneling through a bastion host (password or private-key auth)
- SSL/TLS on PostgreSQL and MySQL connections
- **Test Connection** before saving
- **Quick-connect presets** (Local PG, Local MySQL, SQLite, MongoDB, Redis)
- **Group connections** by environment (dev, staging, prod) with collapsible sidebar headers
- Credentials encrypted at rest with AES-256-GCM; key stored in the OS keychain (macOS Keychain / Windows Credential Manager / Linux Secret Service)
- Import / export connections in JSON, URI / `.env`, or DBeaver format (with optional passphrase protection)
- **Connection health panel** — per-connection latency badge (green / amber / red), live uptime counter, ping and ping-all actions; accessible from the status bar

### SQL Editor
- CodeMirror 6 with SQL syntax highlighting and multiple editor themes (One Dark, Monokai, GitHub Light, and more)
- **Schema-aware autocomplete** — table and column names from the active connection
- `⌘↵` to run · `⌘T` new tab · `⌘W` close tab · `⌘1–9` switch tabs
- **Query plan viewer** — Explain button prepends `EXPLAIN` and renders a visual plan; highlights Seq Scans (amber), Index Scans (green), and warnings; supports PostgreSQL text plans, MySQL EXPLAIN rows, and SQLite EXPLAIN QUERY PLAN
- **Safe mode** — intercepts `DELETE` / `DROP` / `TRUNCATE` with a preview dialog before execution
- **SQL preview dialog** — review the full query with Explain and Run actions before committing
- Multiple result tabs open simultaneously per session
- **SQL snippets library** — built-in snippets (SELECT, JOINs, CTEs, window functions, aggregations, DDL) plus user-saved snippets with search and categories
- **Query log** — live append-only log of every executed statement with timestamps; syntax highlighting toggle; auto-scrolls to the latest entry

### Data Viewer
- TanStack React Table v8 — sortable columns, row numbers, null highlighting
- **Pagination** — 25 / 50 / 100 / 200 rows per page
- **Inline cell editing** — double-click or press Enter; generates `UPDATE` with primary-key `WHERE` clause
- **Edit in modal** — Shift+Enter or right-click → Edit in modal; CodeMirror editor with Text / JSON / HTML formatting, Minify, Wrap Text, Copy, and Apply
- **Form view** — single-row vertical key→value editor with prev/next navigation and per-row delete
- **Row detail panel** — collapsible side panel showing all column values for the selected row with PK badges, type info, copy-field, and copy-row actions; prev/next row navigation
- **Column resizing** — drag column header borders; widths stored in local state
- **Column visibility** — right-click header → Hide; searchable column list; Reset layout restores all hidden columns
- **Row / cell / column selection** with amber highlight
- **Right-click context menu on cells** — Edit in modal, Set as NULL, Quick Filter, Copy, Copy Column Name, Copy as TSV / JSON / Markdown / SQL / IN, Paste, Clone row, Delete row, See details
- **Right-click context menu on column headers** — Set column to NULL, Copy column values, Sort, Resize to fit, Hide, Reset layout, Open filter
- **Clone row** — generates INSERT with same values and refreshes
- **Delete row** — confirmation dialog with generated DELETE SQL
- **Cell color rules** — conditional row/cell highlighting (=, ≠, >, <, ≥, ≤, contains, IS NULL, IS NOT NULL) across five colors (red, yellow, green, blue, purple); rule targets a specific column or all columns
- **Column statistics panel** — per-column breakdown: total rows, null count, fill percentage, distinct count, min / max / avg / sum (numeric), and top-value frequency bar chart

### Table & Schema Management
- **Create table** — column builder dialog with live SQL preview
- **Alter table** — add / drop columns with type select + NULL toggle + live SQL preview
- **Drop / Rename table** — confirmation dialogs with generated SQL
- **Manage indexes** — create (with UNIQUE toggle + column checkboxes) and drop, with live SQL preview
- **ER diagram** — read-only entity-relationship diagram for PostgreSQL, MySQL, and SQLite with pan / zoom, auto-layout, and click-through navigation
- **Schema graph** — connection-wide schema visualisation of tables and foreign-key relationships
- **Table info panel** — detailed metadata sidebar for the active table: columns with type badges, nullable and default annotations, primary-key and foreign-key indicators, outgoing and incoming FK relationships, and total row count
- **Schema diff** — side-by-side diff between any two connected databases; shows added / removed / changed tables and columns with a copyable migration SQL summary

### Filtering & Search
- **Visual WHERE builder** — column / operator / value rows with per-row AND / OR toggle
- **Multi-condition filters** — click the join badge to switch AND ↔ OR
- **Full-text cell search** — `⌘F` or the search icon; filters all visible rows client-side with an N-of-M match count; Escape closes

### Query History & Saved Queries
- Per-connection query history (up to 100 entries) with timestamps, row counts, duration, and success / error status badges
- Searchable and filterable by connection and status; rerun, copy SQL, save to saved queries, or delete individual entries
- Persisted to SQLite on the Tauri side; survives app restarts
- **Saved queries** — name, persist, and load frequently used SQL snippets per connection
- **Saved query folders** — organise saved queries into named folders (e.g. Reports, Debugging, Migrations); create, rename, and move queries between folders from a context menu

### Import & Export
- Import CSV or JSON into a table (batched INSERT, 200 rows/batch) with drag-and-drop file support and a live column/row preview before import
- Export grid data as CSV, JSON, or SQL (`INSERT INTO … VALUES (…);` for all rows in the current view)
- **SQL dump import** — import a full `.sql` dump file with auto-detection of PostgreSQL / MySQL / SQLite format and configurable options (drop-if-exists, transaction wrapping)
- **Database dump** — export an entire database as a `.sql` dump with options for data, indexes, foreign keys, and CREATE DATABASE statement

### Command Palette (`⌘K`)
- Prefix-anchored fuzzy search across all connected databases
- Grouped by connection name with DB-type badge
- **Pinned tables** surfaced at the top of results with a pin indicator
- Opens SQL editor, table browser, or connection info directly

### Sidebar
- **Pinned tables** — hover any table and click the pin icon to pin it; pinned tables appear in a dedicated "Pinned" section at the top of the sidebar for the active connection, persisted across restarts
- Expandable table rows with lazy-loaded column list (name and type)

### Status Bar
- Shows active connection status, current database, last query execution time, and row count for every result view

### AI Assistant
- Configurable AI provider: OpenRouter (OAuth or API key), OpenAI, or Anthropic
- Selectable default model; credentials stored via the OS keychain

### UI & Settings
- macOS-native title bar with traffic-light controls and draggable region
- Dark and light mode with a full CSS token system; toggle via Command Palette
- **Split view** — resizable sidebar / main and editor / results panels
- **Settings page** — tabbed interface with sections for Appearance (UI theme, editor theme, zoom 100–150%, font family), Editor, Table, Storage (clear history / saved queries / snippets), AI (provider, model, credentials), and License
- **Onboarding flow** — first-run welcome with DB-type picker, feature cards, and setup guidance
- **Auto-updater** — background update checks with an install dialog

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Tauri 2 (Rust) |
| Frontend | React 19 + TypeScript + Vite 7 |
| Styling | Tailwind CSS 4 + shadcn/ui + Radix UI |
| State | Zustand 5 |
| SQL editor | CodeMirror 6 |
| Data grid | TanStack React Table v8 |
| DB drivers | SQLx (PostgreSQL · MySQL · SQLite) · mongodb · redis |
| Storage | SQLite via SQLx (Tauri side) with AES-256-GCM encryption |
| SSH tunneling | russh |
| Charts / ER | recharts + custom SVG layout |

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `⌘K` | Open Command Palette |
| `⌘↵` | Execute SQL |
| `⌘T` | New result tab |
| `⌘W` | Close current tab |
| `⌘1` – `⌘9` | Switch to tab 1–9 |
| `⌘F` | Open full-text cell search |
| `Enter` | Inline edit selected cell |
| `Shift+Enter` | Edit selected cell in modal |
| `Escape` | Cancel edit / close search |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 22+
- [Rust](https://rustup.rs/) (stable)
- Platform prerequisites from [tauri.app/start/prerequisites](https://tauri.app/start/prerequisites/)

**Linux only** — the following system packages are required:

```bash
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev libappindicator3-dev \
  librsvg2-dev patchelf libssl-dev pkg-config
```

### Run in development

```bash
npm install
npm run tauri dev
```

### Build for production

```bash
npm run tauri build
```

---

## Project Structure

```
src/                              # React frontend
  components/
    layout/
      app-sidebar-panel.tsx       # Connection tree, pinned tables, table list
      command-palette.tsx         # ⌘K search with pinned table support
      connection-dialog-modal.tsx # Add / edit connection dialog
      connection-health-panel.tsx # Per-connection latency + uptime panel
      import-export-dialog.tsx    # Connection import / export (JSON, URI, DBeaver)
      title-bar.tsx               # macOS-native title bar
      update-dialog.tsx           # Auto-updater UI
      app-onboarding-screen.tsx   # First-run welcome flow
      function-output/
        settings-page.tsx         # Tabbed settings (Appearance, Editor, AI, License…)
        status-bar.tsx            # Connection status, current DB, timing, row count
        tab-bar.tsx               # Multi-tab bar with context menu
        query-log.tsx             # Append-only SQL execution log
        schema-diff-view.tsx      # Side-by-side schema diff between two connections
        sql-editor/
          query-history-panel.tsx # Searchable, filterable query history
          saved-queries-panel.tsx # Saved queries with folder organisation
          snippets-panel.tsx      # Built-in + user SQL snippets library
          explain-plan-view.tsx   # Visual EXPLAIN plan renderer
          results-grid.tsx        # Query result grid
          sql-editor-toolbar.tsx  # Editor toolbar (run, explain, format…)
        table-grid/
          grid-toolbar.tsx        # Table toolbar (filter, search, import, export…)
          filter-bar.tsx          # Visual WHERE builder
          table-info-panel.tsx    # Column/PK/FK/index metadata panel
          color-rules-panel.tsx   # Conditional cell colour rules
          column-stats-panel.tsx  # Per-column statistics
          row-detail-panel.tsx    # Selected-row detail side panel
          cell-edit-modal.tsx     # Full-screen cell editor
          import-panel.tsx        # CSV / JSON import with preview
          import-sql-dialog.tsx   # SQL dump import dialog
          dump-database-dialog.tsx# Database dump export dialog
          er-diagram-view.tsx     # ER diagram
          create-index-dialog.tsx # Index management
          add-column-dialog.tsx   # Alter table – add column
          drop-column-dialog.tsx  # Alter table – drop column
          rename-table-dialog.tsx # Rename table dialog
          drop-table-dialog.tsx   # Drop table dialog
          row-context-menu.tsx    # Row right-click menu
          column-context-menu.tsx # Column header right-click menu
  hooks/                          # Custom React hooks
  lib/
    db-functions.ts               # dbcooper function registry builder
    tauri-api.ts                  # Typed Tauri command wrappers
    encryption.ts                 # localStorage encryption utils
  store/
    useAppStore.ts                # Zustand store (connections, functions, UI state)
  types/                          # Shared TypeScript types

src-tauri/src/                    # Rust backend
  commands.rs                     # Tauri command handlers
  types.rs                        # Shared Rust types (serde-serialisable)
  storage.rs                      # SQLite storage + AES-256-GCM encryption
  ssh.rs                          # SSH tunnel setup and teardown
  import_export.rs                # CSV / JSON import helpers
  sql_import.rs                   # SQL dump import
  license.rs                      # License validation
  db/
    mod.rs                        # DatabaseDriver trait
    registry.rs                   # Global DashMap connection registry
    postgres.rs                   # PostgreSQL driver (SQLx)
    mysql.rs                      # MySQL / MariaDB driver (SQLx)
    sqlite.rs                     # SQLite driver (SQLx)
    mongodb.rs                    # MongoDB driver
    redis_driver.rs               # Redis driver
```

---

## Roadmap

| Feature | Status |
|---|---|
| ER diagram | Done |
| SSH tunneling | Done |
| OS keychain credential storage | Done |
| Full DDL surface (create/alter/drop/rename) | Done |
| Safe mode for destructive queries | Done |
| Query plan viewer | Done |
| Full-text cell search | Done |
| Rich right-click context menus | Done |
| Edit in modal with format switching | Done |
| Auto-updater | Done |
| Connection health panel | Done |
| Pinned / favourite tables | Done |
| Enhanced query history (search, filters, status badges) | Done |
| Saved query folders | Done |
| Schema diff between two connections | Done |
| Table info panel (columns, PKs, FKs, indexes) | Done |
| SQL snippets library (built-in + user-saved) | Done |
| Cell color rules (conditional highlighting) | Done |
| Column statistics panel | Done |
| Row detail side panel | Done |
| SQL dump import & database dump export | Done |
| Import preview with column/row validation | Done |
| Status bar (connection, database, timing, rows) | Done |
| AI assistant (OpenRouter / OpenAI / Anthropic) | Done |
| Streaming results for large datasets | Planned |
| Visual schema editing (drag relations) | Planned |
| Change tracking / undo for cell edits | Planned |
| MongoDB schema inference | Planned |
| Redis key-namespace browser | Planned |
| SQL Server support | Planned |

---

## Security Notes

- Connection passwords are **never stored in plaintext**. Credentials are encrypted with AES-256-GCM using a per-machine key stored in the OS keychain.
- The encryption key never leaves the Rust process; it is decrypted only when a connection is used.
- SSH private keys and passphrases follow the same encryption path.

---

## IDE Setup

[VS Code](https://code.visualstudio.com/) with the [Tauri extension](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) and [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer).
