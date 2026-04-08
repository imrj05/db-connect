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

### SQL Editor
- CodeMirror 6 with SQL syntax highlighting and One Dark theme
- **Schema-aware autocomplete** — table and column names from the active connection
- `⌘↵` to run · `⌘T` new tab · `⌘W` close tab · `⌘1–9` switch tabs
- **Query plan viewer** — Explain button prepends `EXPLAIN` and renders in the results grid
- **Safe mode** — intercepts `DELETE` / `DROP` / `TRUNCATE` with a preview dialog before execution
- **SQL preview dialog** — review the full query with Explain and Run actions before committing
- Multiple result tabs open simultaneously per session

### Data Viewer
- TanStack React Table v8 — sortable columns, row numbers, null highlighting
- **Pagination** — 25 / 50 / 100 / 200 rows per page
- **Inline cell editing** — double-click or press Enter; generates `UPDATE` with primary-key `WHERE` clause
- **Edit in modal** — Shift+Enter or right-click → Edit in modal; CodeMirror editor with Text / JSON / HTML formatting, Minify, Wrap Text, Copy, and Apply
- **Form view** — single-row vertical key→value editor with prev/next navigation and per-row delete
- **Column resizing** — drag column header borders; widths stored in local state
- **Column visibility** — right-click header → Hide; Reset layout restores all hidden columns
- **Row / cell / column selection** with amber highlight
- **Right-click context menu on cells** — Edit in modal, Set as NULL, Quick Filter, Copy, Copy Column Name, Copy as TSV / JSON / Markdown / SQL / IN, Paste, Clone row, Delete row, See details
- **Right-click context menu on column headers** — Set column to NULL, Copy column values, Sort, Resize to fit, Hide, Reset layout, Open filter
- **Clone row** — generates INSERT with same values and refreshes
- **Delete row** — confirmation dialog with generated DELETE SQL

### Table & Schema Management
- **Create table** — column builder dialog with live SQL preview
- **Alter table** — add / drop columns with type select + NULL toggle + live SQL preview
- **Drop / Rename table** — confirmation dialogs with generated SQL
- **Manage indexes** — create (with UNIQUE toggle + column checkboxes) and drop, with live SQL preview
- **ER diagram** — read-only entity-relationship diagram for PostgreSQL, MySQL, and SQLite with pan / zoom, auto-layout, and click-through navigation
- **Schema graph** — connection-wide schema visualisation of tables and foreign-key relationships

### Filtering & Search
- **Visual WHERE builder** — column / operator / value rows with per-row AND / OR toggle
- **Multi-condition filters** — click the join badge to switch AND ↔ OR
- **Full-text cell search** — `⌘F` or the search icon; filters all visible rows client-side with an N-of-M match count; Escape closes

### Query History & Saved Queries
- Per-connection query history (up to 100 entries) with timestamps, row counts, and duration
- Persisted to SQLite on the Tauri side; survives app restarts
- **Saved queries** — name and persist frequently used SQL snippets per connection

### Import & Export
- Import CSV or JSON into a table (batched INSERT, 200 rows/batch)
- Export grid data as CSV, JSON, or SQL (`INSERT INTO … VALUES (…);` for all rows in the current view)

### Command Palette (`⌘K`)
- Prefix-anchored fuzzy search across all connected databases
- Grouped by connection name with DB-type badge
- Opens SQL editor, table browser, or connection info directly

### UI & Settings
- macOS-native title bar with traffic-light controls and draggable region
- Dark and light mode with a full CSS token system; toggle via Command Palette
- **Split view** — resizable sidebar / main and editor / results panels
- **Settings dialog** — Appearance (theme, zoom 100–150%), Editor, Table, Storage, and About sections
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
      Sidebar.tsx                 # Connection tree + function list
      FunctionOutput.tsx          # Result panel (data grid, SQL editor, structure)
      CommandPalette.tsx          # ⌘K search
      TitleBar.tsx                # Active function display + back navigation
      ConnectionDialog.tsx        # Add / edit connection dialog
      ImportExportDialog.tsx      # CSV / JSON / SQL import and export
      UpdateDialog.tsx            # Auto-updater UI
      SettingsDialog.tsx          # App-wide settings
      Onboarding.tsx              # First-run welcome flow
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
| Streaming results for large datasets | Planned |
| Visual schema editing (drag relations) | Planned |
| Change tracking / undo for cell edits | Planned |
| Schema diff between two connections | Planned |
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
