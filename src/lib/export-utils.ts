/**
 * Export utilities for query results and table data.
 */

export type ExportPreset = "csv" | "json" | "sql-inserts" | "markdown" | "tsv" | "clipboard-tsv";

/**
 * Convert rows + columns to CSV string.
 */
export function toCSV(columns: string[], rows: Record<string, unknown>[]): string {
	const escape = (v: unknown): string => {
		if (v === null || v === undefined) return "";
		const s = typeof v === "object" ? JSON.stringify(v) : String(v);
		if (s.includes(",") || s.includes('"') || s.includes("\n")) {
			return `"${s.replace(/"/g, '""')}"`;
		}
		return s;
	};
	const header = columns.map(escape).join(",");
	const body = rows.map((row) => columns.map((c) => escape(row[c])).join(",")).join("\n");
	return `${header}\n${body}`;
}

/**
 * Convert rows + columns to TSV string (for clipboard).
 */
export function toTSV(columns: string[], rows: Record<string, unknown>[]): string {
	const escape = (v: unknown): string => {
		if (v === null || v === undefined) return "";
		return typeof v === "object" ? JSON.stringify(v) : String(v).replace(/\t/g, " ");
	};
	const header = columns.join("\t");
	const body = rows.map((row) => columns.map((c) => escape(row[c])).join("\t")).join("\n");
	return `${header}\n${body}`;
}

/**
 * Convert rows to a pretty JSON array string.
 */
export function toJSON(rows: Record<string, unknown>[]): string {
	return JSON.stringify(rows, null, 2);
}

/**
 * Generate SQL INSERT statements.
 */
export function toSQLInserts(tableName: string, columns: string[], rows: Record<string, unknown>[]): string {
	if (rows.length === 0) return `-- No rows to export`;
	const cols = columns.map((c) => `\`${c}\``).join(", ");
	const valueRow = (row: Record<string, unknown>): string => {
		const vals = columns.map((c) => {
			const v = row[c];
			if (v === null || v === undefined) return "NULL";
			if (typeof v === "number" || typeof v === "boolean") return String(v);
			if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
			return `'${String(v).replace(/'/g, "''")}'`;
		});
		return `(${vals.join(", ")})`;
	};
	const values = rows.map(valueRow).join(",\n  ");
	return `INSERT INTO \`${tableName}\` (${cols})\nVALUES\n  ${values};`;
}

/**
 * Convert rows + columns to a GitHub-flavored Markdown table.
 */
export function toMarkdown(columns: string[], rows: Record<string, unknown>[]): string {
	const cell = (v: unknown): string => {
		if (v === null || v === undefined) return "";
		const s = typeof v === "object" ? JSON.stringify(v) : String(v);
		return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
	};
	const header = `| ${columns.join(" | ")} |`;
	const divider = `| ${columns.map(() => "---").join(" | ")} |`;
	const body = rows.map((row) => `| ${columns.map((c) => cell(row[c])).join(" | ")} |`).join("\n");
	return `${header}\n${divider}\n${body}`;
}

/**
 * Trigger a browser file download.
 */
export function downloadText(content: string, filename: string, mimeType: string): void {
	const blob = new Blob([content], { type: mimeType });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

/**
 * Copy text to clipboard.
 */
export async function copyToClipboardText(text: string): Promise<void> {
	await navigator.clipboard.writeText(text);
}

/**
 * Run an export preset given result data.
 */
export async function runExport(
	preset: ExportPreset,
	columns: string[],
	rows: Record<string, unknown>[],
	tableName: string = "export",
): Promise<void> {
	switch (preset) {
		case "csv":
			downloadText(toCSV(columns, rows), `${tableName}.csv`, "text/csv");
			break;
		case "tsv":
			downloadText(toTSV(columns, rows), `${tableName}.tsv`, "text/tab-separated-values");
			break;
		case "json":
			downloadText(toJSON(rows), `${tableName}.json`, "application/json");
			break;
		case "sql-inserts":
			downloadText(toSQLInserts(tableName, columns, rows), `${tableName}_inserts.sql`, "text/plain");
			break;
		case "markdown":
			downloadText(toMarkdown(columns, rows), `${tableName}.md`, "text/markdown");
			break;
		case "clipboard-tsv":
			await copyToClipboardText(toTSV(columns, rows));
			break;
	}
}
