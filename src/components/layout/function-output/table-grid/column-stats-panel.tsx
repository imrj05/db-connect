import { useMemo } from "react";
import { X, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ColStats {
	total: number;
	filled: number;
	nullCount: number;
	fillPct: number;
	distinctCount: number;
	min?: number;
	max?: number;
	avg?: number;
	sum?: number;
	topValues: { value: string; count: number; pct: number }[];
	isNumeric: boolean;
}

function computeStats(colId: string, rows: Record<string, unknown>[]): ColStats {
	const total = rows.length;
	let nullCount = 0;
	const valueCounts = new Map<string, number>();
	const numericValues: number[] = [];
	let isNumeric = true;

	for (const row of rows) {
		const val = row[colId];
		if (val === null || val === undefined || val === "") {
			nullCount++;
			continue;
		}
		const str = String(val);
		valueCounts.set(str, (valueCounts.get(str) ?? 0) + 1);
		const num = Number(val);
		if (isNumeric && !isNaN(num) && typeof val !== "boolean") {
			numericValues.push(num);
		} else {
			isNumeric = false;
		}
	}

	const filled = total - nullCount;
	const distinctCount = valueCounts.size;
	let min: number | undefined;
	let max: number | undefined;
	let avg: number | undefined;
	let sum: number | undefined;

	if (isNumeric && numericValues.length > 0) {
		min = Math.min(...numericValues);
		max = Math.max(...numericValues);
		sum = numericValues.reduce((a, b) => a + b, 0);
		avg = sum / numericValues.length;
	}

	const topValues = Array.from(valueCounts.entries())
		.sort((a, b) => b[1] - a[1])
		.slice(0, 7)
		.map(([value, count]) => ({
			value,
			count,
			pct: filled > 0 ? (count / filled) * 100 : 0,
		}));

	return {
		total,
		filled,
		nullCount,
		fillPct: total > 0 ? (filled / total) * 100 : 0,
		distinctCount,
		min,
		max,
		avg,
		sum,
		topValues,
		isNumeric: isNumeric && numericValues.length > 0,
	};
}

function fmt(n: number): string {
	if (Number.isInteger(n)) return n.toLocaleString();
	if (Math.abs(n) >= 10000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
	return parseFloat(n.toPrecision(5)).toString();
}

function StatRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
	return (
		<div className="flex items-center justify-between py-1.5 border-b border-border-subtle last:border-0">
			<span className="text-[11px] text-muted-foreground">{label}</span>
			<span className={cn("text-[12px] font-mono tabular-nums font-medium", muted ? "text-foreground/40" : "text-foreground")}>
				{value}
			</span>
		</div>
	);
}

export function ColumnStatsPanel({
	colId,
	rows,
	onClose,
}: {
	colId: string;
	rows: Record<string, unknown>[];
	onClose: () => void;
}) {
	const stats = useMemo(() => computeStats(colId, rows), [colId, rows]);
	const maxTopCount = stats.topValues[0]?.count ?? 1;

	return (
		<div className="w-[260px] shrink-0 border-l border-border flex flex-col bg-surface-2 overflow-hidden">
			{/* Header */}
			<div className="h-9 px-3 flex items-center justify-between border-b border-border shrink-0">
				<div className="flex items-center gap-2 min-w-0">
					<BarChart2 size={13} className="text-accent-blue shrink-0" />
					<span className="text-[11px] font-semibold text-foreground font-mono truncate">
						{colId}
					</span>
				</div>
				<Button
					variant="ghost"
					size="icon-xs"
					onClick={onClose}
					className="h-6 w-6 shrink-0 text-foreground/38 hover:text-foreground"
				>
					<X size={12} />
				</Button>
			</div>

			<ScrollArea className="flex-1">
				<div className="p-3 space-y-4">

					{/* Fill rate bar */}
					<div>
						<div className="flex items-center justify-between mb-1.5">
							<span className="text-[10px] font-bold uppercase tracking-wider text-foreground/40">
								Fill Rate
							</span>
							<span className="text-[12px] font-mono font-semibold text-foreground">
								{stats.fillPct.toFixed(1)}%
							</span>
						</div>
						<div className="h-2 w-full rounded-full bg-surface-3 overflow-hidden">
							<div
								className={cn(
									"h-full rounded-full transition-all",
									stats.fillPct >= 90
										? "bg-accent-green"
										: stats.fillPct >= 50
											? "bg-accent-blue"
											: "bg-warning",
								)}
								style={{ width: `${stats.fillPct}%` }}
							/>
						</div>
						<div className="flex justify-between mt-1">
							<span className="text-[10px] text-foreground/40">
								{stats.filled.toLocaleString()} filled
							</span>
							<span className={cn("text-[10px]", stats.nullCount > 0 ? "text-warning/80" : "text-foreground/30")}>
								{stats.nullCount.toLocaleString()} empty
							</span>
						</div>
					</div>

					{/* Overview stats */}
					<div>
						<p className="text-[10px] font-bold uppercase tracking-wider text-foreground/40 mb-1">
							Overview
						</p>
						<div className="rounded-md border border-border-subtle overflow-hidden">
							<StatRow label="Total rows" value={stats.total.toLocaleString()} />
							<StatRow label="Unique values" value={stats.distinctCount.toLocaleString()} />
							<StatRow
								label="Duplicate rate"
								value={
									stats.filled > 0
										? `${(((stats.filled - stats.distinctCount) / stats.filled) * 100).toFixed(1)}%`
										: "—"
								}
								muted={stats.filled === 0}
							/>
						</div>
					</div>

					{/* Numeric stats */}
					{stats.isNumeric && (
						<div>
							<p className="text-[10px] font-bold uppercase tracking-wider text-foreground/40 mb-1">
								Numbers
							</p>
							<div className="rounded-md border border-border-subtle overflow-hidden">
								<StatRow label="Min" value={fmt(stats.min!)} />
								<StatRow label="Max" value={fmt(stats.max!)} />
								<StatRow label="Average" value={fmt(stats.avg!)} />
								<StatRow label="Sum" value={fmt(stats.sum!)} />
							</div>
						</div>
					)}

					{/* Top values */}
					{stats.topValues.length > 0 && (
						<div>
							<p className="text-[10px] font-bold uppercase tracking-wider text-foreground/40 mb-2">
								Most Common
							</p>
							<div className="space-y-2">
								{stats.topValues.map(({ value, count }) => (
									<div key={value}>
										<div className="flex items-center justify-between mb-0.5">
											<span className="text-[11px] font-mono text-foreground/80 truncate max-w-[160px]">
												{value === "" ? (
													<span className="italic text-foreground/30">empty</span>
												) : (
													value
												)}
											</span>
											<span className="text-[11px] font-mono text-foreground/50 shrink-0 ml-2 tabular-nums">
												{count.toLocaleString()}
											</span>
										</div>
										<div className="h-1.5 w-full rounded-full bg-surface-3 overflow-hidden">
											<div
												className="h-full rounded-full bg-accent-blue/50"
												style={{ width: `${(count / maxTopCount) * 100}%` }}
											/>
										</div>
									</div>
								))}
							</div>
						</div>
					)}

					{stats.total === 0 && (
						<p className="text-[11px] text-foreground/30 text-center py-4">No data</p>
					)}
				</div>
			</ScrollArea>
		</div>
	);
}
