# Edit Review Drawer Design

## Goal

Make pending cell edits easy to review, navigate, and revert before applying them.

## Current State

The store already supports:

- `queuePendingCellEdit`
- `clearPendingCellEdits`
- `removePendingCellEdits`
- `tabHasPendingCellEdits`

But the UI does not provide a review surface to inspect queued changes.

## Scope

Included:

- A review drawer component for pending edits.
- List of pending edits with table, column, original, new, generated SQL.
- Revert single edit action.
- Revert all edits action.
- Open from a badge in the table grid toolbar.

Excluded:

- Selective apply.
- Transaction wrapper.
- Conflict detection between pending edits and current data.
- Diff view of changes per row.

## Files Likely Touched

- `src/components/layout/function-output/table-grid/pending-edits-drawer.tsx` (new)
- `src/components/layout/function-output/table-grid-view.tsx`
