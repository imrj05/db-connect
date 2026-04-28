import type { ColumnInfo } from "@/types";
import type { DraftColumn, DdlStatement, GenerateResult, SchemaChange } from "./types";

function escId(name: string): string {
	return `"${name.replace(/"/g, '""')}"`;
}

function colDef(col: DraftColumn | ColumnInfo): string {
	const parts: string[] = [escId(col.name), col.dataType];
	if (!col.nullable) parts.push("NOT NULL");
	if (col.defaultValue !== null) {
		const dv = col.defaultValue;
		if (dv === "NULL") {
			parts.push("DEFAULT NULL");
		} else if (/^[a-zA-Z_]\w*\s*\(.*\)$/i.test(dv.trim())) {
			parts.push(`DEFAULT ${dv.trim()}`);
		} else if (/^'[^']*'$/.test(dv.trim())) {
			parts.push(`DEFAULT ${dv.trim()}`);
		} else if (/^-?\d+(\.\d+)?$/.test(dv.trim())) {
			parts.push(`DEFAULT ${dv.trim()}`);
		} else if (/^CURRENT_TIMESTAMP/i.test(dv.trim())) {
			parts.push(`DEFAULT ${dv.trim()}`);
		} else {
			parts.push(`DEFAULT '${dv.replace(/'/g, "''")}'`);
		}
	}
	return parts.join(" ");
}

function pkConstraint(columns: DraftColumn[]): string {
	const pks = columns.filter((c) => c.isPrimary);
	if (pks.length === 0) return "";
	return `, PRIMARY KEY (${pks.map((c) => escId(c.name)).join(", ")})`;
}

// ── SQLite DDL generator with the standard 12-step rebuild dance ─────────────

/**
 * SQLite ALTER TABLE is limited. For column renames, type changes, or FK changes,
 * we use the standard rebuild pattern:
 * 1. Disable FK checks (if any)
 * 2. CREATE TABLE _new (...)
 * 3. INSERT INTO _new SELECT ... FROM old
 * 4. DROP old
 * 5. ALTER _new RENAME TO old
 * 6. Recreate indexes
 * 7. Re-enable FK checks
 */

function generateSqlite(ordered: SchemaChange[]): GenerateResult {
	const statements: DdlStatement[] = [];
	let hasDestructive = false;

	for (const change of ordered) {
		switch (change.type) {
			case "createTable": {
				const t = change.table;
				const colParts = t.columns.map(colDef);
				const pk = pkConstraint(t.columns);
				const sql = `CREATE TABLE ${escId(t.name)} (\n  ${colParts.join(",\n  ")}${pk}\n);`;
				statements.push({ sql, destructive: false, description: `Create table ${t.name}` });
				break;
			}
			case "dropTable": {
				const sql = `DROP TABLE IF EXISTS ${escId(change.tableName)};`;
				statements.push({ sql, destructive: true, description: `Drop table ${change.tableName}` });
				hasDestructive = true;
				break;
			}
			case "renameTable": {
				const sql = `ALTER TABLE ${escId(change.oldName)} RENAME TO ${escId(change.newName)};`;
				statements.push({ sql, destructive: false, description: `Rename table ${change.oldName} → ${change.newName}` });
				break;
			}
			case "addColumn": {
				const col = change.column;
				const sql = `ALTER TABLE ${escId(change.tableName)} ADD COLUMN ${colDef(col)};`;
				statements.push({ sql, destructive: false, description: `Add column ${change.tableName}.${col.name}` });
				break;
			}
			case "dropColumn": {
				// SQLite 3.35+ supports DROP COLUMN
				const sql = `ALTER TABLE ${escId(change.tableName)} DROP COLUMN ${escId(change.columnName)};`;
				statements.push({ sql, destructive: true, description: `Drop column ${change.tableName}.${change.columnName}` });
				hasDestructive = true;
				break;
			}
			case "renameColumn": {
				// SQLite 3.25+ supports RENAME COLUMN
				const sql = `ALTER TABLE ${escId(change.tableName)} RENAME COLUMN ${escId(change.oldName)} TO ${escId(change.newColumn.name)};`;
				statements.push({ sql, destructive: false, description: `Rename column ${change.tableName}.${change.oldName} → ${change.newColumn.name}` });
				break;
			}
			case "alterColumn": {
				// SQLite does NOT support ALTER COLUMN TYPE/SET NOT NULL/DROP DEFAULT directly.
				// This should be handled as a rebuild. If we get here, it's an edge case.
				// Emit a rebuild instead.
				break;
			}
			case "createIndex": {
				const idx = change.index;
				const unique = idx.unique ? "UNIQUE " : "";
				const sql = `CREATE ${unique}INDEX IF NOT EXISTS ${escId(idx.name)} ON ${escId(change.tableName)} (${idx.columns.map(escId).join(", ")});`;
				statements.push({ sql, destructive: false, description: `Create ${idx.unique ? "unique " : ""}index ${idx.name}` });
				break;
			}
			case "dropIndex": {
				const sql = `DROP INDEX IF EXISTS ${escId(change.indexName)};`;
				statements.push({ sql, destructive: false, description: `Drop index ${change.indexName}` });
				break;
			}
			case "addForeignKey": {
				// SQLite doesn't support ALTER TABLE ADD CONSTRAINT for FKs.
				// Must be handled via rebuild.
				break;
			}
			case "dropForeignKey": {
				// SQLite doesn't support ALTER TABLE DROP CONSTRAINT.
				// Must be handled via rebuild.
				break;
			}
			case "rebuildTable": {
				const t = change.table;
				const oldTbl = change.tableName;
				const newTmp = `_dbconnect_new_${oldTbl}`;

				const stmts: string[] = [];
				// 1. Disable FK checks
				stmts.push("PRAGMA foreign_keys = OFF;");

				// 2. Create new table
				const colParts = t.columns.map(colDef);
				const pk = pkConstraint(t.columns);
				stmts.push(`CREATE TABLE ${escId(newTmp)} (\n  ${colParts.join(",\n  ")}${pk}\n);`);

				// 3. Copy data - map old columns to new columns
				const oldCols = change.oldColumns;
				const newCols = t.columns;
				const oldColNames = new Set(oldCols.map((c) => c.name));
				const mappedCols = newCols.filter((nc) => oldColNames.has(nc.name));
				if (mappedCols.length > 0) {
					stmts.push(`INSERT INTO ${escId(newTmp)} (${mappedCols.map((c) => escId(c.name)).join(", ")}) SELECT ${mappedCols.map((c) => escId(c.name)).join(", ")} FROM ${escId(oldTbl)};`);
				}

				// 4. Drop old table
				stmts.push(`DROP TABLE ${escId(oldTbl)};`);

				// 5. Rename new table to old name
				stmts.push(`ALTER TABLE ${escId(newTmp)} RENAME TO ${escId(oldTbl)};`);

				// 6. Recreate indexes
				for (const idx of t.indexes) {
					const unique = idx.unique ? "UNIQUE " : "";
					stmts.push(`CREATE ${unique}INDEX IF NOT EXISTS ${escId(idx.name)} ON ${escId(oldTbl)} (${idx.columns.map(escId).join(", ")});`);
				}

				// 7. Re-enable FK checks
				stmts.push("PRAGMA foreign_keys = ON;");

				const sql = stmts.join("\n");
				statements.push({ sql, destructive: true, description: `Rebuild table ${oldTbl} (schema change)` });
				hasDestructive = true;
				break;
			}
		}
	}

	return { statements, hasDestructive, engine: "sqlite", useTransaction: true };
}

export { generateSqlite };
