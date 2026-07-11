# Query Safety Limits Design

## Goal

Add configurable query safety limits for SQL editor execution and table browsing. The feature should protect users and databases from oversized SQL, runaway queries, and unexpectedly large result sets while keeping the UI clear.

## Scope

Included in this phase:

- SQL editor query execution.
- Table browsing via `get_table_data`.
- Settings for SQL size, max result rows, and timeout.
- Frontend validation for good UX.
- Backend enforcement as the source of truth.

Excluded from this phase:

- Import/export limits.
- Schema introspection limits.
- Query cancellation. Cancellation will be implemented separately because reliable cancellation needs query IDs/task handles and driver-specific behavior.

## Settings

Add these settings to `AppSettings`:

- `queryMaxSqlBytes`: default `1_048_576` bytes.
- `queryMaxResultRows`: default `10_000` rows.
- `queryTimeoutSecs`: existing setting, surfaced with clearer safety wording.

Settings UI should expose fixed choices:

- Max SQL size: 256 KB, 512 KB, 1 MB, 5 MB, 10 MB.
- Max result rows: 1,000, 5,000, 10,000, 50,000, 100,000.
- Timeout: 10s, 30s, 60s, 120s, 300s.

## Backend Enforcement

Update Tauri commands:

- `execute_query(id, query, timeout_secs, database, max_sql_bytes, max_result_rows)`
- `get_table_data(id, database, table, page, page_size, max_result_rows)`

Rules:

- Reject SQL whose UTF-8 byte length exceeds `max_sql_bytes`.
- Clamp timeouts to a safe range.
- Clamp table page sizes so table browsing cannot exceed the configured row cap.
- Truncate returned rows to `max_result_rows` if a driver returns more than the cap.
- Return metadata on `QueryResult` when rows were limited.

## Frontend Behavior

Before sending a SQL editor query:

- Check SQL byte length with `TextEncoder`.
- If too large, show a toast with actual size and configured limit.
- Do not send oversized SQL to Tauri.

When a result is limited:

- Show a non-error warning near the result grid.
- Message: “Results limited to N rows by Query safety settings.”

## Data Shape

Extend `QueryResult` with optional metadata:

```ts
limitWarning?: string;
limited?: boolean;
rowLimit?: number;
```

Rust equivalent fields should be optional/defaulted for compatibility.

## Error Handling

- Oversized SQL returns a clear error.
- Timeout errors include the configured timeout.
- Limit warnings are not errors; they should not block result display.

## Testing

Add or update tests where practical for:

- Settings defaults.
- Frontend SQL byte-size formatting/checking helper if extracted.
- Backend command behavior can be covered later with Rust tests or integration tests.
