import type { ColumnInfo, ForeignKeyRelation, IndexInfo } from "@/types";

// ── Draft types (used in the editor) ──────────────────────────────────────────

export interface DraftColumn {
	id: string;
	name: string;
	dataType: string;
	nullable: boolean;
	isPrimary: boolean;
	defaultValue: string | null;
	previousName?: string;
}

export interface DraftIndex {
	id: string;
	name: string;
	columns: string[];
	unique: boolean;
	method?: string;
}

export interface DraftTable {
	id: string;
	name: string;
	schema?: string;
	columns: DraftColumn[];
	indexes: DraftIndex[];
	previousName?: string;
	isNew: boolean;
}

export interface DraftForeignKey {
	id: string;
	name: string;
	sourceTableId: string;
	sourceColumns: string[];
	targetTableId: string;
	targetColumns: string[];
}

export interface SchemaDraft {
	tables: DraftTable[];
	foreignKeys: DraftForeignKey[];
	engine: "postgres" | "mysql" | "sqlite";
}

// ── Change union ─────────────────────────────────────────────────────────────

export type SchemaChange =
	| { type: "createTable"; table: DraftTable }
	| { type: "dropTable"; tableName: string; schema?: string }
	| { type: "renameTable"; oldName: string; newName: string; schema?: string; table: DraftTable }
	| { type: "addColumn"; tableName: string; schema?: string; column: DraftColumn }
	| { type: "dropColumn"; tableName: string; schema?: string; columnName: string }
	| { type: "alterColumn"; tableName: string; schema?: string; column: DraftColumn; oldColumn: ColumnInfo }
	| { type: "renameColumn"; tableName: string; schema?: string; oldName: string; newColumn: DraftColumn }
	| { type: "createIndex"; tableName: string; schema?: string; index: DraftIndex }
	| { type: "dropIndex"; tableName: string; schema?: string; indexName: string }
	| { type: "addForeignKey"; fk: DraftForeignKey; sourceTableName: string; targetTableName: string }
	| { type: "dropForeignKey"; fkName: string; sourceTableName: string }
	| { type: "rebuildTable"; tableName: string; schema?: string; table: DraftTable; oldColumns: ColumnInfo[]; oldIndexes: IndexInfo[]; oldFKs: ForeignKeyRelation[] };

// ── DDL generation result ────────────────────────────────────────────────────

export interface DdlStatement {
	sql: string;
	destructive: boolean; // will this lose data if not handled carefully?
	description: string;
}

export interface GenerateResult {
	statements: DdlStatement[];
	hasDestructive: boolean;
	engine: "postgres" | "mysql" | "sqlite";
	useTransaction: boolean; // true for PG + SQLite, false for MySQL (DDL auto-commits)
}

// ── Change categorization for the save dialog ────────────────────────────────

export type ChangeCategory = "create" | "drop" | "alter" | "rename";

export interface CategorizedChanges {
	creates: { description: string; change: SchemaChange }[];
	drops: { description: string; change: SchemaChange }[];
	alters: { description: string; change: SchemaChange }[];
	renames: { description: string; change: SchemaChange }[];
	hasDestructive: boolean;
}
