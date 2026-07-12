# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

DB Connect is a Tauri 2 desktop database client (PostgreSQL, MySQL, SQLite, MongoDB, Redis) — Rust backend, React 19 + TypeScript (strict) + Vite 7 + Tailwind CSS v4 + shadcn/ui + Zustand frontend.

## Commands

- `npm run tauri dev` — run the full desktop app in dev (starts Vite on port 1420 internally)
- `npm run dev` — frontend only in the browser (Tauri APIs unavailable)
- `npm run build` — `tsc && vite build`; **tsc is the lint gate** (no ESLint/Prettier in this repo)
- `npm test` — `vitest run`; `npm run test:watch` for watch mode
- Single test file: `npx vitest run tests/<file>.test.ts`; by name: `npx vitest run -t "test name"`
- Rust: `cargo check` / `cargo test` from `src-tauri/`
- `npm run tauri build` — production desktop bundle

## Architecture

### Frontend ↔ backend bridge

All IPC goes through the typed `tauriApi` object in `src/lib/tauri-api.ts` — never call Tauri `invoke` directly from components. camelCase JS args are mapped to Rust snake_case params automatically by Tauri.

### Rust backend (`src-tauri/src/`)

- `lib.rs` — app entry; registers every Tauri command in one `generate_handler!` block (the authoritative command list) and initializes storage/license/Sentry on setup.
- `commands.rs` — all `#[tauri::command]` handlers. `connect_database` orchestrates: validate config → optional SSH tunnel (`ssh.rs`, russh, reroutes the driver through a local port) → instantiate driver by `db_type` → ping health check → insert into the global registry.
- `db/mod.rs` — the `DatabaseDriver` async trait (connect, get_tables, run_query, get_table_data, …) plus SQL-identifier injection guards. Implemented per engine in `db/postgres.rs`, `db/mysql.rs`, `db/sqlite.rs` (SQLx) and `db/mongodb.rs`, `db/redis_driver.rs` (native drivers).
- `db/registry.rs` — global DashMap registry: live connections, configs, SSH tunnels, and running-query `AbortHandle`s (query cancellation).
- `storage.rs` — local SQLite persistence (connections, saved queries, history, snippets, workspace snapshot). Secrets are AES-256-GCM encrypted; the key lives in the OS keychain (`keyring`).

### Frontend

- Feature-based layout under `src/`: `app/` (shell — App.tsx, title-bar, error-boundary), `features/<domain>/` (each with local `components/`, `hooks/`, `lib/` — e.g. `table-grid`, `explorer`, `connections`, `settings`, `sql-editor`, `er-diagram`), `components/ui/` (shadcn primitives) + `components/shared/`, `stores/`, `lib/` (cross-cutting only), `types/`. Single path alias `@/*` → `./src/*`; no barrel files (import concrete paths); dependency direction is `features → components/shared → components/ui → lib/stores/types`, cross-feature communication goes through the store.
- Zustand store composed from slices in `src/stores/`: `useAppStore.ts` intersects the connection/workspace/query/table/ui/settings slices (`slices/*.ts`) into one `AppState`; shared types in `stores/types.ts`, localStorage/workspace persistence in `stores/lib/`. Slices import `type AppState` back from `useAppStore.ts` (type-only, erased at build — madge reports these as cycles but they are not runtime cycles). The store holds connections, live connection state, result tabs, query history/saved queries/snippets, settings, and UI state. There is no router: `App.tsx` (in `src/app/`) switches on the store's `activeView` (`"main" | "settings" | "new-connection" | "schema-diff"`).
- Query flow: component → store `invokeFunction(fn, args)` → `tauriApi.*` → Rust → result lands in the active tab and query history. Connection safety mode (`read-only`/`warn`) is enforced client-side in `invokeFunction` via write-statement detection.
- `src/lib/db-functions.ts` builds per-connection typed function registries (dbcooper-style: `pg_list()`, `pg_query()`, one function per table).
- Env safety ("ambient safety"): `src/lib/env-safety.ts` + the runtime-set `--env-color` CSS variable color the UI red/amber/green for prod/staging/local connections.

### Styling

Tailwind v4 — there is **no tailwind.config**; all design tokens live in `src/App.css` via `@theme` blocks. The token set is the standard shadcn set plus env-safety (`--env-prod/--env-staging/--env-local/--env-color`) and `--success`/`--warning` (+foregrounds) only. Dark mode = `.dark` class on `<html>`, toggled by the store and persisted to localStorage (not next-themes). User-selectable fonts are applied at runtime by `App.tsx` via `setProperty` on the font variables.

## Gotchas

- The app version lives only in `package.json`; the pre-commit hook (`.githooks/`) syncs it into `tauri.conf.json` and `Cargo.toml` — never hand-edit versions there.
- `tsc` runs with `noUnusedLocals`/`noUnusedParameters` — unused variables fail the build.
- `components.json` uses the custom `radix-vega` style. Never run `shadcn add` over existing files in `src/components/ui/`; if generating a new primitive, manually align it to this repo's token set.
- Design source of truth: `DESIGN.md` + `design-system.md`. Product principles in `PRODUCT.md` (keyboard-first, data density, ambient env safety) must not be regressed by UI changes.
- Path alias: `@/*` → `./src/*` (the only alias).
