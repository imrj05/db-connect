import { useMemo } from "react";
import { AlertTriangle, ChevronRight, Table2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Detects whether a query result looks like an EXPLAIN plan.
 */
export function isExplainResult(columns: string[]): boolean {
	if (!columns || columns.length === 0) return false;
	const lower = columns.map((c) => c.toLowerCase());
	// PostgreSQL text EXPLAIN: single column "QUERY PLAN"
	if (lower.includes("query plan")) return true;
	// MySQL/MariaDB EXPLAIN: id, select_type, table, type, ...
	if (lower.includes("select_type") && lower.includes("table")) return true;
	// SQLite EXPLAIN QUERY PLAN: id, parent, notused, detail
	if (lower.includes("detail") && lower.includes("parent")) return true;
	return false;
}

/** ── PostgreSQL text plan renderer ───────────────────────────────────── */
function PgTextPlan({ rows }: { rows: Record<string, unknown>[] }) {
	const lines = rows
		.map((r) => String(Object.values(r)[0] ?? ""))
		.filter(Boolean);

	return (
		<div className="p-4 font-mono text-[11px] space-y-px">
			{lines.map((line, i) => {
				const isNode = /->/.test(line);
				const isWarning = /Warning|never executed/i.test(line);
				const indent = line.match(/^\s*/)?.[0].length ?? 0;

				// Extract cost info for highlight
				const seqScan = /Seq Scan/i.test(line);
				const indexScan = /Index Scan|Index Only/i.test(line);

				return (
					<div
						key={i}
						className={cn(
							"flex items-start gap-1 whitespace-pre py-0.5 rounded px-1",
							isWarning && "bg-destructive/10 text-destructive",
							seqScan && "bg-amber-500/6",
						)}
						style={{ paddingLeft: indent + 4 }}
					>
						{isNode && (
							<ChevronRight size={10} className="mt-0.5 shrink-0 text-accent-blue/60" />
						)}
						<span
							className={cn(
								"break-all",
								indexScan && "text-accent-green/90",
								seqScan && "text-amber-600 dark:text-amber-400",
								isWarning && "font-semibold",
							)}
						>
							{line.trimStart()}
						</span>
						{seqScan && (
							<span className="ml-auto shrink-0 rounded-[3px] border border-amber-400/30 bg-amber-400/10 px-1 py-px text-[8px] font-bold text-amber-600 dark:text-amber-400 leading-none">
								SEQ SCAN
							</span>
						)}
						{indexScan && (
							<span className="ml-auto shrink-0 rounded-[3px] border border-accent-green/30 bg-accent-green/10 px-1 py-px text-[8px] font-bold text-accent-green leading-none">
								INDEX
							</span>
						)}
					</div>
				);
			})}
		</div>
	);
}

/** ── MySQL/MariaDB explain table renderer ───────────────────────────── */
function MySQLExplainTable({
	columns,
	rows,
}: {
	columns: string[];
	rows: Record<string, unknown>[];
}) {
	const keyColumns = ["id", "select_type", "table", "type", "key", "rows", "Extra"];
	const visibleCols = keyColumns.filter((c) =>
		columns.some((col) => col.toLowerCase() === c.toLowerCase()),
	);
	const getCell = (row: Record<string, unknown>, col: string) => {
		const key = Object.keys(row).find((k) => k.toLowerCase() === col.toLowerCase());
		return key ? row[key] : undefined;
	};
	const typeColor = (t: unknown) => {
		const s = String(t ?? "").toUpperCase();
		if (s === "ALL" || s === "FULLTEXT") return "text-destructive font-bold";
		if (s === "INDEX") return "text-amber-600 dark:text-amber-400 font-semibold";
		if (s.startsWith("REF") || s === "EQ_REF") return "text-accent-blue";
		if (s === "CONST" || s === "SYSTEM") return "text-accent-green font-semibold";
		return "";
	};

	return (
		<div className="overflow-auto p-4">
			<table className="text-[11px] font-mono border-collapse w-full">
				<thead>
					<tr>
						{visibleCols.map((c) => (
							<th
								key={c}
								className="px-3 py-1.5 border border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground/60 bg-muted/40 font-semibold"
							>
								{c}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((row, i) => (
						<tr key={i} className="hover:bg-muted/20">
							{visibleCols.map((col) => {
								const val = getCell(row, col);
								const isEmpty = val === null || val === undefined || val === "";
								return (
									<td
										key={col}
										className={cn(
											"px-3 py-1.5 border border-border/50",
											col.toLowerCase() === "type" && typeColor(val),
											col.toLowerCase() === "extra" && String(val ?? "").toLowerCase().includes("using filesort")
												? "text-amber-600 dark:text-amber-400"
												: "",
											isEmpty && "text-muted-foreground/30 italic",
										)}
									>
										{isEmpty ? "NULL" : String(val)}
									</td>
								);
							})}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

/** ── SQLite EXPLAIN QUERY PLAN renderer ─────────────────────────────── */
function SQLiteExplainTable({
	columns,
	rows,
}: {
	columns: string[];
	rows: Record<string, unknown>[];
}) {
	const detailCol = columns.find((c) => c.toLowerCase() === "detail") ?? columns[columns.length - 1];

	return (
		<div className="p-4 font-mono text-[11px] space-y-1">
			{rows.map((row, i) => {
				const detail = String(row[detailCol] ?? "");
				const isScan = /SCAN TABLE/i.test(detail);
				const isSearch = /SEARCH TABLE/i.test(detail);
				const isIndex = /USING INDEX/i.test(detail);

				return (
					<div
						key={i}
						className={cn(
							"flex items-start gap-2 px-3 py-1.5 rounded-md",
							isScan && !isIndex && "bg-amber-400/8 border border-amber-400/20",
							isSearch && "bg-accent-green/8 border border-accent-green/20",
						)}
					>
						<span className="text-muted-foreground/40 shrink-0 tabular-nums w-4">
							{i + 1}
						</span>
						<span
							className={cn(
								"flex-1",
								isScan && !isIndex && "text-amber-600 dark:text-amber-400",
								isIndex && "text-accent-green/90",
							)}
						>
							{detail}
						</span>
						{isScan && !isIndex && (
							<span className="shrink-0 rounded-[3px] border border-amber-400/30 bg-amber-400/10 px-1 py-px text-[8px] font-bold text-amber-600 dark:text-amber-400 leading-none">
								FULL SCAN
							</span>
						)}
						{isIndex && (
							<span className="shrink-0 rounded-[3px] border border-accent-green/30 bg-accent-green/10 px-1 py-px text-[8px] font-bold text-accent-green leading-none">
								INDEX
							</span>
						)}
					</div>
				);
			})}
		</div>
	);
}

/** ── Main ExplainPlanView component ─────────────────────────────────── */
export function ExplainPlanView({
	columns,
	rows,
}: {
	columns: string[];
	rows: Record<string, unknown>[];
}) {
	const planType = useMemo(() => {
		const lower = columns.map((c) => c.toLowerCase());
		if (lower.includes("query plan")) return "pg-text";
		if (lower.includes("select_type")) return "mysql";
		if (lower.includes("detail") && lower.includes("parent")) return "sqlite";
		return "generic";
	}, [columns]);

	const seqScanCount = useMemo(() => {
		if (planType === "pg-text") {
			return rows.filter((r) => /Seq Scan/i.test(String(Object.values(r)[0] ?? ""))).length;
		}
		if (planType === "mysql") {
			return rows.filter((r) => {
				const type = Object.entries(r).find(([k]) => k.toLowerCase() === "type")?.[1];
				return String(type ?? "").toUpperCase() === "ALL";
			}).length;
		}
		if (planType === "sqlite") {
			const detailCol = columns.find((c) => c.toLowerCase() === "detail") ?? columns[columns.length - 1];
			return rows.filter((r) => /SCAN TABLE/i.test(String(r[detailCol] ?? "")) && !/USING INDEX/i.test(String(r[detailCol] ?? ""))).length;
		}
		return 0;
	}, [planType, rows, columns]);

	return (
		<div className="flex flex-col h-full overflow-hidden">
			{/* Header */}
			<div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/30">
				<Zap size={12} className="text-accent-blue/70" />
				<span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60">
					Query Plan
				</span>
				{seqScanCount > 0 && (
					<span className="flex items-center gap-1 rounded-[4px] border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400 leading-none ml-auto">
						<AlertTriangle size={9} />
						{seqScanCount} full scan{seqScanCount > 1 ? "s" : ""}
					</span>
				)}
				{seqScanCount === 0 && (
					<span className="flex items-center gap-1 rounded-[4px] border border-accent-green/30 bg-accent-green/10 px-1.5 py-0.5 text-[9px] font-bold text-accent-green leading-none ml-auto">
						<Table2 size={9} />
						No full scans
					</span>
				)}
			</div>
			<div className="flex-1 overflow-auto scrollbar-thin">
				{planType === "pg-text" && <PgTextPlan rows={rows} />}
				{planType === "mysql" && <MySQLExplainTable columns={columns} rows={rows} />}
				{planType === "sqlite" && <SQLiteExplainTable columns={columns} rows={rows} />}
				{planType === "generic" && (
					<div className="p-4 font-mono text-[11px] text-muted-foreground/60">
						{rows.map((r, i) => (
							<div key={i} className="py-0.5">
								{Object.entries(r)
									.map(([k, v]) => `${k}: ${v}`)
									.join(" | ")}
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
