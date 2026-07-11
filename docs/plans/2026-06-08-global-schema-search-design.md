# Global Schema Search Design

## Goal

Make it easy to find any table, column, or query from the command palette.

## Current State

The command palette already supports a schema search mode triggered by a leading `@`. It searches tables and columns across `connectionTables`.

## Scope for This Phase

- Extend the `@` schema search to also search saved queries and recent queries.
- Group results into clear sections.
- Show connection badges for table and column hits.
- Click to open the corresponding table or query.

## Behavior

When the user types `@`, the placeholder changes to indicate schema search mode.

The search runs across:

- Tables: name contains query
- Columns: name or data type contains query
- Saved queries: name or SQL contains query
- Recent queries: SQL contains query

Results are grouped as:

- Tables
- Columns
- Saved queries
- Recent queries

Each result shows the connection name for tables and columns. Saved and recent queries show a snippet of the SQL.

## Files Likely Touched

- `src/components/layout/command-palette.tsx`

## Excluded

- Index and foreign key search.
- Indexing and persistence of search history.
- Cross-database name dedup and ranking.
