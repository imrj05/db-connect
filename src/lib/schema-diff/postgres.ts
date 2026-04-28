import type { ColumnInfo } from "@/types";
import type { DraftColumn, DdlStatement, GenerateResult, SchemaChange } from "./types";

function escId(name: string): string {
	return `"${name.replace(/"/g, '""')}"`;
}

function colDef(col: DraftColumn | ColumnInfo): string {
	const parts: string[] = [escId(col.name)];
	parts.push(col.dataType);
	if (!col.nullable) parts.push("NOT NULL");
	if (col.defaultValue !== null) {
		const dv = col.defaultValue;
		// If it's a literal string like 'hello' or a function like now(), use as-is
		if (dv === "NULL") {
			parts.push("DEFAULT NULL");
		} else if (/^[a-zA-Z_]\w*\s*\(.*\)$/i.test(dv.trim())) {
			parts.push(`DEFAULT ${dv.trim()}`);
		} else if (/^'[^']*'$/.test(dv.trim())) {
			parts.push(`DEFAULT ${dv.trim()}`);
		} else if (/^-?\d+(\.\d+)?$/.test(dv.trim())) {
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

// ── PostgreSQL DDL generator ─────────────────────────────────────────────────

function generatePostgres(ordered: SchemaChange[]): GenerateResult {
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
				const sql = `DROP TABLE IF EXISTS ${escId(change.tableName)} CASCADE;`;
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
				const sql = `ALTER TABLE ${escId(change.tableName)} DROP COLUMN IF EXISTS ${escId(change.columnName)};`;
				statements.push({ sql, destructive: true, description: `Drop column ${change.tableName}.${change.columnName}` });
				hasDestructive = true;
				break;
			}
			case "alterColumn": {
				const col = change.column;
				// PostgreSQL: ALTER TABLE ... ALTER COLUMN ... TYPE / SET NOT NULL / DROP DEFAULT / SET DEFAULT
				const parts: string[] = [];
				parts.push(`ALTER TABLE ${escId(change.tableName)}`);
				if (col.dataType !== change.oldColumn.dataType) {
					parts.push(`ALTER COLUMN ${escId(col.name)} TYPE ${col.dataType}`);
				}
				if (col.nullable !== change.oldColumn.nullable) {
					parts.push(`ALTER COLUMN ${escId(col.name)} ${col.nullable ? "DROP NOT NULL" : "SET NOT NULL"}`);
				}
				if (col.defaultValue !== change.oldColumn.defaultValue) {
					if (col.defaultValue === null) {
						parts.push(`ALTER COLUMN ${escId(col.name)} DROP DEFAULT`);
					} else if (col.defaultValue === "NULL") {
						parts.push(`ALTER COLUMN ${escId(col.name)} SET DEFAULT NULL`);
					} else if (/^[a-zA-Z_]\w*\s*\(.*\)$/i.test(col.defaultValue.trim())) {
						parts.push(`ALTER COLUMN ${escId(col.name)} SET DEFAULT ${col.defaultValue.trim()}`);
					} else if (/^'[^']*'$/.test(col.defaultValue.trim())) {
						parts.push(`ALTER COLUMN ${escId(col.name)} SET DEFAULT ${col.defaultValue.trim()}`);
					} else if (/^-?\d+(\.\d+)?$/.test(col.defaultValue.trim())) {
						parts.push(`ALTER COLUMN ${escId(col.name)} SET DEFAULT ${col.defaultValue.trim()}`);
					} else {
						parts.push(`ALTER COLUMN ${escId(col.name)} SET DEFAULT '${col.defaultValue.replace(/'/g, "''")}'`);
					}
				}
				if (parts.length > 1) {
					statements.push({ sql: parts.join(" ") + ";", destructive: false, description: `Alter column ${change.tableName}.${col.name}` });
				}
				break;
			}
			case "renameColumn": {
				const sql = `ALTER TABLE ${escId(change.tableName)} RENAME COLUMN ${escId(change.oldName)} TO ${escId(change.newColumn.name)};`;
				statements.push({ sql, destructive: false, description: `Rename column ${change.tableName}.${change.oldName} → ${change.newColumn.name}` });
				break;
			}
			case "createIndex": {
				const idx = change.index;
				const unique = idx.unique ? "UNIQUE " : "";
				const using = idx.method ? ` USING ${idx.method}` : "";
				const sql = `CREATE ${unique}INDEX IF NOT EXISTS ${escId(idx.name)} ON ${escId(change.tableName)}${using} (${idx.columns.map(escId).join(", ")});`;
				statements.push({ sql, destructive: false, description: `Create ${idx.unique ? "unique " : ""}index ${idx.name}` });
				break;
			}
			case "dropIndex": {
				const sql = `DROP INDEX IF EXISTS ${escId(change.indexName)};`;
				statements.push({ sql, destructive: false, description: `Drop index ${change.indexName}` });
				break;
			}
			case "addForeignKey": {
				const fk = change.fk;
				const sql = `ALTER TABLE ${escId(change.sourceTableName)} ADD CONSTRAINT ${escId(fk.name)} FOREIGN KEY (${fk.sourceColumns.map(escId).join(", ")}) REFERENCES ${escId(change.targetTableName)} (${fk.targetColumns.map(escId).join(", ")});`;
				statements.push({ sql, destructive: false, description: `Add FK ${fk.name}` });
				break;
			}
			case "dropForeignKey": {
				const sql = `ALTER TABLE ${escId(change.sourceTableName)} DROP CONSTRAINT IF EXISTS ${escId(change.fkName)};`;
				statements.push({ sql, destructive: false, description: `Drop FK ${change.fkName}` });
				break;
			}
			case "rebuildTable": {
				// PostgreSQL doesn't need rebuild - handle as individual alter statements
				// This should never be hit for postgres; the diff engine should emit specific alter/add/drop etc.
				break;
			}
		}
	}

	return { statements, hasDestructive, engine: "postgres", useTransaction: true };
}

export { generatePostgres };
