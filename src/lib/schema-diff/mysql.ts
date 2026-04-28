import type { ColumnInfo } from "@/types";
import type { DraftColumn, DdlStatement, GenerateResult, SchemaChange } from "./types";

function escId(name: string): string {
	return `\`${name.replace(/`/g, "``")}\``;
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
	if ((col as DraftColumn).isPrimary !== undefined && (col as DraftColumn).isPrimary) {
		// PK handled in primary key clause
	}
	// AUTO_INCREMENT
	const extra = (col as ColumnInfo).extra;
	if (extra && extra.toLowerCase().includes("auto_increment")) {
		parts.push("AUTO_INCREMENT");
	}
	return parts.join(" ");
}

function pkConstraint(columns: DraftColumn[]): string {
	const pks = columns.filter((c) => c.isPrimary);
	if (pks.length === 0) return "";
	return `, PRIMARY KEY (${pks.map((c) => escId(c.name)).join(", ")})`;
}

// ── MySQL DDL generator ──────────────────────────────────────────────────────

function generateMysql(ordered: SchemaChange[]): GenerateResult {
	const statements: DdlStatement[] = [];
	let hasDestructive = false;

	for (const change of ordered) {
		switch (change.type) {
			case "createTable": {
				const t = change.table;
				const colParts = t.columns.map(colDef);
				const pk = pkConstraint(t.columns);
				const sql = `CREATE TABLE ${escId(t.name)} (\n  ${colParts.join(",\n  ")}${pk}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;
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
				const sql = `RENAME TABLE ${escId(change.oldName)} TO ${escId(change.newName)};`;
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
				const sql = `ALTER TABLE ${escId(change.tableName)} DROP COLUMN ${escId(change.columnName)};`;
				statements.push({ sql, destructive: true, description: `Drop column ${change.tableName}.${change.columnName}` });
				hasDestructive = true;
				break;
			}
			case "alterColumn": {
				const col = change.column;
				const old = change.oldColumn;
				const parts: string[] = [];
				parts.push(`ALTER TABLE ${escId(change.tableName)}`);
				// MySQL: MODIFY COLUMN for type/nullable/default changes
				if (col.dataType !== old.dataType || col.nullable !== old.nullable || col.defaultValue !== old.defaultValue) {
					const def: string[] = [col.dataType];
					if (!col.nullable) def.push("NOT NULL");
					if (col.defaultValue !== null) {
						const dv = col.defaultValue;
						if (dv === "NULL") {
							def.push("DEFAULT NULL");
						} else if (/^[a-zA-Z_]\w*\s*\(.*\)$/i.test(dv.trim())) {
							def.push(`DEFAULT ${dv.trim()}`);
						} else if (/^'[^']*'$/.test(dv.trim())) {
							def.push(`DEFAULT ${dv.trim()}`);
						} else if (/^-?\d+(\.\d+)?$/.test(dv.trim())) {
							def.push(`DEFAULT ${dv.trim()}`);
						} else if (/^CURRENT_TIMESTAMP/i.test(dv.trim())) {
							def.push(`DEFAULT ${dv.trim()}`);
						} else {
							def.push(`DEFAULT '${dv.replace(/'/g, "''")}'`);
						}
					}
					parts.push(`MODIFY COLUMN ${escId(col.name)} ${def.join(" ")}`);
				}
				if (parts.length > 1) {
					statements.push({ sql: parts.join(" ") + ";", destructive: false, description: `Alter column ${change.tableName}.${col.name}` });
				}
				break;
			}
			case "renameColumn": {
				const col = change.newColumn;
				const def: string[] = [col.dataType];
				if (!col.nullable) def.push("NOT NULL");
				if (col.defaultValue !== null) {
					const dv = col.defaultValue;
					if (dv === "NULL") {
						def.push("DEFAULT NULL");
					} else if (/^[a-zA-Z_]\w*\s*\(.*\)$/i.test(dv.trim())) {
						def.push(`DEFAULT ${dv.trim()}`);
					} else if (/^'[^']*'$/.test(dv.trim())) {
						def.push(`DEFAULT ${dv.trim()}`);
					} else if (/^-?\d+(\.\d+)?$/.test(dv.trim())) {
						def.push(`DEFAULT ${dv.trim()}`);
					} else {
						def.push(`DEFAULT '${dv.replace(/'/g, "''")}'`);
					}
				}
				const sql = `ALTER TABLE ${escId(change.tableName)} CHANGE COLUMN ${escId(change.oldName)} ${escId(col.name)} ${def.join(" ")};`;
				statements.push({ sql, destructive: false, description: `Rename column ${change.tableName}.${change.oldName} → ${col.name}` });
				break;
			}
			case "createIndex": {
				const idx = change.index;
				const unique = idx.unique ? "UNIQUE " : "";
				const using = idx.method ? ` USING ${idx.method}` : "";
				const sql = `CREATE ${unique}INDEX ${escId(idx.name)} ON ${escId(change.tableName)}${using} (${idx.columns.map(escId).join(", ")});`;
				statements.push({ sql, destructive: false, description: `Create ${idx.unique ? "unique " : ""}index ${idx.name}` });
				break;
			}
			case "dropIndex": {
				const sql = `DROP INDEX ${escId(change.indexName)} ON ${escId(change.tableName)};`;
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
				const sql = `ALTER TABLE ${escId(change.sourceTableName)} DROP FOREIGN KEY ${escId(change.fkName)};`;
				statements.push({ sql, destructive: false, description: `Drop FK ${change.fkName}` });
				break;
			}
			case "rebuildTable": {
				// MySQL doesn't need rebuild - handle as individual alters
				break;
			}
		}
	}

	// MySQL DDL auto-commits - no transaction
	return { statements, hasDestructive, engine: "mysql", useTransaction: false };
}

export { generateMysql };
