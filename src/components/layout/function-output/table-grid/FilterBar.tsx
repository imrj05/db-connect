import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FilterCondition, FilterOp } from "@/types";

export function FilterBar({
	show,
	viewMode,
	filters,
	availableCols,
	filterLoading,
	filtersActive,
	filteredRowCount,
	onFilterChange,
	onRemoveFilter,
	onAddFilter,
	onApply,
	onClear,
}: {
	show: boolean;
	viewMode: "data" | "form" | "structure" | "er";
	filters: FilterCondition[];
	availableCols: string[];
	filterLoading: boolean;
	filtersActive: boolean;
	filteredRowCount: number;
	onFilterChange: (id: string, partial: Partial<FilterCondition>) => void;
	onRemoveFilter: (id: string) => void;
	onAddFilter: () => void;
	onApply: () => void;
	onClear: () => void;
}) {
	if (!show || viewMode !== "data") return null;
	return (
		<div className="shrink-0 border-b border-border bg-card px-3 py-2 flex flex-col gap-2">
			{filters.map((f, i) => (
				<div key={f.id}>
					{i > 0 && (
						<div className="flex items-center py-0.5 pl-1 mb-1">
							<button
								onClick={() =>
									onFilterChange(f.id, {
										join: f.join === "AND" ? "OR" : "AND",
									})
								}
								className="text-[9px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
							>
								{f.join}
							</button>
						</div>
					)}
					<div className="flex items-center gap-2">
						<select
							value={f.col}
							onChange={(e) => onFilterChange(f.id, { col: e.target.value })}
							className="h-6 px-2 rounded bg-background border border-border text-[11px] font-mono text-foreground outline-none"
						>
							{availableCols.map((c) => (
								<option key={c} value={c}>
									{c}
								</option>
							))}
						</select>
						<select
							value={f.op}
							onChange={(e) =>
								onFilterChange(f.id, { op: e.target.value as FilterOp })
							}
							className="h-6 px-2 rounded bg-background border border-border text-[11px] font-mono text-foreground outline-none"
						>
							{(
								[
									"=",
									"!=",
									">",
									"<",
									">=",
									"<=",
									"LIKE",
									"NOT LIKE",
									"IS NULL",
									"IS NOT NULL",
								] as FilterOp[]
							).map((op) => (
								<option key={op} value={op}>
									{op}
								</option>
							))}
						</select>
						{f.op !== "IS NULL" && f.op !== "IS NOT NULL" && (
							<Input
								value={f.value}
								onChange={(e) => onFilterChange(f.id, { value: e.target.value })}
								onKeyDown={(e) => e.key === "Enter" && onApply()}
								placeholder="value"
								className="h-6 text-[11px] font-mono w-36"
							/>
						)}
						<Button
							variant="ghost"
							size="icon-xs"
							onClick={() => onRemoveFilter(f.id)}
							className="text-muted-foreground/40 hover:text-destructive"
						>
							<X size={10} />
						</Button>
					</div>
				</div>
			))}
			<div className="flex items-center gap-2">
				<Button
					variant="outline"
					size="xs"
					onClick={onAddFilter}
					className="h-6 text-[10px] font-bold uppercase tracking-widest"
				>
					+ Add
				</Button>
				<Button
					size="xs"
					onClick={onApply}
					disabled={filterLoading || filters.length === 0}
					className="h-6 text-[10px] font-bold uppercase tracking-widest gap-1"
				>
					{filterLoading && (
						<Loader2 size={9} className="animate-spin" />
					)}
					Apply
				</Button>
				<Button
					variant="ghost"
					size="xs"
					onClick={onClear}
					className="h-6 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
				>
					Clear
				</Button>
				{filtersActive && (
					<Badge
						variant="secondary"
						className="text-[9px] font-mono h-5"
					>
						{filteredRowCount} filtered
					</Badge>
				)}
			</div>
		</div>
	);
}
