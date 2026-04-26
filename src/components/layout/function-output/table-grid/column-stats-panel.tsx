import { useMemo } from "react";
import { X, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ColStats {
	total: number;
	nullCount: number;
	nullPct: number;
	distinctCount: number;
	min?: number;
	max?: number;
	avg?: number;
	sum?: number;
	topValues: { value: string; count: number; pct: number }[];
	isNumeric: boolean;
}

function computeStats(
	colId: string,
	rows: Record<string, unknown>[],
): ColStats {
	const total = rows.length;
	let nullCount = 0;
	const valueCounts = new Map<string, number>();
	const numericValues: number[] = [];
	let isNumeric = true;

	for (const row of rows) {
		const val = row[colId];
		if (val === null || val === undefined) {
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
			pct: total > 0 ? (count / total) * 100 : 0,
		}));

	return {
		total,
		nullCount,
		nullPct: total > 0 ? (nullCount / total) * 100 : 0,
		distinctCount,
		min,
		max,
		avg,
		sum,
		topValues,
		isNumeric: isNumeric && numericValues.length > 0,
	};
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

	const fmt = (n: number) =>
		Number.isInteger(n)
			? n.toLocaleString()
			: Math.abs(n) >= 1000
				? n.toLocaleString(undefined, { maximumFractionDigits: 2 })
				: n.toPrecision(5).replace(/\.?0+$/, "");

	return (
		<div className="shrink-0 border-t border-border-subtle bg-surface-2/98 p-3 animate-in slide-in-from-bottom-1 duration-150">
			<div className="flex items-center justify-between mb-2.5">
				<div className="flex items-center gap-1.5">
					<BarChart3 size={12} className="text-accent-blue" />
					<span className="text-[11px] font-semibold text-foreground font-mono">
						{colId}
					</span>
					<span className="text-[10px] text-foreground/38">— column stats ({stats.total} rows)</span>
				</div>
				<Button
					variant="ghost"
					size="icon-xs"
					onClick={onClose}
					className="h-5 w-5 text-foreground/38 hover:text-foreground"
				>
					<X size={11} />
				</Button>
			</div>
			<div className="flex gap-5 flex-wrap items-start">
				{/* Stat pills row */}
				<div className="flex flex-wrap gap-1.5">
					{(
						[
							{ label: "Null", value: `${stats.nullCount} (${stats.nullPct.toFixed(1)}%)`, warn: stats.nullCount > 0 },
							{ label: "Distinct", value: stats.distinctCount.toLocaleString(), warn: false },
							...(stats.isNumeric
								? [
										{ label: "Min", value: fmt(stats.min!), warn: false },
										{ label: "Max", value: fmt(stats.max!), warn: false },
										{ label: "Avg", value: fmt(stats.avg!), warn: false },
										{ label: "Sum", value: fmt(stats.sum!), warn: false },
									]
								: []),
						] as { label: string; value: string; warn: boolean }[]
					).map(({ label, value, warn }) => (
						<div
							key={label}
							className={cn(
								"flex flex-col items-center rounded-md border px-2 py-1 min-w-[52px]",
								warn
									? "border-warning/30 bg-warning/6"
									: "border-border-subtle bg-surface-3",
							)}
						>
							<span className="text-[8.5px] font-bold uppercase tracking-wider text-foreground/36">
								{label}
							</span>
							<span className="text-[11px] font-mono text-foreground tabular-nums leading-tight">
								{value}
							</span>
						</div>
					))}
				</div>
				{/* Top values bar chart */}
				{stats.topValues.length > 0 && (
					<div className="flex-1 min-w-[200px] max-w-[360px]">
						<p className="text-[8.5px] font-bold uppercase tracking-wider text-foreground/36 mb-1.5">
							Top Values
						</p>
						<div className="space-y-1">
							{stats.topValues.map(({ value, count, pct }) => (
								<div key={value} className="flex items-center gap-2">
									<span className="font-mono text-[10px] text-foreground/68 truncate w-24 shrink-0 text-right">
										{value === "" ? <span className="italic text-foreground/32">(empty)</span> : value}
									</span>
									<div className="flex-1 h-1.5 rounded-full bg-surface-3 overflow-hidden">
										<div
											className="h-full rounded-full bg-accent-blue/45"
											style={{ width: `${Math.max(pct, 2)}%` }}
										/>
									</div>
									<span className="text-[9px] font-mono text-foreground/38 w-9 text-right shrink-0 tabular-nums">
										{count}
									</span>
								</div>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
