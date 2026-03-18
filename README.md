# db-connect

A fast, native desktop database client built with **Tauri 2 + React + TypeScript + Rust**, inspired by the [dbcooper](https://github.com/pipeline-tools/dbcooper) R package. Every connection auto-generates a typed function registry (`prefix_list()`, `prefix_query()`, `prefix_tableName()`, …) so you navigate databases the same way you'd use code.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Tauri 2 (Rust) |
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS 4 + Shadcn/UI + Radix UI |
| State | Zustand (encrypted localStorage persistence) |
| SQL editor | CodeMirror 6 |
| Data grid | TanStack React Table v8 |
| DB drivers (Rust) | SQLx (PostgreSQL, MySQL, SQLite) · mongodb · redis |

---

## Current Features

### Connections
- **Multi-connection sidebar** — all connections visible simultaneously as an expandable tree; no "active connection" switcher
- **Supported databases** — PostgreSQL, MySQL, SQLite, MongoDB, Redis
- **Encrypted persistence** — connection configs (incl. credentials) encrypted in `localStorage`; auto-migrates between storage versions
- **Connection dialog** — two-panel redesign: left engine picker, right form with live prefix preview and URL preview
- **Test connection** button with success/error inline feedback

### dbcooper-style Function Registry
Every connected database generates a set of typed functions identified by a user-defined **prefix**:

| Function | What it does |
|---|---|
| `prefix_list()` | Shows all discovered tables for the connection |
| `prefix_src()` | Shows connection info card (host, port, DB, SSL, table count) |
| `prefix_query(sql)` | Opens a SQL editor bound to this connection |
| `prefix_execute(sql)` | Opens a DDL/DML editor bound to this connection |
| `prefix_tbl(table)` | Prompts to pick a table then browses it |
| `prefix_tableName()` | Directly browses a specific table (one function per table) |

### Sidebar
- Tree per connection: utility functions → Tables section with per-table shortcuts
- **Database selector** — Shadcn combobox dropdown to switch between databases on a live connection; re-fetches tables and rebuilds function list on change
- Bare names shown (e.g. `users`, `query`, `list`) without prefix noise
- Connect / Disconnect / Edit buttons per connection; animated connected indicator

### Command Palette (`⌘K`)
- Prefix-anchored fuzzy search across all connected connections
- Grouped by connection name with DB type badge
- Bare function names without prefix; type icons colour-coded by function type
- Selecting `query` / `execute` opens SQL editor; others invoke immediately

### Result Panel
- **Data tab** — paginated table grid (50 rows/page) with sortable columns, row numbers, null highlighting
- **Structure tab** — lazy-loaded per table:
  - **Columns**: name, type, nullable (YES/NO), default value, key badges (PK / UNI), extra (e.g. `auto_increment`)
  - **Indexes**: name, column chips, type (BTREE / HASH), unique badge
- **SQL editor** — CodeMirror 6 with syntax highlighting, `⌘↵` to run, results rendered below
- **Table list view** — clickable table list for `_list`; click to browse
- **Connection source view** — info card for `_src`
- Empty tables show column headers with "0 rows" body instead of a blank card
- Smooth spinner when switching tables / databases (no idle-screen flicker)
- Theme-aware: all backgrounds, borders, and CodeMirror editor adapt to dark / light mode

### Theme
- Dark and light mode with full token system (`--color-app-bg`, `--color-table-bg`, `--color-toolbar-bg`, etc.)
- Toggle via Command Palette → "Switch to Light / Dark Mode"

### Title Bar
- Active function name shown as `> tableName()` when a function is invoked
- Connected connection count badge

---

## Ongoing

- [x] Export table data to CSV / JSON
- [x] SQL editor autocomplete (table/column names from the active connection)
- [x] Resizable result panel split between editor and results

---

## Upcoming

- [x] **Saved queries** — name and persist frequently used SQL snippets per connection
- [x] **Query history** — per-connection log of recently executed queries with timestamps and row counts
- [x] **Cell editing** — inline edit table cells and write back with generated UPDATE statements
- [x] **Filters & sorting UI** — visual WHERE builder on top of the data grid without writing SQL
- [ ] **ER diagram view** — auto-generated entity-relationship diagram from foreign key metadata
- [ ] **Schema diff** — compare table structure between two connections or two points in time
- [x] **Multiple result tabs** — keep multiple query results open side-by-side
- [ ] **SSH tunnel support** — connect through a bastion host
- [x] **Import** — load CSV / JSON into a table
- [ ] **MongoDB schema inference** — sample documents and infer field types for the Structure tab
- [ ] **Redis key browser** — tree view of key namespaces with value inspector

---

## Development

### Prerequisites
- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) (stable)
- [Tauri CLI prerequisites](https://tauri.app/v2/guides/getting-started/prerequisites) for your platform

### Running locally

```bash
npm install
npm run tauri dev
```

### Building

```bash
npm run tauri build
```

---

## Project Structure

```
src/                          # React frontend
  components/layout/
    Sidebar.tsx               # Connection tree + function list
    FunctionOutput.tsx        # Result panel (data grid, SQL editor, structure)
    CommandPalette.tsx        # ⌘K search
    TitleBar.tsx              # Active function display
    ConnectionDialog.tsx      # Add / edit connection dialog
  lib/
    db-functions.ts           # dbcooper function registry builder
    tauri-api.ts              # Typed Tauri command wrappers
    encryption.ts             # localStorage encryption utils
  store/
    useAppStore.ts            # Zustand store (connections, functions, UI state)
  types.ts                    # Shared TypeScript types

src-tauri/src/                # Rust backend
  commands.rs                 # Tauri command handlers
  types.rs                    # Shared Rust types (serde serialisable)
  db/
    mod.rs                    # DatabaseDriver trait
    registry.rs               # Global DashMap connection registry
    postgres.rs               # PostgreSQL driver (SQLx)
    mysql.rs                  # MySQL / MariaDB driver (SQLx)
    sqlite.rs                 # SQLite driver (SQLx)
    mongodb.rs                # MongoDB driver
    redis_driver.rs           # Redis driver
```

---

## IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
