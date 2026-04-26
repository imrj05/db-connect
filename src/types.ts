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
  group?: string; // Optional group label e.g. "dev", "staging", "prod"
  // SSH tunnel
  sshEnabled?: boolean;
  sshHost?: string;
  sshPort?: number;
  sshUser?: string;
  sshPassword?: string;
  sshKeyPath?: string;
  sshKeyPassphrase?: string;
  safetyMode?: "none" | "warn" | "read-only"; // Production safety mode
}

export interface TableInfo {
  name: string;
  schema?: string;
  columns?: ColumnInfo[];
}

export interface ColumnInfo {
  name: string;
  dataType: string;
  nullable: boolean;
  isPrimary: boolean;
  isUnique: boolean;
  defaultValue: string | null;
  extra: string | null;
}

export interface IndexInfo {
  name: string;
  columns: string[];
  unique: boolean;
  indexType: string | null;
}

export interface TableStructure {
  columns: ColumnInfo[];
  indexes: IndexInfo[];
}

export interface ForeignKeyRelation {
  name: string;
  sourceTable: string;
  sourceSchema?: string;
  sourceColumns: string[];
  targetTable: string;
  targetSchema?: string;
  targetColumns: string[];
}

export interface SchemaGraphTable {
  name: string;
  schema?: string;
  columns: ColumnInfo[];
}

export interface SchemaGraph {
  tables: SchemaGraphTable[];
  relationships: ForeignKeyRelation[];
}

// ── Schema Diff ────────────────────────────────────────────────────────────────
export type DiffStatus = "added" | "removed" | "changed" | "unchanged";

export interface ColumnDiff {
  name: string;
  status: DiffStatus;
  before?: ColumnInfo;
  after?: ColumnInfo;
}

export interface TableDiff {
  name: string;
  status: DiffStatus;
  columnDiffs: ColumnDiff[];
}

export interface RelationshipDiff {
  name: string;
  status: DiffStatus;
  before?: ForeignKeyRelation;
  after?: ForeignKeyRelation;
}

export interface SchemaDiff {
  tableDiffs: TableDiff[];
  relationshipDiffs: RelationshipDiff[];
  addedCount: number;
  removedCount: number;
  changedCount: number;
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
  description: string;   // shown in the command palette
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

// ---------- Result tabs ----------

export interface PendingCellEdit {
  id: string;
  tabId: string;
  connectionId: string;
  tableName: string;
  rowKey: string;
  primaryKeyValues: Record<string, unknown>;
  columnId: string;
  originalValue: unknown;
  pendingValue: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface CellEditHistoryEntry {
  id: string;
  tabId: string;
  connectionId: string;
  tableName: string;
  rowKey: string;
  primaryKeyValues: Record<string, unknown>;
  columnId: string;
  oldValue: unknown;
  newValue: unknown;
  committedAt: number;
  reverseSql: string; // pre-computed reverse UPDATE
}

export interface ResultTab {
  id: string;
  fn: ConnectionFunction;
  result: FunctionInvocationResult | null;
  pendingSql: string;
  pendingEdits: PendingCellEdit[];
  undoHistory: CellEditHistoryEntry[];
  label: string;      // display name, e.g. "users", "query", "list"
  // Per-tab filter state
  filters: FilterCondition[];
  filteredResult: QueryResult | null;
  filtersActive: boolean;
}

// ---------- Filter conditions (for the visual WHERE builder) ----------

export type FilterOp =
  | "=" | "!=" | ">" | "<" | ">=" | "<="
  | "LIKE" | "NOT LIKE"
  | "IS NULL" | "IS NOT NULL";

export interface FilterCondition {
  id: string;
  col: string;
  op: FilterOp;
  value: string;
  join: "AND" | "OR";
}

// ---------- Query history ----------

export interface QueryHistoryEntry {
  id: string;
  sql: string;
  executedAt: number;       // Date.now()
  executionTimeMs: number;
  rowCount: number;
  connectionId: string;
  status?: 'success' | 'error';
  errorMessage?: string;
}

export interface PinnedTable {
  connectionId: string;
  tableName: string;
  schemaName?: string;
  pinnedAt: number; // Date.now()
}

// ---------- Saved queries ----------

export interface SavedQuery {
  id: string;
  name: string;
  sql: string;
  connectionId?: string;    // optional: pin to a specific connection
  folder?: string;          // optional: folder/group name
  createdAt: number;        // Date.now()
}

export interface UserSnippet {
  id: string;
  label: string;
  description: string;
  category: string;
  sql: string;
  createdAt: number;
}

// ---------- Cell color rules (conditional cell formatting) ----------

export type CellColorRuleOp =
	| "=" | "!=" | ">" | "<" | ">=" | "<="
	| "contains" | "IS NULL" | "IS NOT NULL";

export type CellColorRuleColor =
	| "red" | "yellow" | "green" | "blue" | "purple";

export interface CellColorRule {
	id: string;
	col: string; // "" means all columns
	op: CellColorRuleOp;
	value: string;
	color: CellColorRuleColor;
}

// ---------- Aggregation footer metrics ----------
export type AggMetric = "sum" | "avg" | "min" | "max" | "count" | null;

// ---------- NoSQL types (unchanged) ----------

export interface RedisKey {
  key: string;
  type: 'string' | 'list' | 'set' | 'zset' | 'hash' | 'none';
}

export interface MongoCollection {
  name: string;
}

// ---------- Import / Export ----------

export type ExportFormat = 'json' | 'uri';
export type ImportFormat = 'json' | 'uri' | 'dbeaver';
export type ConflictStrategy = 'skip' | 'overwrite' | 'rename';

export interface ExportOptions {
  format: ExportFormat;
  includePasswords: boolean;
  passphrase?: string;
  connectionIds?: string[]; // undefined = all
}

export interface ImportOptions {
  format: ImportFormat;
  passphrase?: string;
  conflictStrategy: ConflictStrategy;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
  connections: ConnectionConfig[];
}

export interface ConnectionExport {
  version: number;
  app: string;
  exportedAt: string;
  passwordProtected: boolean;
  connections: ConnectionConfig[];
}

// ---------- Workspace snapshot ----------

export interface WorkspaceTabSnapshot {
  id: string;
  fnId: string;           // ConnectionFunction.id
  label: string;
  pendingSql: string;
}

export interface WorkspaceSnapshot {
  activeConnectionId: string | null;
  activeTabId: string | null;
  selectedDatabases: Record<string, string>; // connectionId → database name
  tabs: WorkspaceTabSnapshot[];
  savedAt: number;
}
