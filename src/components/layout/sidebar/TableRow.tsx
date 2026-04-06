import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, Loader2, Table2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ConnectionFunction, ColumnInfo } from "@/types";
import { ColumnRow } from "@/components/layout/sidebar/ColumnRow";

function midTruncate(name: string, max = 26): string {
	if (name.length <= max) return name;
	const front = Math.ceil((max - 1) * 0.55);
	const back  = Math.floor((max - 1) * 0.45);
	return `${name.slice(0, front)}…${name.slice(-back)}`;
}

export function TableRow({
	fn,
	columns,
	isActive,
	onInvoke,
	forceOpen,
	onLoadColumns,
}: {
	fn: ConnectionFunction;
	columns: ColumnInfo[];
	isActive: boolean;
	onInvoke: (fn: ConnectionFunction) => void;
	forceOpen?: boolean | null;
	onLoadColumns: () => Promise<void>;
}) {
	const [open, setOpen] = useState(false);
	const [loadingCols, setLoadingCols] = useState(false);

	const expandTo = async (next: boolean) => {
		setOpen(next);
		if (next && columns.length === 0) {
			setLoadingCols(true);
			try { await onLoadColumns(); } finally { setLoadingCols(false); }
		}
	};

	useEffect(() => {
		if (forceOpen != null) expandTo(forceOpen);
	}, [forceOpen]);

	return (
		<div className="w-full min-w-0 overflow-hidden">
			<Tooltip>
				<TooltipTrigger asChild>
					<button
						onClick={() => onInvoke(fn)}
						className={cn(
							"group w-full flex items-center gap-1.5 h-[26px] pr-2 pl-0 transition-colors overflow-hidden",
							isActive
								? "bg-primary/10 text-primary"
								: "text-muted-foreground/70 hover:bg-muted/50 hover:text-foreground",
						)}
					>
						{/* expand chevron */}
						<span
							className="flex items-center justify-center w-5 h-full shrink-0 text-muted-foreground/30 hover:text-muted-foreground/60"
							onClick={(e) => { e.stopPropagation(); expandTo(!open); }}
						>
							{loadingCols
								? <Loader2 size={10} className="animate-spin" />
								: open
									? <ChevronDown size={10} />
									: <ChevronRight size={10} />}
						</span>

						<Table2
							size={11}
							className={cn(
								"shrink-0",
								isActive ? "text-primary/80" : "text-blue-400/70",
							)}
						/>
						<span
							className={cn(
								"text-[11px] font-mono flex-1 text-left min-w-0",
								isActive && "font-semibold",
							)}
						>
							{midTruncate(fn.tableName ?? "")}
						</span>
					</button>
				</TooltipTrigger>
				<TooltipContent side="right" sideOffset={6} className="font-mono text-[11px]">
					{fn.tableName}
				</TooltipContent>
			</Tooltip>

			{/* columns */}
			{open && columns.length > 0 && (
				<div className="pl-7">
					{columns.map((col) => (
						<ColumnRow key={col.name} col={col} />
					))}
				</div>
			)}
		</div>
	);
}
