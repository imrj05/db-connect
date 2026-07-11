# Query Cancellation Design

## Goal

Allow users to cancel SQL editor queries that are currently running, without waiting for timeout or database completion.

## Scope

Included in this phase:

- SQL editor query cancellation.
- Multi-statement SQL cancellation per running statement/tab.
- Tauri command to cancel by query ID.
- App-level cancellation using abort handles.

Excluded from this phase:

- Table browsing cancellation.
- Import/export cancellation.
- Schema introspection cancellation.
- Driver-specific server-side cancellation.

## Backend Design

Each SQL editor execution receives a frontend-generated `queryId`.

The Rust command stores an abort handle in a registry:

```txt
queryId -> AbortHandle
```

`execute_query` wraps `driver.run_query()` in `Abortable`. The new `cancel_query(query_id)` command looks up the abort handle and aborts the future.

When the query completes, times out, errors, or is cancelled, the registry entry is removed.

## Frontend Design

The store tracks running query IDs by tab:

```ts
runningQueryIds: Record<string, string>
```

When a SQL query starts:

- Generate a `queryId`.
- Store it against the active tab.
- Pass it to `tauriApi.executeQuery`.

When the query ends:

- Remove the tab's `queryId`.

When the user clicks Cancel:

- Read the active tab's `queryId`.
- Call `tauriApi.cancelQuery(queryId)`.
- Clear the loading state.
- Show a toast confirming cancellation.

## UI Design

While a cancellable SQL query is running, the Run button becomes a destructive-outline **Cancel** button in the SQL editor toolbar.

The editor remains visible while the query is running so users can cancel without losing context.

## Limitation

This is app-level cancellation. It stops waiting/rendering in the app, but some database servers may continue executing the query until their driver/session notices cancellation. Later phases can add driver-specific server-side cancellation for PostgreSQL, MySQL, SQLite, MongoDB, and Redis.
