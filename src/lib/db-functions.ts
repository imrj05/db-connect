/**
 * db-functions.ts
 *
 * The TypeScript equivalent of dbcooper's init.R.
 * Given a ConnectionConfig + discovered tables, this module builds a registry of
 * typed function descriptors — one per connection utility (list, src, query, execute, tbl)
 * plus one zero-argument shortcut per discovered table (prefix_tableName()).
 */

import {
  ConnectionConfig,
  ConnectionFunction,
  TableInfo,
} from "@/types";

/**
 * Convert an arbitrary string to snake_case.
 * e.g. "MyTable_Name" → "my_table_name", "battingAvg" → "batting_avg"
 */
export function toSnakeCase(name: string): string {
  return name
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z\d])([A-Z])/g, "$1_$2")
    .replace(/[\s\-\.]+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .toLowerCase()
    .replace(/^_+|_+$/g, "");
}

/**
 * Sanitize a raw string into a valid function prefix.
 * Rules: lowercase, only letters/digits/underscores, no leading digit.
 */
export function sanitizePrefix(raw: string): string {
  let result = raw
    .trim()
    .toLowerCase()
    .replace(/[\s\-\.]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");

  // Remove leading digits
  result = result.replace(/^[0-9_]+/, "");

  // Fallback if empty
  return result || "conn";
}

/**
 * Auto-suggest a prefix from a human-readable connection name.
 * "Production Analytics" → "prod_analytics"
 * "My MySQL DB" → "my_mysql_db"
 */
export function suggestPrefix(connectionName: string): string {
  return sanitizePrefix(toSnakeCase(connectionName));
}

/**
 * Core function: build the full ConnectionFunction[] registry for a connection.
 * Mirrors dbcooper's dbc_init() — generates the five utility functions plus
 * one per-table shortcut for every discovered table.
 *
 * Function order (matching dbcooper):
 *   1. prefix_list()
 *   2. prefix_src()
 *   3. prefix_query(sql)
 *   4. prefix_execute(sql)
 *   5. prefix_tbl(tableName)   ← generic accessor
 *   6+ prefix_tableName()       ← per-table shortcuts (snake_case normalized)
 */
export function buildConnectionFunctions(
  connection: ConnectionConfig,
  tables: TableInfo[],
): ConnectionFunction[] {
  const { id: connectionId, prefix } = connection;
  const fns: ConnectionFunction[] = [];

  // --- 1. prefix_list() ---
  fns.push({
    id: `${connectionId}_list`,
    name: `${prefix}_list()`,
    callSignature: `${prefix}_list()`,
    prefix,
    connectionId,
    type: "list",
    description: "List all available tables",
  });

  // --- 2. prefix_src() ---
  fns.push({
    id: `${connectionId}_src`,
    name: `${prefix}_src()`,
    callSignature: `${prefix}_src()`,
    prefix,
    connectionId,
    type: "src",
    description: "Show connection source info",
  });

  // --- 3. prefix_query(sql) ---
  fns.push({
    id: `${connectionId}_query`,
    name: `${prefix}_query(sql)`,
    callSignature: `${prefix}_query(sql)`,
    prefix,
    connectionId,
    type: "query",
    description: "Execute a SQL query and return results",
  });

  // --- 4. prefix_execute(sql) ---
  fns.push({
    id: `${connectionId}_execute`,
    name: `${prefix}_execute(sql)`,
    callSignature: `${prefix}_execute(sql)`,
    prefix,
    connectionId,
    type: "execute",
    description: "Run DDL or non-returning SQL statement",
  });

  // --- 5. prefix_tbl(tableName) ---
  fns.push({
    id: `${connectionId}_tbl`,
    name: `${prefix}_tbl(table)`,
    callSignature: `${prefix}_tbl(tableName)`,
    prefix,
    connectionId,
    type: "tbl",
    description: "Browse any table by name",
  });

  // --- 6+. Per-table shortcuts ---
  // Track used (schema, snake_case name) pairs to handle collisions within the
  // same database (like R's dbcooper does). We key by schema so that tables
  // with the same name in *different* databases never collide.
  const usedNames = new Set<string>();

  for (const table of tables) {
    const rawName = table.name;
    const snakeName = toSnakeCase(rawName);
    // When the table carries a schema/database (e.g. MySQL), embed it into the
    // collision-detection key so identical table names in different databases
    // never clobber each other.
    const schemaKey = table.schema ? toSnakeCase(table.schema) : "";
    const dedupePrefix = schemaKey ? `${schemaKey}__${snakeName}` : snakeName;

    // Handle naming collisions within the same schema: batting_2(), batting_3()
    let finalName = snakeName;
    let dedupeName = dedupePrefix;
    let suffix = 2;
    while (usedNames.has(dedupeName)) {
      finalName = `${snakeName}_${suffix}`;
      dedupeName = schemaKey ? `${schemaKey}__${finalName}` : finalName;
      suffix++;
    }
    usedNames.add(dedupeName);

    // Include schema in the ID so that db1.users and db2.users get unique IDs.
    const fnId = schemaKey
      ? `${connectionId}_t_${schemaKey}_${finalName}`
      : `${connectionId}_t_${finalName}`;

    fns.push({
      id: fnId,
      name: `${prefix}_${finalName}()`,
      callSignature: `${prefix}_${finalName}()`,
      prefix,
      connectionId,
      type: "table",
      tableName: rawName,
      schema: table.schema,
      description: `Browse ${rawName} table${table.schema ? ` (${table.schema})` : ""}`,
    });
  }

  return fns;
}

/**
 * Filter functions for the command palette.
 * Supports prefix-anchored search ("lahman" -> all lahman_* functions)
 * and partial match ("batting" -> lahman_batting()).
 */
export function filterFunctions(
  allFunctions: ConnectionFunction[],
  query: string,
): ConnectionFunction[] {
  if (!query.trim()) return allFunctions;

  const q = query.trim().toLowerCase();

  return allFunctions.filter((fn) => {
    const sig = fn.callSignature.toLowerCase();
    const desc = fn.description.toLowerCase();
    const tableName = fn.tableName?.toLowerCase() ?? "";

    return (
      sig.includes(q) ||
      desc.includes(q) ||
      tableName.includes(q) ||
      fn.prefix.toLowerCase().startsWith(q)
    );
  });
}

/**
 * Find a specific function descriptor by its call signature string.
 */
export function findFunctionBySignature(
  fns: ConnectionFunction[],
  signature: string,
): ConnectionFunction | undefined {
  return fns.find((fn) => fn.callSignature === signature);
}
