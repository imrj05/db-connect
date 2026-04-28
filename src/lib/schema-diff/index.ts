import type { ColumnInfo, ForeignKeyRelation, SchemaGraph } from "@/types";
import type {
	CategorizedChanges,
	DraftForeignKey,
	DraftTable,
	SchemaChange,
	SchemaDraft,
} from "./types";
import type { GenerateResult } from "./types";
import { generatePostgres } from "./postgres";
import { generateMysql } from "./mysql";
import { generateSqlite } from "./sqlite";

// ── Helpers ──────────────────────────────────────────────────────────────────

let _idCounter = 0;
function uid(): string {
	return `dc-${Date.now()}-${++_idCounter}-${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeType(t: string): string {
	return t.trim().toLowerCase().replace(/\s+/g, " ");
}

// ── Convert SchemaGraph to SchemaDraft ───────────────────────────────────────

export function graphToDraft(
	graph: SchemaGraph,
	engine: "postgres" | "mysql" | "sqlite",
): SchemaDraft {
	const tableIdMap = new Map<string, string>();
	const tables: DraftTable[] = graph.tables.map((t) => {
		const id = uid();
		tableIdMap.set(t.name, id);
		return {
			id,
			name: t.name,
			schema: t.schema,
			columns: t.columns.map((c) => ({
				id: uid(),
				name: c.name,
				dataType: c.dataType,
				nullable: c.nullable,
				isPrimary: c.isPrimary,
				defaultValue: c.defaultValue,
			})),
			indexes: [],
			isNew: false,
		};
	});

	const foreignKeys: DraftForeignKey[] = graph.relationships.map((r) => ({
		id: uid(),
		name: r.name,
		sourceTableId: tableIdMap.get(r.sourceTable) ?? "",
		sourceColumns: r.sourceColumns,
		targetTableId: tableIdMap.get(r.targetTable) ?? "",
		targetColumns: r.targetColumns,
	}));

	return { tables, foreignKeys, engine };
}

// ── Diff draft vs original graph → ordered Change[] ─────────────────────────

export function diffDraft(
	draft: SchemaDraft,
	original: SchemaGraph,
): SchemaChange[] {
	const changes: SchemaChange[] = [];

	// Build lookup maps
	const origTableMap = new Map<string, typeof original.tables[number]>();
	for (const t of original.tables) origTableMap.set(t.name, t);

	const origFkSet = new Set<string>();
	for (const r of original.relationships) origFkSet.add(r.name);

	const draftTableMap = new Map<string, DraftTable>();
	for (const t of draft.tables) draftTableMap.set(t.name, t);

	// Detect table changes
	const draftTableNames = new Set(draft.tables.map((t) => t.name));
	const origTableNames = new Set(original.tables.map((t) => t.name));

	const processedTables = new Set<string>();
	const droppedTables: SchemaChange[] = [];
	const renamedTables: SchemaChange[] = [];
	const createdTables: SchemaChange[] = [];

	// Dropped tables
	for (const origName of origTableNames) {
		if (!draftTableNames.has(origName)) {
			droppedTables.push({
				type: "dropTable",
				tableName: origName,
				schema: original.tables.find((t) => t.name === origName)?.schema,
			});
		}
	}

	// Renamed tables (detect via previousName)
	for (const t of draft.tables) {
		if (t.previousName && t.previousName !== t.name && origTableMap.has(t.previousName)) {
			renamedTables.push({
				type: "renameTable",
				oldName: t.previousName,
				newName: t.name,
				schema: t.schema,
				table: t,
			});
			processedTables.add(t.previousName);
		}
	}

	// Created tables
	for (const t of draft.tables) {
		if (t.isNew && !t.previousName) {
			createdTables.push({ type: "createTable", table: t });
		}
	}

	// For existing tables, diff columns and indexes
	for (const t of draft.tables) {
		if (t.isNew && !t.previousName) continue; // handled above

		const effectiveName = t.previousName ?? t.name;
		const origT = origTableMap.get(effectiveName);
		if (!origT) continue; // should not happen
		processedTables.add(effectiveName);

		const origColMap = new Map<string, ColumnInfo>();
		for (const c of origT.columns) origColMap.set(c.name, c);
		const draftColMap = new Map<string, typeof t.columns[number]>();
		for (const c of t.columns) draftColMap.set(c.name, c);

		// Detect dropped columns
		for (const origCol of origT.columns) {
			if (!draftColMap.has(origCol.name)) {
				changes.push({
					type: "dropColumn",
					tableName: t.name,
					schema: t.schema,
					columnName: origCol.name,
				});
			}
		}

		// Detect added columns
		for (const col of t.columns) {
			if (!origColMap.has(col.name)) {
				changes.push({
					type: "addColumn",
					tableName: t.name,
					schema: t.schema,
					column: col,
				});
			}
		}

		// Detect renamed columns
		for (const col of t.columns) {
			if (col.previousName && col.previousName !== col.name && origColMap.has(col.previousName)) {
				changes.push({
					type: "renameColumn",
					tableName: t.name,
					schema: t.schema,
					oldName: col.previousName,
					newColumn: col,
				});
			}
		}

		// Detect altered columns
		for (const col of t.columns) {
			const effectiveColName = col.previousName ?? col.name;
			const origCol = origColMap.get(effectiveColName);
			if (!origCol) continue;
			if (col.previousName && col.previousName !== col.name) continue; // handled as rename

			const typeChanged = normalizeType(col.dataType) !== normalizeType(origCol.dataType);
			const nullableChanged = col.nullable !== origCol.nullable;
			const defaultChanged = col.defaultValue !== origCol.defaultValue;

			if (typeChanged || nullableChanged || defaultChanged) {
				changes.push({
					type: "alterColumn",
					tableName: t.name,
					schema: t.schema,
					column: col,
					oldColumn: origCol,
				});
			}
		}
	}

	// Detect FK changes
	const draftFkNames = new Set(draft.foreignKeys.map((fk) => fk.name));
	const origFkMap = new Map<string, ForeignKeyRelation>();
	for (const r of original.relationships) origFkMap.set(r.name, r);

	// Dropped FKs
	for (const r of original.relationships) {
		if (!draftFkNames.has(r.name)) {
			changes.push({
				type: "dropForeignKey",
				fkName: r.name,
				sourceTableName: r.sourceTable,
			});
		}
	}

	// Added FKs
	for (const fk of draft.foreignKeys) {
		if (!origFkMap.has(fk.name)) {
			const srcTable = draftTableMap.get(
				[...draftTableMap.entries()].find(([, v]) => v.id === fk.sourceTableId)?.[0] ?? "",
			);
			const tgtTable = draftTableMap.get(
				[...draftTableMap.entries()].find(([, v]) => v.id === fk.targetTableId)?.[0] ?? "",
			);
			if (srcTable && tgtTable) {
				changes.push({
					type: "addForeignKey",
					fk,
					sourceTableName: srcTable.name,
					targetTableName: tgtTable.name,
				});
			}
		}
	}

	// Detect index changes
	for (const t of draft.tables) {
		if (t.isNew && !t.previousName) continue; // indexes created with table
		const effectiveName = t.previousName ?? t.name;
		const origT = origTableMap.get(effectiveName);
		if (!origT) continue;

		// We don't have original indexes in SchemaGraph, so we only handle
		// explicitly added indexes in the draft
		for (const idx of t.indexes) {
			changes.push({
				type: "createIndex",
				tableName: t.name,
				schema: t.schema,
				index: idx,
			});
		}
	}

	// Order changes correctly:
	// drop FKs → drop indexes → drop columns → drop tables → rename tables → create tables → add columns → alter columns → rename columns → add indexes → add FKs
	const ordered: SchemaChange[] = [];

	// 1. Drop FKs
	for (const c of changes) { if (c.type === "dropForeignKey") ordered.push(c); }
	// 2. Drop indexes
	for (const c of changes) { if (c.type === "dropIndex") ordered.push(c); }
	// 3. Drop columns
	for (const c of changes) { if (c.type === "dropColumn") ordered.push(c); }
	// 4. Drop tables
	for (const c of droppedTables) ordered.push(c);
	// 5. Rename tables
	for (const c of renamedTables) ordered.push(c);
	// 6. Create tables
	for (const c of createdTables) ordered.push(c);
	// 7. Add columns
	for (const c of changes) { if (c.type === "addColumn") ordered.push(c); }
	// 8. Rename columns
	for (const c of changes) { if (c.type === "renameColumn") ordered.push(c); }
	// 9. Alter columns
	for (const c of changes) { if (c.type === "alterColumn") ordered.push(c); }
	// 10. Rebuild tables (SQLite only)
	for (const c of changes) { if (c.type === "rebuildTable") ordered.push(c); }
	// 11. Create indexes
	for (const c of changes) { if (c.type === "createIndex") ordered.push(c); }
	// 12. Add FKs
	for (const c of changes) { if (c.type === "addForeignKey") ordered.push(c); }

	return ordered;
}

// ── Generate DDL ─────────────────────────────────────────────────────────────

export function generateDdl(
	ordered: SchemaChange[],
	engine: "postgres" | "mysql" | "sqlite",
): GenerateResult {
	switch (engine) {
		case "postgres":
			return generatePostgres(ordered);
		case "mysql":
			return generateMysql(ordered);
		case "sqlite":
			return generateSqlite(ordered);
		default:
			return { statements: [], hasDestructive: false, engine, useTransaction: true };
	}
}

// ── Categorize changes for display ──────────────────────────────────────────

export function categorizeChanges(changes: SchemaChange[]): CategorizedChanges {
	const result: CategorizedChanges = {
		creates: [],
		drops: [],
		alters: [],
		renames: [],
		hasDestructive: false,
	};

	for (const change of changes) {
		switch (change.type) {
			case "createTable":
				result.creates.push({ description: `Create table ${change.table.name}`, change });
				break;
			case "dropTable":
				result.drops.push({ description: `Drop table ${change.tableName}`, change });
				result.hasDestructive = true;
				break;
			case "renameTable":
				result.renames.push({ description: `Rename table ${change.oldName} → ${change.newName}`, change });
				break;
			case "addColumn":
				result.creates.push({ description: `Add column ${change.tableName}.${change.column.name}`, change });
				break;
			case "dropColumn":
				result.drops.push({ description: `Drop column ${change.tableName}.${change.columnName}`, change });
				result.hasDestructive = true;
				break;
			case "alterColumn":
				result.alters.push({ description: `Alter column ${change.tableName}.${change.column.name}`, change });
				break;
			case "renameColumn":
				result.renames.push({ description: `Rename column ${change.tableName}.${change.oldName} → ${change.newColumn.name}`, change });
				break;
			case "createIndex":
				result.creates.push({ description: `Create index ${change.index.name}`, change });
				break;
			case "dropIndex":
				result.drops.push({ description: `Drop index ${change.indexName}`, change });
				break;
			case "addForeignKey":
				result.creates.push({ description: `Add FK ${change.fk.name}`, change });
				break;
			case "dropForeignKey":
				result.drops.push({ description: `Drop FK ${change.fkName}`, change });
				break;
			case "rebuildTable":
				result.alters.push({ description: `Rebuild table ${change.tableName}`, change });
				result.hasDestructive = true;
				break;
		}
	}

	return result;
}
