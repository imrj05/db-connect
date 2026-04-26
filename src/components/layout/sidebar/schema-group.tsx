import { useState } from "react";
import { ChevronDown, ChevronRight, Folder, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConnectionFunction, ColumnInfo } from "@/types";
import { TableRow } from "@/components/layout/sidebar/table-row";

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
                    className="group w-full flex items-center gap-1.5 h-[28px] pl-1 pr-2 text-foreground/55 dark:text-muted-foreground/80 hover:text-foreground/80 dark:hover:text-muted-foreground hover:bg-muted/40 transition-colors"
                >
                    <span className="flex items-center justify-center w-4 shrink-0 text-foreground/38 dark:text-muted-foreground/55 group-hover:text-foreground/60 dark:group-hover:text-muted-foreground/80 transition-colors">
                        {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                    </span>
                    {open
                        ? <FolderOpen size={11} className="shrink-0 text-foreground/45 dark:text-muted-foreground/65 group-hover:text-foreground/70 dark:group-hover:text-muted-foreground/90 transition-colors" />
                        : <Folder size={11} className="shrink-0 text-foreground/40 dark:text-muted-foreground/60 group-hover:text-foreground/65 dark:group-hover:text-muted-foreground/85 transition-colors" />}
                    <span className="text-[10px] font-mono flex-1 text-left tracking-wide">{schema}</span>
                    <span className="text-[8.5px] font-mono tabular-nums px-1.5 h-[14px] flex items-center rounded-full bg-muted/80 dark:bg-muted/60 text-foreground/50 dark:text-muted-foreground/70 border border-border/70 dark:border-border/60">
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
