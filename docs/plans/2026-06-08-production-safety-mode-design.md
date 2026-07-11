# Production Safety Mode Design

## Goal

Make production write operations hard to run accidentally while preserving fast workflows for local and development databases.

## Production Detection

A connection is treated as production when its `group` contains `prod` or `production`.

## SQL Classification

Write SQL includes:

- `INSERT`
- `UPDATE`
- `DELETE`
- `DROP`
- `TRUNCATE`
- `ALTER`
- `CREATE`
- `REPLACE`
- `MERGE`

Destructive SQL includes:

- `DELETE`
- `DROP`
- `TRUNCATE`
- `UPDATE` without `WHERE`

## Behavior

For production connections:

- Any write SQL opens a confirmation dialog.
- Destructive SQL requires a typed confirmation phrase.
- The dialog shows the connection name, database, and SQL preview.

For read-only connections:

- Write SQL is blocked before opening a confirmation dialog.

For non-production connections:

- Existing destructive confirmation behavior remains.

## Confirmation Phrase

The required phrase is derived from SQL:

- `DROP TABLE users` -> `users`
- `TRUNCATE TABLE orders` -> `orders`
- `DELETE FROM users` without `WHERE` -> `DELETE`
- `UPDATE users SET ...` without `WHERE` -> `UPDATE`
- Other production writes -> `RUN`

## Current Scope

Included:

- SQL editor execution path.
- Production write confirmation.
- Stronger typed confirmation for destructive production SQL.
- Read-only write blocking.

Excluded for later:

- Inline table edit review drawer.
- Temporary production write unlock timer.
- Persistent title-bar production badge.
