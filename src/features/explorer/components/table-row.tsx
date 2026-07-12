import { useEffect, useState } from "react";
import {
    AlignJustify,
    Braces,
    ChevronDown,
    ChevronRight,
    Clock,
    Hash,
    Key,
    Loader2,
    Pin,
    PinOff,
    Table2,
    ToggleLeft,
} from "lucide-react";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuLabel,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ColumnInfo, ConnectionFunction } from "@/types";

function ColumnIcon({ col }: { col: ColumnInfo }) {
    const t = col.dataType?.toLowerCase() ?? "";
    if (col.isPrimary)
        return <Key size={9} className="shrink-0 text-warning/70" />;
    if (t.includes("timestamp") || t.includes("date") || t.includes("time"))
        return <Clock size={9} className="shrink-0 text-muted-foreground/40" />;
    if (t.includes("int") || t.includes("numeric") || t.includes("float") || t.includes("decimal") || t.includes("serial"))
        return <Hash size={9} className="shrink-0 text-muted-foreground/40" />;
    if (t.includes("bool"))
        return <ToggleLeft size={9} className="shrink-0 text-muted-foreground/40" />;
    if (t.includes("json"))
        return <Braces size={9} className="shrink-0 text-muted-foreground/40" />;
    return <AlignJustify size={9} className="shrink-0 text-muted-foreground/35" />;
}

function ColumnRow({ col }: { col: ColumnInfo }) {
    return (
        <div className="flex h-[22px] items-center gap-2 rounded-md pl-1.5 pr-2.5 text-foreground/62 transition-colors hover:bg-card/72 hover:text-foreground/82">
            <ColumnIcon col={col} />
            <span className="text-[11px] font-mono truncate flex-1">{col.name}</span>
            <span className="text-[11px] font-mono text-foreground/38 shrink-0">
                {col.dataType}
            </span>
        </div>
    );
}

// Middle-truncate long table names so both ends stay legible.
function midTruncate(name: string, max = 26): string {
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
    isPinned,
    onPinToggle,
    onTableAction,
}: {
    fn: ConnectionFunction;
    columns: ColumnInfo[];
    isActive: boolean;
    onInvoke: (fn: ConnectionFunction) => void;
    forceOpen?: boolean | null;
    onLoadColumns: () => Promise<void>;
    isPinned?: boolean;
    onPinToggle?: () => void;
    onTableAction?: (action: "rename" | "truncate" | "drop") => void;
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
        <ContextMenu>
        <ContextMenuTrigger asChild>
        <div className="w-full min-w-0 overflow-hidden">
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        onClick={() => onInvoke(fn)}
                        className={cn(
                            "group flex h-7 w-full items-center gap-2.5 overflow-hidden rounded-md pl-1.5 pr-2.5 transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                            isActive
                                ? "bg-primary/15/82 text-foreground shadow-xs ring-1 ring-border"
                                : "text-foreground/72 hover:bg-card hover:text-foreground",
                        )}
                    >
                        {/* expand chevron — always visible */}
                        <span
                            className="flex items-center justify-center w-5 h-full shrink-0 text-foreground/28 hover:text-foreground/52"
                            onClick={(e) => { e.stopPropagation(); expandTo(!open); }}
                        >
                            {loadingCols
                                ? <Loader2 size={10} className="animate-spin" />
                                : open
                                    ? <ChevronDown size={10} />
                                    : <ChevronRight size={10} />}
                        </span>
                        <Table2
                            size={12}
                            className={cn(
                                "shrink-0",
                                isActive ? "text-primary/72" : "text-blue-400/72",
                            )}
                        />
                        <span
                            className={cn(
                                "text-[12px] font-mono flex-1 text-left min-w-0",
                                isActive && "font-semibold text-foreground",
                            )}
                        >
                            {midTruncate(fn.tableName ?? "")}
                        </span>
                        {onPinToggle && (
                            <span
                                onClick={(e) => { e.stopPropagation(); onPinToggle(); }}
                                className={cn(
                                    "opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded",
                                    isPinned ? "opacity-100 text-primary/70" : "text-foreground/30 hover:text-primary/70"
                                )}
                                title={isPinned ? "Unpin table" : "Pin table"}
                            >
                                {isPinned ? <PinOff size={9} /> : <Pin size={9} />}
                            </span>
                        )}
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
        </ContextMenuTrigger>
        {onTableAction && (
            <ContextMenuContent className="w-44">
                <ContextMenuLabel className="text-[10px] font-mono text-muted-foreground/60 truncate">{fn.tableName}</ContextMenuLabel>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => onTableAction("rename")}>Rename table…</ContextMenuItem>
                <ContextMenuItem onClick={() => onTableAction("truncate")} className="text-orange-400 focus:text-orange-300">Truncate table</ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => onTableAction("drop")} className="text-destructive focus:text-destructive">Drop table</ContextMenuItem>
            </ContextMenuContent>
        )}
        </ContextMenu>
    );
}
