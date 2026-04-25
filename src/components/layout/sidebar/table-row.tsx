import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, Loader2, Table2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ConnectionFunction, ColumnInfo } from "@/types";
import { ColumnRow } from "@/components/layout/sidebar/column-row";

function midTruncate(name: string, max = 24): string {
    if (name.length <= max) return name;
    const front = Math.ceil((max - 1) * 0.55);
    const back = Math.floor((max - 1) * 0.45);
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
            <Tooltip delayDuration={700}>
                <TooltipTrigger asChild>
                    <button
                        onClick={() => onInvoke(fn)}
                        className={cn(
                            "group relative w-full flex items-center gap-1.5 h-[30px] pr-2 pl-0 transition-colors overflow-hidden",
                            isActive
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground/65 hover:bg-muted/40 hover:text-foreground",
                        )}
                    >
                        {/* Active left accent */}
                        {isActive && (
                            <div className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-full bg-primary" />
                        )}

                        {/* Expand chevron */}
                        <span
                            className={cn(
                                "flex items-center justify-center w-5 h-full shrink-0 transition-colors",
                                isActive
                                    ? "text-primary/50 hover:text-primary/80"
                                    : "text-muted-foreground/25 hover:text-muted-foreground/60",
                            )}
                            onClick={(e) => { e.stopPropagation(); expandTo(!open); }}
                        >
                            {loadingCols
                                ? <Loader2 size={10} className="animate-spin" />
                                : open
                                    ? <ChevronDown size={10} />
                                    : <ChevronRight size={10} />}
                        </span>

                        {/* Table icon */}
                        <Table2
                            size={12}
                            className={cn(
                                "shrink-0 transition-colors",
                                isActive ? "text-primary/80" : "text-blue-400/60 group-hover:text-blue-400/90",
                            )}
                        />

                        {/* Table name */}
                        <span
                            className={cn(
                                "text-[11px] font-mono flex-1 text-left min-w-0 truncate",
                                isActive ? "font-semibold text-primary" : "",
                            )}
                        >
                            {midTruncate(fn.tableName ?? "")}
                        </span>

                        {/* Column count badge */}
                        {columns.length > 0 && (
                            <span className={cn(
                                "shrink-0 text-[9px] font-mono tabular-nums px-1 h-[14px] flex items-center rounded transition-colors",
                                isActive
                                    ? "bg-primary/15 text-primary/70"
                                    : "bg-muted/0 text-muted-foreground/30 group-hover:bg-muted/60 group-hover:text-muted-foreground/60",
                            )}>
                                {columns.length}
                            </span>
                        )}
                    </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={6} className="font-mono text-[11px]">
                    {fn.tableName}
                    {columns.length > 0 && (
                        <span className="ml-1.5 text-muted-foreground/60">{columns.length} cols</span>
                    )}
                </TooltipContent>
            </Tooltip>

            {/* Column list */}
            {open && columns.length > 0 && (
                <div className="relative ml-5 border-l border-border/40">
                    {columns.map((col, i) => (
                        <ColumnRow key={col.name} col={col} isLast={i === columns.length - 1} />
                    ))}
                </div>
            )}
        </div>
    );
}
