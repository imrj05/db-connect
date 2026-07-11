# Table Grid Readability Design

## Goal

Improve table scanning and data editing clarity without a risky grid rewrite.

## Scope

Included:

- Sticky row number column.
- Column metadata badges for PK/FK/type.
- Clearer selected row, selected cell, selected column, and pending edit states.
- More readable `NULL` display.
- Consistent limit warning presentation.

Excluded:

- Virtualization.
- Arbitrary frozen columns.
- Header filter popovers.
- Edit review drawer.
- Full grid architecture refactor.

## Implementation Notes

The current table grid already has column metadata, selection state, pending edit state, and row numbering. This phase should improve rendering and styling in place.

Column headers should show:

- Column name.
- `PK` if primary key.
- `FK` if foreign key relation exists.
- Simplified type badge such as `TEXT`, `INT`, `JSON`, `BOOL`, `DATE`.

`NULL` values should render as a subtle pill instead of italic text.

The row number column should be sticky at `left: 0` with an elevated z-index and matching row background.
