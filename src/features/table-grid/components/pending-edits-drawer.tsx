import { CheckCheck, RotateCcw, X, ListChecks } from "lucide-react";
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/stores/useAppStore";
import { PendingCellEdit } from "@/types";
import { cn } from "@/lib/utils";

function formatValue(value: unknown): string {
    if (value === null || value === undefined || value === "") return "NULL";
    if (typeof value === "string") return value;
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
}

function buildEditSql(
    edit: PendingCellEdit,
    connType?: string,
): string {
    const qi = (n: string) => (connType === "mysql" ? `\`${n}\`` : `"${n}"`);
    const cols = Object.keys(edit.primaryKeyValues);
    if (cols.length === 0) {
        return `-- Unable to build SQL: missing primary key for row ${edit.rowKey}`;
    }
    const where = cols
        .map((c) => {
            const v = edit.primaryKeyValues[c];
            if (v === null || v === undefined) return `${qi(c)} IS NULL`;
            const isNum = typeof v === "number";
            return `${qi(c)} = ${isNum ? v : `'${String(v).replace(/'/g, "''")}'`}`;
        })
        .join(" AND ");
    if (edit.pendingValue === null) {
        return `UPDATE ${qi(edit.tableName)} SET ${qi(edit.columnId)} = NULL WHERE ${where};`;
    }
    const isNum = edit.pendingValue !== "" && !isNaN(Number(edit.pendingValue));
    const value = isNum ? edit.pendingValue : `'${edit.pendingValue.replace(/'/g, "''")}'`;
    return `UPDATE ${qi(edit.tableName)} SET ${qi(edit.columnId)} = ${value} WHERE ${where};`;
}

export function PendingEditsDrawer({
    open,
    onOpenChange,
    tabId,
    connectionType,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    tabId: string;
    connectionType?: string;
}) {
    const tabs = useAppStore((s) => s.tabs);
    const removePendingCellEdits = useAppStore((s) => s.removePendingCellEdits);
    const clearPendingCellEdits = useAppStore((s) => s.clearPendingCellEdits);
    const pendingEdits = tabs.find((t) => t.id === tabId)?.pendingEdits ?? [];

    return (
        <Drawer open={open} onOpenChange={onOpenChange} direction="right">
            <DrawerContent className="w-full sm:max-w-md">
                <DrawerHeader>
                    <div className="flex items-center justify-between gap-2">
                        <div>
                            <DrawerTitle className="flex items-center gap-2 text-[15px] font-semibold">
                                <ListChecks size={14} className="text-warning" />
                                Pending edits
                            </DrawerTitle>
                            <DrawerDescription>
                                Review queued changes before they are applied to the database.
                            </DrawerDescription>
                        </div>
                        <Badge variant="secondary" className="font-mono">
                            {pendingEdits.length}
                        </Badge>
                    </div>
                </DrawerHeader>
                <div className="flex-1 min-h-0 overflow-auto scrollbar-thin px-4 pb-4 space-y-3">
                    {pendingEdits.length === 0 ? (
                        <div className="rounded border border-dashed border-border-subtle bg-surface-1/60 px-4 py-8 text-center text-[12px] text-muted-foreground">
                            No pending edits.
                        </div>
                    ) : (
                        pendingEdits.map((edit) => {
                            const sql = buildEditSql(edit, connectionType);
                            return (
                                <div
                                    key={edit.id}
                                    className="rounded border border-warning/30 bg-warning/5 p-3 space-y-2"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <div className="text-[12px] font-semibold text-foreground/85 truncate">
                                                <span className="font-mono text-foreground/62">{edit.tableName}</span>
                                                <span className="text-foreground/70"> · </span>
                                                <span className="font-mono">{edit.columnId}</span>
                                            </div>
                                            <div className="mt-0.5 text-[11px] text-foreground/70 font-mono truncate">
                                                row <span className="text-foreground/70">{edit.rowKey}</span>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon-xs"
                                            aria-label="Revert edit"
                                            onClick={() => removePendingCellEdits(tabId, [edit.id])}
                                            className="size-6 shrink-0 text-muted-foreground hover:text-destructive"
                                        >
                                            <RotateCcw size={11} />
                                        </Button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                                        <div className="rounded border border-border-subtle bg-surface-1/70 p-2">
                                            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Original</div>
                                            <div className="mt-0.5 break-all font-mono text-foreground/80">
                                                {formatValue(edit.originalValue)}
                                            </div>
                                        </div>
                                        <div
                                            className={cn(
                                                "rounded border bg-surface-1/70 p-2",
                                                edit.pendingValue === null
                                                    ? "border-warning/35"
                                                    : "border-accent-green/35",
                                            )}
                                        >
                                            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">New</div>
                                            <div className="mt-0.5 break-all font-mono text-foreground/85">
                                                {formatValue(edit.pendingValue)}
                                            </div>
                                        </div>
                                    </div>
                                    <pre className="max-h-32 overflow-auto rounded bg-surface-1/85 p-2 text-[11px] font-mono leading-relaxed text-foreground/70 scrollbar-thin">
                                        {sql}
                                    </pre>
                                </div>
                            );
                        })
                    )}
                </div>
                <DrawerFooter className="border-t border-border-subtle bg-surface-1/60">
                    <div className="flex w-full items-center justify-between gap-2">
                        <DrawerClose asChild>
                            <Button variant="ghost" size="sm" className="gap-1 text-[11px]">
                                <X size={11} />
                                Close
                            </Button>
                        </DrawerClose>
                        <div className="flex items-center gap-1.5">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={pendingEdits.length === 0}
                                onClick={() => clearPendingCellEdits(tabId)}
                                className="gap-1 text-[11px] text-muted-foreground"
                            >
                                <RotateCcw size={11} />
                                Revert all
                            </Button>
                            <Button
                                variant="default"
                                size="sm"
                                disabled={pendingEdits.length === 0}
                                className="gap-1 text-[11px]"
                            >
                                <CheckCheck size={11} />
                                Apply when ready
                            </Button>
                        </div>
                    </div>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}
