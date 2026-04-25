# DB Connect Roadmap

## High-Impact Features To Add

1. Connection Health Dashboard
   - Show active connections, latency, database size, table count, and last query time.
   - Add quick actions: reconnect, disconnect, refresh schema.
   - This helps the app feel more professional and operationally useful.

2. Pinned/Favorite Tables
   - Let users star frequently used tables.
   - Show pinned tables at the top of the sidebar or command palette.
   - Useful for large databases with many tables.

3. Recent Tables & Queries
   - Add a “Recently Opened” section.
   - Include recent tables, SQL files, saved queries, and databases.
   - Helps users resume work quickly.

4. Better Query History
   - Add search, filters, status, duration, row count, and error/success badges.
   - Allow rerun, copy SQL, save query, and delete entry.
   - Current history can become a strong productivity feature.

5. Saved Query Folders
   - Let users organize saved queries by folder or group.
   - Example folders: Reports, Debugging, Migrations, Admin.
   - Add command palette access.

6. Schema Search
   - Global search across tables, columns, indexes, and relationships.
   - Example: search `user_id` and see every table or column using it.
   - Very valuable in real database work.

7. Table Detail Sidebar
   - When viewing a table, show metadata: columns, primary keys, indexes, foreign keys, row count, and nullable fields.
   - This can reduce context-menu usage and make table browsing faster.

8. Inline Column Type Badges
   - In table grid headers, show subtle badges like `PK`, `FK`, `TEXT`, `INT`, `JSON`.
   - Makes table browsing easier at a glance.

9. Data Export Presets
   - Export current result or table as CSV, JSON, SQL inserts, Markdown table, or clipboard content.
   - Include “export selected rows”.

10. Import Preview & Validation
    - Before importing CSV or JSON, show detected columns, types, invalid rows, and mapping.
    - Prevents bad imports.

11. Query Explain UI
    - Build a visual plan viewer around `EXPLAIN`.
    - Show cost, scan type, rows, warnings, and missing index suggestions.
    - This could become an advanced flagship feature.

12. AI SQL Assistant Improvements
    - Add quick prompts: explain query, optimize query, generate query from schema, fix error, create index suggestion.
    - Add schema-aware context selection.

13. ER Diagram Polish
    - Make ER diagrams interactive: click table to open, filter by schema, highlight relationships, export diagram image.
    - This can become a flagship feature.

14. Diff / Migration Preview
    - When editing rows or schema, show generated SQL before applying.
    - Let users copy or save migration SQL.
    - Especially useful for production safety.

15. Safe Mode For Production
    - If connection group is `prod`, require confirmation for DELETE, DROP, TRUNCATE, and UPDATE without WHERE.
    - Add a visual production warning in the title bar.

16. Connection Groups Workspace
    - Improve group management for Local, Dev, Staging, and Production.
    - Add group colors, icons, and filters.

17. Multiple Result Tabs Per Query
    - Allow running multiple SQL statements and showing separate result tabs.
    - Example: one editor run returns 3 result grids.

18. Keyboard Shortcut Settings
    - Add shortcut customization.
    - Show available shortcuts in settings.
    - Developer tools benefit heavily from keyboard control.

19. Command Palette Upgrade
    - Add actions like open table, run saved query, switch connection, export current result, toggle theme, and open settings section.
    - Make it the central launcher.

20. Better Error UX
    - Add error summary, exact SQL line if available, copy error, AI fix button, and database-specific hints.

## UI/UX Polish To Add

1. Loading Skeletons
   - Replace centered spinners with skeleton rows/cards.
   - Especially useful for table loading and connection manager loading.

2. Empty State System
   - Create consistent empty states for no tables, no search results, no query result, no saved queries, no history, and disconnected state.

3. Status Bar Improvements
   - Show active connection, selected database, query duration, row count, pending edits, and connection status.

4. Toast Action Buttons
   - Examples: “Query copied” with Undo, “Rows exported” with Open file, “Connection failed” with Edit connection.

5. Resizable Layout Persistence
   - Save sidebar width, editor split height, and query log state.
   - Users expect desktop apps to remember layout.

6. Theme Preview Cards
   - In settings, show small previews for UI and editor themes.
   - Better than a plain select list.

7. Compact / Comfortable Density Mode
   - Add UI density setting: Compact, Default, Comfortable.
   - Good fit for a database client.

## Detailed UI/UX Suggestions

1. Create a Clear Visual Hierarchy
   - Make primary actions visually stronger than secondary actions.
   - `Run Query`, `Connect`, and `Apply Changes` should stand out more than `Format`, `Explain`, `Refresh`, and `Import`.

2. Reduce Tiny Uppercase Text
   - The app uses many `9px` to `11px` uppercase labels.
   - Keep uppercase for badges and metadata only.
   - Use normal sentence/title case for buttons, settings rows, empty states, and toolbar actions.

3. Add Density Modes
   - Add a setting for Compact, Default, and Comfortable modes.
   - Database tools need density, but different users prefer different spacing.

4. Improve Table Grid Readability
   - Add clearer row hover, selected row, active cell, and edited cell states.
   - Show column type badges in headers: `PK`, `FK`, `TEXT`, `INT`, `JSON`.
   - Optionally freeze the first column.
   - Add row numbers.

5. Make Empty States Consistent
   - Use one reusable empty-state component.
   - Include an icon, title, description, primary action, and optional shortcut hint.

6. Polish Loading States
   - Replace full-screen spinners with skeleton rows/cards.
   - Tables should show skeleton rows.
   - Connection manager should show skeleton cards.
   - SQL result loading should preserve layout instead of blanking the screen.

7. Improve Error States
   - Show a short summary first.
   - Include technical detail below in a collapsible block.
   - Add actions: Copy Error, Copy SQL, Try Again, Ask AI to Fix.

8. Improve Connection Safety UX
   - Production connections should look visually different.
   - Add a `Production` warning badge in the title bar.
   - Require stronger confirmation for destructive actions on production groups.

9. Improve Command Palette UX
   - Add categories for Tables, Queries, Connections, Actions, and Settings.
   - Add keyboard shortcuts in a right column.
   - Add recent and favorite items at the top.

10. Better Sidebar UX
    - Add pinned tables.
    - Add recent tables.
    - Separate “Connections” from “Current Database”.
    - Make search global across table names and column names.

11. Improve Settings Page
    - Add search inside settings.
    - Add theme preview cards instead of plain dropdowns.
    - Group advanced options under collapsible sections.
    - Add “Reset to Default” per section.

12. Make Tabs More Informative
    - Show table/query icon, connection color, and pending edit dot.
    - Add a right-click menu: Close, Close Others, Duplicate, Copy Table Name / Query.
    - Show tooltip with full connection, database, and table info.

13. Improve SQL Editor UX
    - Add query snippets.
    - Add format options.
    - Improve schema autocomplete.
    - Add a “Run selected SQL” affordance.
    - Show result summary after execution: rows, duration, affected rows.

14. Improve Data Editing UX
    - Mark edited cells clearly.
    - Add an edit review drawer before applying changes.
    - Show generated SQL diff.
    - Add undo for pending edits.

15. Improve Mobile/Small Window Behavior
    - Even as a desktop app, users may resize windows.
    - Add responsive behavior for title bar overflow, command palette, connection dialog, and table toolbar.

16. Use More Semantic Status Indicators
    - Green: connected/success.
    - Amber: warning/pending.
    - Red: destructive/error.
    - Blue/accent: selected/current.
    - Avoid using accent colors decoratively unless they mean something.

17. Add Microcopy Improvements
    - Replace generic labels with specific labels.
    - Examples: `Apply` to `Apply 3 Edits`, `Reset` to `Discard Edits`, `Connect now` to `Connect`, `No match` to `No tables match this filter`.
    - Good microcopy makes the app feel polished.

18. Add Workspace Persistence
    - Restore open tabs, active connection, selected database, sidebar width, editor height, and query log state.
    - This is a major desktop-app UX win.

19. Add Onboarding After First Connection
    - After connecting, show a small guided hint: “Open a table from the sidebar”, “Press Cmd+K to search”, “Use Cmd+Enter to run SQL”.
    - Keep it subtle and dismissible.

20. Create a Unified Design System Pass
    - Define reusable patterns for toolbar buttons, icon buttons, badges, empty states, section headers, table states, and destructive confirmations.
    - This will make future features look consistent by default.

## Top 5 UX Improvements To Prioritize

1. Table grid readability and edited-cell states
2. Better command palette categories and recents
3. Consistent empty/loading/error states
4. Production safe mode visuals
5. Workspace/layout persistence

## Developer/Product Features

1. Connection Backup & Restore
   - Export encrypted connection backups.
   - Restore on another machine.

2. Workspace Profiles
   - Save workspace state: open tabs, selected connection, database, and sidebar state.
   - Restore on launch.

3. Update Release Notes
   - When update dialog appears, show changelog.
   - Makes updates feel trustworthy.

4. License/Plan Page Polish
   - Show plan, status, expiry, activated devices, and upgrade CTA.

5. Crash/Error Report Export
   - Let users copy diagnostic info: app version, OS, database type, and error stack.
   - Useful for debugging.

## Recommended Next 5 To Build

1. Pinned tables
2. Better query history
3. Schema search
4. Production safe mode
5. Layout persistence
