import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CellColorRule, CellColorRuleColor, CellColorRuleOp } from "@/types";

const OPS: { value: CellColorRuleOp; label: string }[] = [
	{ value: "=", label: "=" },
	{ value: "!=", label: "≠" },
	{ value: ">", label: ">" },
	{ value: "<", label: "<" },
	{ value: ">=", label: "≥" },
	{ value: "<=", label: "≤" },
	{ value: "contains", label: "contains" },
	{ value: "IS NULL", label: "is null" },
	{ value: "IS NOT NULL", label: "is not null" },
];

const COLORS: { value: CellColorRuleColor; bg: string; text: string; border: string }[] = [
	{ value: "red",    bg: "bg-rose-500/18",   text: "text-rose-400",   border: "border-rose-500/40" },
	{ value: "yellow", bg: "bg-amber-400/18",  text: "text-amber-400",  border: "border-amber-400/40" },
	{ value: "green",  bg: "bg-emerald-500/18",text: "text-emerald-400",border: "border-emerald-500/40" },
	{ value: "blue",   bg: "bg-blue-500/18",   text: "text-blue-400",   border: "border-blue-500/40" },
	{ value: "purple", bg: "bg-violet-500/18", text: "text-violet-400", border: "border-violet-500/40" },
];

export const COLOR_STYLE_MAP: Record<CellColorRuleColor, { bg: string; text: string }> = {
	red:    { bg: "bg-rose-500/12",    text: "text-rose-400" },
	yellow: { bg: "bg-amber-400/12",   text: "text-amber-400" },
	green:  { bg: "bg-emerald-500/12", text: "text-emerald-400" },
	blue:   { bg: "bg-blue-500/12",    text: "text-blue-400" },
	purple: { bg: "bg-violet-500/12",  text: "text-violet-400" },
};

function noValueOp(op: CellColorRuleOp) {
	return op === "IS NULL" || op === "IS NOT NULL";
}

export function evaluateColorRule(
	rule: CellColorRule,
	colId: string,
	value: unknown,
): boolean {
	// rule.col === "" means "all columns"
	if (rule.col !== "" && rule.col !== colId) return false;
	if (rule.op === "IS NULL") return value === null || value === undefined;
	if (rule.op === "IS NOT NULL") return value !== null && value !== undefined;
	if (value === null || value === undefined) return false;
	const str = String(value);
	const ruleVal = rule.value;
	const num = Number(value);
	const ruleNum = Number(ruleVal);
	const canNumericCompare = !isNaN(num) && !isNaN(ruleNum) && ruleVal !== "";
	switch (rule.op) {
		case "=": return canNumericCompare ? num === ruleNum : str === ruleVal;
		case "!=": return canNumericCompare ? num !== ruleNum : str !== ruleVal;
		case ">": return canNumericCompare ? num > ruleNum : str > ruleVal;
		case "<": return canNumericCompare ? num < ruleNum : str < ruleVal;
		case ">=": return canNumericCompare ? num >= ruleNum : str >= ruleVal;
		case "<=": return canNumericCompare ? num <= ruleNum : str <= ruleVal;
		case "contains": return str.toLowerCase().includes(ruleVal.toLowerCase());
		default: return false;
	}
}

export function ColorRulesPanel({
	rules,
	columns,
	onAdd,
	onRemove,
	onUpdate,
	onClose,
}: {
	rules: CellColorRule[];
	columns: string[];
	onAdd: () => void;
	onRemove: (id: string) => void;
	onUpdate: (id: string, patch: Partial<CellColorRule>) => void;
	onClose: () => void;
}) {
	return (
		<div className="shrink-0 border-b border-border-subtle bg-surface-2/98 px-3 py-2.5 animate-in slide-in-from-top-1 duration-150">
			<div className="flex items-center justify-between mb-2">
				<span className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">
					Color Rules
				</span>
				<Button
					variant="ghost"
					size="icon-xs"
					onClick={onClose}
					className="h-5 w-5 text-foreground/38 hover:text-foreground"
				>
					<X size={11} />
				</Button>
			</div>
			<div className="space-y-1.5">
				{rules.map((rule) => (
					<div key={rule.id} className="flex items-center gap-1.5 min-w-0">
					{/* Column — use "__all__" sentinel because Radix Select forbids empty string values */}
					<Select
						value={rule.col === "" ? "__all__" : rule.col}
						onValueChange={(v) => onUpdate(rule.id, { col: v === "__all__" ? "" : v })}
					>
						<SelectTrigger size="xs" className="text-[11px] font-mono w-32 border-border-subtle bg-surface-3">
							<SelectValue placeholder="Column" />
						</SelectTrigger>
						<SelectContent className="text-[11px] font-mono">
							<SelectItem value="__all__">All columns</SelectItem>
							{columns.map((c) => (
								<SelectItem key={c} value={c}>{c}</SelectItem>
							))}
						</SelectContent>
					</Select>
					{/* Op */}
					<Select
						value={rule.op}
						onValueChange={(v) => onUpdate(rule.id, { op: v as CellColorRuleOp })}
					>
						<SelectTrigger size="xs" className="text-[11px] font-mono w-20 border-border-subtle bg-surface-3">
							<SelectValue />
						</SelectTrigger>
						<SelectContent className="text-[11px] font-mono">
							{OPS.map((o) => (
								<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
							))}
						</SelectContent>
					</Select>
					{/* Value */}
					{!noValueOp(rule.op) && (
						<Input
							value={rule.value}
							onChange={(e) => onUpdate(rule.id, { value: e.target.value })}
							placeholder="value"
							className="h-6 py-0 px-2 text-[11px] font-mono w-28 border-border-subtle bg-surface-3 shadow-none"
						/>
					)}
						{/* Color swatches */}
						<div className="flex items-center gap-0.5">
							{COLORS.map((c) => (
								<button
									key={c.value}
									onClick={() => onUpdate(rule.id, { color: c.value })}
									className={cn(
										"h-5 w-5 rounded border transition-all",
										c.bg, c.border,
										rule.color === c.value
											? "ring-2 ring-primary ring-offset-1 ring-offset-surface-2 scale-110"
											: "opacity-60 hover:opacity-100",
									)}
									title={c.value}
								/>
							))}
						</div>
						{/* Delete */}
						<Button
							variant="ghost"
							size="icon-xs"
							onClick={() => onRemove(rule.id)}
							className="h-5 w-5 text-destructive/50 hover:text-destructive hover:bg-destructive/10"
						>
							<Trash2 size={10} />
						</Button>
					</div>
				))}
			</div>
			<Button
				variant="ghost"
				size="xs"
				onClick={onAdd}
				className="mt-2 h-6 text-[11px] text-foreground/50 hover:text-foreground gap-1"
			>
				<Plus size={10} />
				Add rule
			</Button>
		</div>
	);
}
