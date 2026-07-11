# DB Connect Improvement Plan

_Last updated: 2026-06-07_

This plan is based on a static review of the app, README, current roadmap, UI files, and basic checks.

## Current Health Check

- `npm run build` passes.
- `npm test` passes: 2 test files / 3 tests.
- Build warning: main JS chunk is large: ~2.53 MB / ~775 KB gzip.
- CSS bundle is large: ~399 KB.
- Several files are too large and should be split over time:
  - `src/components/layout/function-output/table-grid-view.tsx` — ~3600+ lines
  - `src/store/useAppStore.ts` — ~1500+ lines
  - `src/components/layout/app-sidebar-panel.tsx` — ~1800+ lines

## Product Direction

DB Connect should lean into this positioning:

> A safe, fast, native database client for developers who work across local, staging, and production databases.

The app already has many features. The next improvements should focus on:

- Safety
- Performance
- Better hierarchy
- Better discoverability
- Clearer table/data workflows
- More confidence when editing production data

---

# Priority Roadmap

## P0 — Critical Safety and Reliability

### 1. Add query limits and cancellation

Add safeguards for expensive or accidental queries.

Tasks:

- Add max query text size.
- Add max returned rows.
- Add configurable query timeout per connection.
- Add a visible **Cancel query** button while queries are running.
- Warn before loading very large result sets.
- Show partial/limited result state clearly: “Showing first 10,000 rows”.

Why:

- Prevents app freezes.
- Protects production databases.
- Makes the app feel more professional and safe.

---

### 2. Strengthen production safety mode

Production connections should be visually and functionally safer than local/dev connections.

Tasks:

- Block or strongly warn for `UPDATE` without `WHERE`.
- Block or strongly warn for `DELETE` without `WHERE`.
- Require typing the table name for `DROP`, `TRUNCATE`, and destructive bulk operations.
- Add optional read-only mode per connection.
- Add “unlock writes for 5 minutes” flow for production.
- Show the active environment permanently in the title bar.
- Use a red top border or persistent production indicator when connected to prod.

Why:

- Prevents dangerous mistakes.
- Makes DB Connect trustworthy for production work.

---

### 3. Remove remaining security gaps

Known security items to keep tracking:

- Remove key-file fallback for encryption key; require OS keychain or user-provided password.
- Zero credentials from memory after connection setup using `zeroize` or `secrecy`.
- Avoid holding SSH passphrases as plain `String`.
- Add rate limiting for connection attempts and heavy commands.
- Make license/backend errors user-safe while logging technical details internally.

---

## P1 — High-Impact UX and Workflow

### 4. Improve table grid readability

The table grid is the core of the app and should receive the most UI polish.

Tasks:

- Add sticky first column / row number column.
- Add column type badges in headers: `PK`, `FK`, `TEXT`, `JSON`, `INT`, etc.
- Improve active cell, selected row, selected column, and edited cell states.
- Make `NULL` values visually distinct but not distracting.
- Add density modes: Compact, Default, Comfortable.
- Add “Resize all columns to fit”.
- Add column search/filter popover from headers.
- Add optional zebra striping toggle.

Why:

- Users spend most of their time reading/editing data.
- Better grid clarity improves the entire product.

---

### 5. Add structured error panel

Replace generic error-only experiences with a useful debugging panel.

Tasks:

- Show short human summary first.
- Show database error code/message.
- Show SQL line/column when available.
- Add actions: Copy error, Copy SQL, Retry, Open connection settings.
- Add collapsible technical details.
- Add database-specific hints where possible.

Example:

> Column `user_idd` does not exist. Did you mean `user_id`?

Why:

- Developers need actionable error messages.
- Reduces frustration when queries fail.

---

### 6. Add global schema search

Create a powerful search across the database structure.

Search targets:

- Tables
- Columns
- Indexes
- Foreign keys
- Saved queries
- Query history

Example search: `user_id`

Should show:

- `orders.user_id`
- `payments.user_id`
- FK: `orders.user_id -> users.id`
- Saved queries containing `user_id`

Why:

- Very useful for large databases.
- Helps users understand unfamiliar schemas quickly.

---

### 7. Upgrade Command Palette

Make `⌘K` the central launcher for the app.

Tasks:

- Group results by:
  - Tables
  - Columns
  - Queries
  - Connections
  - Actions
  - Settings
  - Recent
  - Favorites
- Show keyboard shortcuts in a right column.
- Add actions like:
  - Open table
  - Run saved query
  - Switch connection
  - Export current result
  - Toggle theme
  - Open settings section
- Put recent and pinned items at the top.

Why:

- Improves discoverability.
- Makes advanced users faster.

---

### 8. Add edit review and undo workflow

Inline editing is powerful but risky. Add a safer editing model.

Tasks:

- Track pending cell edits before committing.
- Add review drawer showing generated SQL.
- Allow revert single cell.
- Allow revert all pending edits.
- Support batch apply.
- Optionally wrap changes in a transaction.
- Show production warnings inside the review drawer.

Why:

- Safer data editing.
- Better confidence before applying changes.

---

### 9. Split multi-statement query results

Improve query execution for multiple SQL statements.

Example:

```sql
SELECT * FROM users;
SELECT * FROM orders;
```

Expected behavior:

- Result tab 1: users
- Result tab 2: orders
- Show per-statement duration.
- Show affected rows per statement.
- Show individual errors without hiding successful statements.

Why:

- Matches developer expectations from database clients.
- Makes SQL editor more useful for scripts.

---

## P2 — Product Differentiators

### 10. Add index recommendations

Build on the existing query plan viewer.

Tasks:

- Detect sequential scans.
- Detect joins on unindexed columns.
- Detect filters on unindexed columns.
- Show missing index suggestions.
- Add “Create index” action with SQL preview.
- Show confidence level and risk notes.

Why:

- Could become a flagship feature.
- Helps developers optimize databases without leaving the app.

---

### 11. Improve ER diagram polish

Tasks:

- Click table to open table view.
- Filter by schema.
- Highlight relationships on hover/select.
- Export diagram as image/SVG.
- Save layout positions per database.
- Add minimap for large diagrams.

Why:

- ER diagrams are a strong visual feature but need polish to feel premium.

---

### 12. Add recent workspace section

Tasks:

- Recently opened tables.
- Recently used queries.
- Recently connected databases.
- Recently imported/exported files.
- Surface recent items in home screen and command palette.

Why:

- Helps users resume work quickly.

---

# UI / Design Improvements

## 1. Make empty/loading/error states consistent

Create a reusable empty state system.

Every empty state should include:

- Icon
- Title
- Description
- Primary action
- Optional shortcut hint

Use for:

- No connections
- No tables
- No query results
- No saved queries
- No history
- Search with no matches
- Disconnected state

For loading states:

- Prefer skeleton rows/cards over centered spinners.
- Preserve layout while loading.
- Show progress/status for long operations.

---

## 2. Improve visual hierarchy

Tasks:

- Make primary actions stronger: Run, Connect, Apply, Import, Export.
- Make secondary actions quieter: Format, Explain, Refresh.
- Reduce excessive tiny uppercase labels.
- Keep uppercase mainly for metadata, badges, and environment labels.
- Keep data dense, but make toolbars easier to scan.

---

## 3. Make production visually impossible to miss

For production connections:

- Persistent title-bar badge: `PRODUCTION`.
- Red 2px top app border.
- Red-tinted destructive dialogs.
- Clear connection/database/table name in confirmations.
- Require stronger confirmation for destructive operations.

---

## 4. Improve Settings UX

Tasks:

- Add settings search.
- Use theme preview cards instead of plain dropdowns.
- Add “Reset to default” per section.
- Add keyboard shortcut editor.
- Add import/export settings.
- Collapse advanced sections by default.

---

# Performance and Architecture

## 1. Code-split heavy features

Current build has a large main JS chunk. Use dynamic imports for heavy views.

Candidates:

- ER diagram
- Schema diff
- Settings page
- SQL editor
- Import/export dialogs
- Charts/statistics panels
- License/update dialogs

Goal:

- Faster startup.
- Smaller initial JS bundle.
- Load advanced tools only when needed.

---

## 2. Split large components

Refactor large files gradually.

### `table-grid-view.tsx`

Suggested structure:

```txt
table-grid-view/
  table-grid-view.tsx
  use-table-data.ts
  use-cell-editing.ts
  use-column-visibility.ts
  use-row-actions.ts
  use-filter-state.ts
  table-grid-header.tsx
  table-grid-body.tsx
  table-grid-footer.tsx
  table-grid-empty-state.tsx
```

### `useAppStore.ts`

Split into Zustand slices:

```txt
store/
  connection-slice.ts
  query-slice.ts
  ui-slice.ts
  settings-slice.ts
  table-slice.ts
  workspace-slice.ts
```

### `app-sidebar-panel.tsx`

Split into:

```txt
app-sidebar/
  app-sidebar-panel.tsx
  connection-group.tsx
  connection-row.tsx
  database-tabs.tsx
  table-tree.tsx
  table-row.tsx
  column-row.tsx
  sidebar-actions.tsx
```

---

# Testing Improvements

Current test coverage is very small. Add tests around high-risk logic.

Priority test areas:

- SQL safety detection.
- Query splitting.
- Import/export parsing.
- Connection config validation.
- Table edit SQL generation.
- Filter builder SQL generation.
- Schema diff logic.
- License edge cases.
- Production-mode destructive query blocking.

Also fix the current Vitest warning:

> `HTMLCanvasElement.getContext()` not implemented

Possible fixes:

- Mock canvas in `tests/setup.tsx`.
- Or install/use a canvas mock package.

---

# Recommended Execution Order

1. Query limits + cancel running query.
2. Strong production safety mode.
3. Table grid readability polish.
4. Better structured error panel.
5. Global schema search.
6. Command palette upgrade.
7. Edit review / undo drawer.
8. Code splitting for heavy views.
9. More tests around risky logic.
10. Settings and empty/loading state polish.

---

# Success Metrics

Track these to know whether improvements work:

- Time to first usable screen.
- Query execution cancellation success rate.
- Number of prevented destructive production actions.
- Average time to find a table/column.
- Average time to open recent table/query.
- Error copy/retry usage.
- Import failure rate.
- Crash/error reports per release.
- Bundle size over time.
