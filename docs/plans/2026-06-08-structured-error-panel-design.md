# Structured Error Panel Design

## Goal

Make query and app errors easier to understand and act on without hiding raw technical details.

## Scope

Included:

- Error summary.
- Connection/database/function context.
- Copy error action.
- Copy SQL action when SQL is available.
- Retry action.
- Collapsible technical details.
- Lightweight string-based troubleshooting hints.

Excluded:

- Database-specific line/column parsing.
- Error code extraction per driver.
- Persistent debug/error log panel.
- AI-generated fixes.

## Behavior

The error panel should show:

- A short summary derived from the first error line.
- Context metadata for connection, database, and active function.
- A hint when the error matches common failure patterns.
- Actions: Back, Retry, Copy SQL, Copy error.
- Raw error details in a collapsible block.
