import { useMemo } from "react";
import { X, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
		.slice(0, 5)
		.map(([value, count]) => ({
			value,
			count,
			pct: filled > 0 ? Math.round((count / filled) * 100) : 0,
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
	if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
	return parseFloat(n.toPrecision(4)).toString();
}

function Divider() {
	return <div className="w-px h-5 bg-border shrink-0" />;
}

function StatChip({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
	return (
		<div className="flex items-baseline gap-1.5 shrink-0">
			<span className="text-[10px] text-foreground/40 uppercase tracking-wider font-medium">{label}</span>
			<span className={cn("text-[12px] font-mono font-semibold tabular-nums", accent ? "text-accent-blue" : "text-foreground/80")}>
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

	return (
		<div className="shrink-0 border-t border-border bg-surface-2/96 backdrop-blur-sm px-3 h-11 flex items-center gap-3 overflow-x-auto scrollbar-thin">
			{/* Column name + close */}
			<div className="flex items-center gap-1.5 shrink-0">
				<BarChart2 size={12} className="text-accent-blue shrink-0" />
				<span className="text-[11px] font-semibold font-mono text-foreground">{colId}</span>
				<Button
					variant="ghost"
					size="icon-xs"
					onClick={onClose}
					className="h-5 w-5 text-foreground/30 hover:text-foreground ml-0.5"
				>
					<X size={11} />
				</Button>
			</div>

			<Divider />

			{/* Rows */}
			<StatChip label="rows" value={stats.total.toLocaleString()} />

			<Divider />

			{/* Fill rate bar + pct */}
			<div className="flex items-center gap-2 shrink-0">
				<span className="text-[10px] text-foreground/40 uppercase tracking-wider font-medium">filled</span>
				<div className="flex items-center gap-1.5">
					<div className="w-16 h-1.5 rounded-full bg-surface-3 overflow-hidden">
						<div
							className={cn(
								"h-full rounded-full",
								stats.fillPct >= 90 ? "bg-accent-green" : stats.fillPct >= 50 ? "bg-accent-blue" : "bg-warning",
							)}
							style={{ width: `${stats.fillPct}%` }}
						/>
					</div>
					<span className="text-[12px] font-mono font-semibold tabular-nums text-foreground/80">
						{stats.fillPct.toFixed(1)}%
					</span>
				</div>
			</div>

			{stats.nullCount > 0 && (
				<>
					<Divider />
					<StatChip label="null" value={stats.nullCount.toLocaleString()} accent />
				</>
			)}

			<Divider />
			<StatChip label="unique" value={stats.distinctCount.toLocaleString()} />

			{/* Numeric stats */}
			{stats.isNumeric && (
				<>
					<Divider />
					<StatChip label="min" value={fmt(stats.min!)} />
					<StatChip label="max" value={fmt(stats.max!)} />
					<StatChip label="avg" value={fmt(stats.avg!)} />
					<StatChip label="sum" value={fmt(stats.sum!)} />
				</>
			)}

			{/* Top values */}
			{stats.topValues.length > 0 && (
				<>
					<Divider />
					<span className="text-[10px] text-foreground/40 uppercase tracking-wider font-medium shrink-0">top</span>
					<div className="flex items-center gap-2">
						{stats.topValues.map(({ value, pct }) => (
							<div key={value} className="flex items-center gap-1 shrink-0 rounded bg-surface-3 border border-border-subtle px-1.5 py-0.5">
								<span className="text-[11px] font-mono text-foreground/70 max-w-[100px] truncate">
									{value}
								</span>
								<span className="text-[10px] text-foreground/40 tabular-nums">{pct}%</span>
							</div>
						))}
					</div>
				</>
			)}
		</div>
	);
}
