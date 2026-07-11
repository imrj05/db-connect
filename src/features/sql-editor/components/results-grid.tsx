import { useMemo, useRef, useState } from "react";
import { ShieldAlert, Sparkles } from "lucide-react";
import {
	flexRender,
	getCoreRowModel,
	useReactTable,
	getSortedRowModel,
	SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { QueryResult, TableInfo } from "@/types";
import { StatusBar } from "@/features/workspace/status-bar";
import { ExplainPlanView, isExplainResult } from "@/features/sql-editor/components/explain-plan-view";

function simplifyDataType(type: string): string {
	const t = type.toLowerCase();
	if (t.includes("json")) return "JSON";
	if (t.includes("bool")) return "BOOL";
	if (t.includes("timestamp") || t.includes("datetime")) return "TS";
	if (t.includes("date") || t.includes("time")) return "DATE";
	if (t.includes("int") || t.includes("serial")) return "INT";
	if (t.includes("numeric") || t.includes("decimal") || t.includes("float") || t.includes("double")) return "NUM";
	if (t.includes("char") || t.includes("text") || t.includes("string")) return "TEXT";
	return type.replace(/\(.*\)/, "").toUpperCase().slice(0, 7);
}

function NullPill() {
	return (
		<span className="inline-flex h-[18px] items-center rounded-sm border border-border-subtle bg-surface-1/70 px-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
			NULL
		</span>
	);
}

// Result rows render at a fixed 24px (h-6); the virtualizer relies on this.
const RESULT_ROW_HEIGHT = 24;
// Below this row count, plain rendering is fast and keeps natural
// auto-layout column widths; above it, windowing wins.
const VIRTUALIZE_THRESHOLD = 200;

export function ResultsGrid({
	queryResult,
	tables,
	connectionId,
	onResizeStart,
}: {
	queryResult: QueryResult;
	tables: TableInfo[];
	connectionId: string;
	onResizeStart: (e: React.MouseEvent) => void;
}) {
	const [sorting, setSorting] = useState<SortingState>([]);
	const scrollRef = useRef<HTMLDivElement>(null);

	const isExplain = isExplainResult(queryResult.columns);

	const columns = useMemo(
		() =>
			(queryResult.columns && queryResult.columns.length > 0
				? queryResult.columns
				: queryResult.rows && queryResult.rows.length > 0
					? Object.keys(queryResult.rows[0])
					: []
			).map((col: string) => ({
				accessorKey: col,
				header: col,
				cell: (info: any) => info.getValue() === null ? (
					<NullPill />
				) : (
					<span>
						{typeof info.getValue() === "object"
							? JSON.stringify(info.getValue())
							: String(info.getValue())}
					</span>
				),
			})),
		[queryResult],
	);

	const table = useReactTable({
		data: queryResult.rows,
		columns,
		state: { sorting },
		onSortingChange: setSorting,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
	});

	const rows = table.getRowModel().rows;
	const shouldVirtualize = rows.length > VIRTUALIZE_THRESHOLD;

	const rowVirtualizer = useVirtualizer({
		count: rows.length,
		getScrollElement: () => scrollRef.current,
		estimateSize: () => RESULT_ROW_HEIGHT,
		overscan: 12,
		enabled: shouldVirtualize,
	});

	const virtualItems = shouldVirtualize ? rowVirtualizer.getVirtualItems() : null;
	const paddingTop = virtualItems && virtualItems.length > 0 ? virtualItems[0].start : 0;
	const paddingBottom =
		virtualItems && virtualItems.length > 0
			? rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
			: 0;
	const visibleRows = virtualItems ? virtualItems.map((vi) => rows[vi.index]) : rows;

	return (
		<>
			{/* Drag handle */}
			<div
				onMouseDown={onResizeStart}
				className="h-1.5 bg-border-table hover:bg-primary/40 active:bg-primary/60 cursor-row-resize transition-colors shrink-0 select-none"
				title="Drag to resize"
			/>
			{/* Results grid or explain plan */}
			{queryResult.limitWarning && (
				<div className="flex shrink-0 items-center gap-2 border-t border-warning/25 bg-warning/10 px-3 py-2 text-[12px] text-warning">
					<ShieldAlert size={14} className="shrink-0" />
					<span>{queryResult.limitWarning}</span>
				</div>
			)}
			<div ref={scrollRef} className="flex-1 border-t border-border overflow-auto scrollbar-thin min-h-0">
				{queryResult.rows.length === 0 && queryResult.columns.length === 0 ? (
					<div className="flex flex-col items-center justify-center h-full text-accent-green p-8 text-center">
						<Sparkles size={24} className="mb-3 text-accent-green/40" />
						<p className="text-xs font-bold uppercase tracking-widest">
							Executed successfully · {queryResult.executionTimeMs}ms
						</p>
					</div>
				) : isExplain ? (
					<ExplainPlanView columns={queryResult.columns} rows={queryResult.rows} />
				) : (
					<Table className="w-full text-[12px] font-mono border-collapse">
						<TableHeader className="sticky top-0 z-10 bg-card">
							{table.getHeaderGroups().map((hg) => (
								<TableRow
									key={hg.id}
									className="hover:bg-transparent border-none"
								>
									{hg.headers.map((h) => {
										const colName = String(h.column.columnDef.header);
										const colType = tables
											.flatMap((t) => t.columns ?? [])
											.find(
												(c) =>
													c.name.toLowerCase() ===
													colName.toLowerCase(),
											)
											?.dataType?.toUpperCase();
										const sortDir = h.column.getIsSorted();
										return (
											<TableHead
												key={h.id}
												aria-sort={
													sortDir === "asc"
														? "ascending"
														: sortDir === "desc"
															? "descending"
															: "none"
												}
												className="h-auto p-0 text-left border-r border-border last:border-r-0 hover:bg-muted/30 transition-colors group/th"
											>
												<button
													type="button"
													onClick={h.column.getToggleSortingHandler()}
													className="block w-full cursor-pointer px-3 py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-inset"
												>
													<div className="flex items-center gap-1">
														<span className="font-bold text-muted-foreground text-[11px] uppercase tracking-wider group-hover/th:text-foreground transition-colors">
															{flexRender(
																h.column.columnDef.header,
																h.getContext(),
															)}
														</span>
														{sortDir && (
															<span aria-hidden="true" className="text-accent-blue text-[10px]">
																{sortDir === "asc" ? "↑" : "↓"}
															</span>
														)}
													</div>
													{colType && (
														<div className="mt-1 inline-flex rounded-sm border border-border/60 bg-surface-1/60 px-1 py-0.5 text-[9px] font-mono font-semibold leading-none text-muted-foreground">
															{simplifyDataType(colType)}
														</div>
													)}
												</button>
											</TableHead>
										);
									})}
								</TableRow>
							))}
						</TableHeader>
						<TableBody>
							{paddingTop > 0 && (
								<tr aria-hidden="true">
									<td colSpan={columns.length} style={{ height: paddingTop, padding: 0, border: "none" }} />
								</tr>
							)}
							{visibleRows.map((row) => (
								<TableRow
									key={row.id}
									className={cn(
										"hover:bg-row-hover transition-colors",
										row.index % 2 === 0 ? "bg-table-bg" : "bg-row-alt",
									)}
								>
									{row.getVisibleCells().map((cell) => (
										<TableCell
											key={cell.id}
											className="h-6 px-3 border-r border-border last:border-r-0 text-foreground/90 whitespace-nowrap overflow-hidden text-ellipsis max-w-75"
										>
											{flexRender(
												cell.column.columnDef.cell,
												cell.getContext(),
											)}
										</TableCell>
									))}
								</TableRow>
							))}
							{paddingBottom > 0 && (
								<tr aria-hidden="true">
									<td colSpan={columns.length} style={{ height: paddingBottom, padding: 0, border: "none" }} />
								</tr>
							)}
						</TableBody>
					</Table>
				)}
			</div>
			{/* Status bar */}
			<StatusBar
				connectionId={connectionId}
				executionTimeMs={queryResult.executionTimeMs}
				rowCount={queryResult.rows.length}
			/>
		</>
	);
}
