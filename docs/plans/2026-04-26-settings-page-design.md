# Settings Page Redesign

## Goal

Redesign `src/components/layout/function-output/settings-page.tsx` into a clearer desktop settings surface that uses the existing shadcn/ui primitives instead of custom settings-shell and segmented-control markup.

## Chosen Approach

Use a left-rail plus cards layout.

- Keep the existing top header and back action.
- Replace the custom shell with vertical `Tabs` for category navigation.
- Use a scrollable right pane with section-specific `Card` groups.
- Replace custom setting rows with `FieldGroup`, `Field`, `FieldContent`, `FieldTitle`, and `FieldDescription`.
- Replace segmented controls with `ToggleGroup`.
- Replace timed destructive confirmations with `AlertDialog`.

## Section Structure

- `appearance`: cards for theme/zoom controls and typography.
- `editor`: cards for editor typography and syntax highlighting.
- `table`: card for table paging defaults.
- `ai`: cards for enablement/provider selection, model defaults, and credentials.
- `storage`: cards for data location, usage stats, and cleanup actions.
- `license`: cards for license status and device activation details.
- `about`: cards for product summary and runtime stack metadata.

## UX Notes

- The desktop rail stays visible on medium and larger screens.
- A compact horizontal tab list is shown on smaller screens.
- Cards group related settings so the page reads as a desktop control surface rather than a long row list.
- Status, empty states, and warnings use `Badge`, `Alert`, and `Empty`.

## Validation

- Run `npm run build` after the refactor.
