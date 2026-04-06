import { useState } from "react";
import { Sparkles } from "lucide-react";
import {
	flexRender,
	getCoreRowModel,
	useReactTable,
	getSortedRowModel,
	SortingState,
} from "@tanstack/react-table";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { TableInfo } from "@/types";
import { StatusBar } from "@/components/layout/function-output/StatusBar";

export function ResultsGrid({
	queryResult,
	tables,
	connectionId,
	onResizeStart,
}: {
	queryResult: { columns: string[]; rows: any[]; executionTimeMs: number };
	tables: TableInfo[];
	connectionId: string;
	onResizeStart: (e: React.MouseEvent) => void;
}) {
	const [sorting, setSorting] = useState<SortingState>([]);
	const table = useReactTable({
		data: queryResult.rows,
		columns: (queryResult.columns && queryResult.columns.length > 0
			? queryResult.columns
			: queryResult.rows && queryResult.rows.length > 0
				? Object.keys(queryResult.rows[0])
				: []
		).map((col: string) => ({
			accessorKey: col,
			header: col,
			cell: (info: any) => (
				<span className={info.getValue() === null ? "text-muted-foreground italic" : ""}>
					{info.getValue() === null ? "null" : String(info.getValue())}
				</span>
			),
		})),
		state: { sorting },
		onSortingChange: setSorting,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
	});

	return (
		<>
			{/* Drag handle */}
			<div
				onMouseDown={onResizeStart}
				className="h-1.5 bg-border-table hover:bg-primary/40 active:bg-primary/60 cursor-row-resize transition-colors shrink-0 select-none"
				title="Drag to resize"
			/>
			{/* Results grid */}
			<div className="flex-1 border-t border-border overflow-auto scrollbar-thin min-h-0">
				{queryResult.rows.length === 0 && queryResult.columns.length === 0 ? (
					<div className="flex flex-col items-center justify-center h-full text-accent-green p-8 text-center">
						<Sparkles size={24} className="mb-3 text-accent-green/40" />
						<p className="text-xs font-bold uppercase tracking-widest">
							Executed successfully · {queryResult.executionTimeMs}ms
						</p>
					</div>
				) : (
					<Table className="w-full text-[11px] font-mono border-collapse">
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
												className="h-auto px-3 py-1 text-left border-r border-border last:border-r-0 cursor-pointer hover:bg-muted/30 transition-colors group/th"
												onClick={h.column.getToggleSortingHandler()}
											>
												<div className="flex items-center gap-1">
													<span className="font-bold text-muted-foreground text-[10px] uppercase tracking-wider group-hover/th:text-foreground transition-colors">
														{flexRender(
															h.column.columnDef.header,
															h.getContext(),
														)}
													</span>
													{sortDir && (
														<span className="text-accent-blue text-[9px]">
															{sortDir === "asc" ? "↑" : "↓"}
														</span>
													)}
												</div>
												{colType && (
													<div className="text-[9px] font-mono text-muted-foreground/35 leading-tight mt-0.5">
														{colType}
													</div>
												)}
											</TableHead>
										);
									})}
								</TableRow>
							))}
						</TableHeader>
						<TableBody>
							{table.getRowModel().rows.map((row) => (
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
