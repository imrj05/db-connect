# Store Slices

`useAppStore` is composed from these slices (zustand slices pattern). Each slice
is a `StateCreator<AppState, [], [], XSlice>` so cross-slice reads/writes go
through the fully-typed `get()`/`set()`.

- `connection-slice.ts` — connection list + persistence, connect/disconnect lifecycle, database/table discovery, health pings.
- `workspace-slice.ts` — result tabs, active function/invocation, `invokeFunction`, multi-statement runs, query cancellation, pending cell edits, tab filters.
- `query-slice.ts` — query history, saved queries, snippets.
- `table-slice.ts` — pinned + recent tables.
- `ui-slice.ts` — active view, sidebar/layout, dialogs, theme.
- `settings-slice.ts` — `appSettings` and persistence (factory takes load/save fns for testability).

Shared types live in `../types.ts`; localStorage/workspace persistence helpers in
`../lib/persistence.ts`. The composition (and the `AppState` type) lives in
`../useAppStore.ts` — its external API is unchanged from the monolith days.
