export type DatabaseType = 'postgresql' | 'mysql' | 'sqlite' | 'mongodb' | 'redis';

export interface ConnectionConfig {
  id: string;
  name: string;
  prefix: string; // user-defined prefix e.g. "lahman", "mydb" → generates prefix_list(), prefix_batting()...
  type: DatabaseType;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  schema?: string;
  ssl?: boolean;
  uri?: string; // For MongoDB or connection strings
}

export interface TableInfo {
  name: string;
  schema?: string;
  columns?: ColumnInfo[];
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  isPrimary: boolean;
}

export interface QueryResult {
  columns: string[];
  rows: any[];
  executionTimeMs: number;
  error?: string;
}

// ---------- dbcooper function registry types ----------

export type ConnectionFunctionType =
  | 'list'     // prefix_list()       → list all tables
  | 'src'      // prefix_src()        → show connection info
  | 'query'    // prefix_query(sql)   → execute SQL
  | 'execute'  // prefix_execute(sql) → run DDL/DML
  | 'tbl'      // prefix_tbl(table)   → browse any table by name
  | 'table';   // prefix_tableName()  → per-table zero-arg shortcut

export interface ConnectionFunction {
  id: string;            // unique: e.g. "conn1_list", "conn1_t_batting"
  name: string;          // display name: "lahman_list()"
  callSignature: string; // "lahman_list()" or "lahman_query(sql)"
  prefix: string;        // "lahman"
  connectionId: string;
  type: ConnectionFunctionType;
  tableName?: string;    // only for type === 'table' | 'tbl'
  description: string;   // shown in CommandPalette
}

export type FunctionOutputType =
  | 'idle'           // nothing invoked yet
  | 'table-grid'     // TanStack table displaying query results
  | 'sql-editor'     // CodeMirror editor for query/execute
  | 'connection-src' // info card for _src()
  | 'table-list';    // list of tables for _list()

export interface ConnectionSourceInfo {
  connectionId: string;
  name: string;
  prefix: string;
  type: DatabaseType;
  host?: string;
  port?: number;
  database?: string;
  ssl?: boolean;
  tableCount: number;
}

export interface FunctionInvocationResult {
  fn: ConnectionFunction;
  outputType: FunctionOutputType;
  queryResult?: QueryResult;
  tables?: TableInfo[];
  connectionInfo?: ConnectionSourceInfo;
  isLoading: boolean;
  error?: string;
  invokedAt: number; // Date.now()
}

// ---------- NoSQL types (unchanged) ----------

export interface RedisKey {
  key: string;
  type: 'string' | 'list' | 'set' | 'zset' | 'hash' | 'none';
}

export interface MongoCollection {
  name: string;
}
