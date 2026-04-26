import { useCallback } from "react";
import { Copy, X, Key, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { TableStructure } from "@/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

interface RowDetailPanelProps {
	row: Record<string, unknown>;
	rowIndex: number; // 0-based absolute (page * pageSize + idx)
	totalRows: number;
	tableName?: string;
	structure?: TableStructure | null;
	onClose: () => void;
	onPrev: () => void;
	onNext: () => void;
	hasPrev: boolean;
	hasNext: boolean;
}

function formatValue(value: unknown): string {
	if (value === null || value === undefined) return "NULL";
	if (typeof value === "object") return JSON.stringify(value);
	return String(value);
}

function isNullish(value: unknown): boolean {
	return value === null || value === undefined;
}

export function RowDetailPanel({
	row,
	rowIndex,
	totalRows,
	tableName,
	structure,
	onClose,
	onPrev,
	onNext,
	hasPrev,
	hasNext,
}: RowDetailPanelProps) {
	const columns = Object.keys(row);

	const copyField = useCallback((col: string) => {
		const val = formatValue(row[col]);
		navigator.clipboard.writeText(val).catch(() => {});
	}, [row]);

	const copyRow = useCallback(() => {
		const text = columns.map((col) => `${col}: ${formatValue(row[col])}`).join("\n");
		navigator.clipboard.writeText(text).catch(() => {});
	}, [columns, row]);

	const pkColumns = structure?.columns.filter((c) => c.isPrimary).map((c) => c.name) ?? [];
	const colMeta = (col: string) => structure?.columns.find((c) => c.name === col);

	return (
		<div className="w-[280px] shrink-0 border-l border-border flex flex-col bg-surface-2 overflow-hidden">
			{/* Header */}
			<div className="h-9 px-3 flex items-center justify-between border-b border-border shrink-0 gap-2">
				<div className="flex items-center gap-1.5 min-w-0">
					<span className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground/50 shrink-0">
						Row {rowIndex + 1}
					</span>
					{tableName && (
						<span className="text-[9px] text-muted-foreground/40 truncate font-mono">
							— {tableName}
						</span>
					)}
				</div>
				<div className="flex items-center gap-0.5 shrink-0">
					<Button
						variant="ghost"
						size="icon-xs"
						disabled={!hasPrev}
						onClick={onPrev}
						className="h-5 w-5 text-muted-foreground/50 hover:text-foreground"
						title="Previous row"
					>
						<ChevronUp size={10} />
					</Button>
					<Button
						variant="ghost"
						size="icon-xs"
						disabled={!hasNext}
						onClick={onNext}
						className="h-5 w-5 text-muted-foreground/50 hover:text-foreground"
						title="Next row"
					>
						<ChevronDown size={10} />
					</Button>
					<Button
						variant="ghost"
						size="icon-xs"
						onClick={copyRow}
						className="h-5 w-5 text-muted-foreground/50 hover:text-foreground"
						title="Copy all fields"
					>
						<Copy size={9} />
					</Button>
					<Button
						variant="ghost"
						size="icon-xs"
						onClick={onClose}
						className="h-5 w-5 text-muted-foreground/40 hover:text-foreground"
					>
						<X size={9} />
					</Button>
				</div>
			</div>

			{/* Fields */}
			<ScrollArea className="flex-1 min-h-0">
				<div className="p-2 space-y-[3px]">
					{columns.map((col) => {
						const meta = colMeta(col);
						const isPk = pkColumns.includes(col);
						const isNull = isNullish(row[col]);
						const rawVal = formatValue(row[col]);
						const isLong = rawVal.length > 60;

						return (
							<div
								key={col}
								className={cn(
									"group rounded-md border border-border/60 bg-surface-3/60 px-2.5 py-1.5 hover:border-border",
									isPk && "border-primary/20 bg-primary/5",
								)}
							>
								{/* Column name row */}
								<div className="flex items-center justify-between gap-1 mb-0.5">
									<div className="flex items-center gap-1 min-w-0">
										{isPk && (
											<Key size={8} className="shrink-0 text-amber-500/70" />
										)}
										<span className="text-[10px] font-mono font-semibold text-foreground/70 truncate">
											{col}
										</span>
										{meta?.dataType && (
											<span className="shrink-0 rounded-[3px] border border-border/50 bg-muted/40 px-1 py-px text-[8px] font-mono text-muted-foreground/50 leading-none">
												{meta.dataType.replace(/\(.*\)/, "").toUpperCase().slice(0, 8)}
											</span>
										)}
									</div>
									<button
										onClick={() => copyField(col)}
										className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/50 hover:text-foreground"
										title={`Copy ${col}`}
									>
										<Copy size={9} />
									</button>
								</div>
								{/* Value */}
								{isNull ? (
									<span className="text-[11px] font-mono italic text-muted-foreground/35">
										NULL
									</span>
								) : (
									<div
										className={cn(
											"text-[11px] font-mono text-foreground/85 break-all leading-relaxed",
											isLong && "max-h-[96px] overflow-y-auto scrollbar-thin",
										)}
									>
										{rawVal}
									</div>
								)}
							</div>
						);
					})}
				</div>
			</ScrollArea>

			{/* Footer row count */}
			<div className="h-7 px-3 flex items-center border-t border-border shrink-0">
				<span className="text-[9px] text-muted-foreground/40 font-mono">
					{rowIndex + 1} / {totalRows} rows on page
				</span>
			</div>
		</div>
	);
}
