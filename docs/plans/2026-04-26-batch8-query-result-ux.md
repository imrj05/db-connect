# Batch 8 — Query Result UX

**Date:** 2026-04-26  
**Status:** Approved

## Features

### 1. Column Stats Panel
Right-click a column header → "Column Stats" → compact bottom drawer showing null %, distinct count, min/max/avg/sum (numeric), top-5 most common values with frequency bars. All computed client-side from current in-memory result set — no DB query.

**Implementation:**
- New `src/components/layout/function-output/table-grid/column-stats-panel.tsx`
- Add `onColumnStats` to `ColumnContextMenu`
- `statsCol: string | null` local state in `table-grid-view.tsx`
- Compute stats via `useMemo` from `effectiveResult.rows`

### 2. Column Freeze (Pin left/right)
Column context menu → "Pin to left" / "Pin to right" / "Unpin". Uses TanStack Table `columnPinning` state. Pinned columns get a sticky shadow divider. Local state in `table-grid-view.tsx`.

**Implementation:**
- Add `columnPinning: ColumnPinningState` to TanStack table config
- Add `onPinLeft`, `onPinRight`, `onUnpin` to `ColumnContextMenu`
- Render sticky left/right columns with shadow indicator

### 3. Aggregation Footer Row
`Σ` toggle button in `GridToolbar`. Sticky `<tfoot>` row in the grid with per-column aggregates. Click a footer cell to cycle: SUM → AVG → MIN → MAX → COUNT → off. Numeric columns compute full stats; text columns show COUNT.

**Implementation:**
- Add `showAggFooter` / `onToggleAggFooter` to `GridToolbar`
- `showAggFooter: boolean` + `footerMetrics: Record<string, AggMetric>` local state in grid
- Compute aggregates via `useMemo` from `effectiveResult.rows`

### 4. Conditional Cell Coloring Rules
"Color rules" button in `GridToolbar` opens an inline panel. Rule builder: pick column, comparison op, threshold/value, color (5 preset accent colors). Applied on every cell render. Multiple rules supported. State is local to the grid component.

**Implementation:**
- New type `CellColorRule` in `types.ts`
- New `src/components/layout/function-output/table-grid/color-rules-panel.tsx`
- `colorRules: CellColorRule[]` local state in `table-grid-view.tsx`
- Apply rules during cell render to inject a CSS class

### 5. Multi-statement SQL Runner
When the SQL editor has multiple `;`-separated statements, a "Run All (N)" button appears next to Run. Runs each statement sequentially. Results appear as collapsible sections below the editor with per-statement timing. Errors stop execution by default.

**Implementation:**
- Parse SQL by `;` in `sql-editor-view.tsx`
- `multiResults: MultiStatementResult[]` state
- "Run All (N)" button in `SqlEditorToolbar`
- Collapsible sections rendered below the existing results grid

### 6. Per-tab Page Size Selector
Compact dropdown in the table footer to override the global page size (25/50/100/200/500) for just that tab session. Local state in `table-grid-view.tsx`.

**Implementation:**
- `localPageSize: number | null` state in grid component
- Effective page size = `localPageSize ?? pageSize` (prop from settings)
- Dropdown in footer area next to Prev/Next buttons
