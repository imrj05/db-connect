import { useState } from "react";
import { ChevronDown, ChevronRight, Folder, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConnectionFunction, ColumnInfo } from "@/types";
import { TableRow } from "@/components/layout/sidebar/TableRow";

export function SchemaGroup({
    schema,
    fns,
    tableInfoMap,
    activeFunctionId,
    onInvoke,
    showLabel,
    forceOpen,
    onLoadColumns,
}: {
    schema: string;
    fns: ConnectionFunction[];
    tableInfoMap: Record<string, ColumnInfo[]>;
    activeFunctionId?: string;
    onInvoke: (fn: ConnectionFunction) => void;
    showLabel: boolean;
    forceOpen?: boolean | null;
    onLoadColumns: (tableName: string) => Promise<void>;
}) {
    const [open, setOpen] = useState(true);

    return (
        <div>
            {showLabel && (
                <button
                    onClick={() => setOpen((v) => !v)}
                    className="group w-full flex items-center gap-1.5 h-[28px] pl-1 pr-2 text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/30 transition-colors"
                >
                    <span className="flex items-center justify-center w-4 shrink-0 text-muted-foreground/25 group-hover:text-muted-foreground/50 transition-colors">
                        {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                    </span>
                    {open
                        ? <FolderOpen size={11} className="shrink-0 text-muted-foreground/45 group-hover:text-muted-foreground/70 transition-colors" />
                        : <Folder size={11} className="shrink-0 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />}
                    <span className="text-[10px] font-mono flex-1 text-left tracking-wide">{schema}</span>
                    <span className="text-[8.5px] font-mono tabular-nums px-1.5 h-[14px] flex items-center rounded-full bg-muted/60 text-muted-foreground/50 border border-border/40">
                        {fns.length}
                    </span>
                </button>
            )}

            {open && (
                <div className={cn("w-full min-w-0 overflow-hidden", showLabel ? "pl-3" : "")}>
                    {fns.map((fn) => (
                        <TableRow
                            key={fn.id}
                            fn={fn}
                            columns={tableInfoMap[fn.tableName ?? ""] ?? []}
                            isActive={activeFunctionId === fn.id}
                            onInvoke={onInvoke}
                            forceOpen={forceOpen}
                            onLoadColumns={() => onLoadColumns(fn.tableName ?? "")}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
