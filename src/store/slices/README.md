# Store Slices (scaffold)

This folder is the target layout for the `useAppStore` refactor.

Planned slices:

- `connection-slice.ts` — connection list, persistence, connect/disconnect lifecycle.
- `query-slice.ts` — query history, saved queries, snippets.
- `ui-slice.ts` — sidebar state, active view, command palette, modal state.
- `settings-slice.ts` — `appSettings` and persistence.
- `table-slice.ts` — table browsing state and recent/pinned tables.
- `workspace-slice.ts` — tabs, result state, running queries, multi-statement state.

For now, the actual store is still defined in `useAppStore.ts`. Slices will be introduced incrementally without changing external API.
