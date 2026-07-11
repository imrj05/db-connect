import { useEffect, useState } from "react";
import { Database, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type DumpOptions = {
    includeData: boolean;
    includeIndexes: boolean;
    includeForeignKeys: boolean;
    createDatabase: boolean;
    schema: string;
};

type DumpDatabaseDialogProps = {
    open: boolean;
    databaseName: string;
    dbType: string;
    loading: boolean;
    onCancel: () => void;
    onConfirm: (opts: DumpOptions) => void;
};

function OptionRow({
    id,
    checked,
    onChange,
    label,
    description,
    disabled = false,
}: {
    id: string;
    checked: boolean;
    onChange: (v: boolean) => void;
    label: string;
    description: string;
    disabled?: boolean;
}) {
    return (
        <div
            className={cn(
                "flex items-center justify-between rounded-lg px-3 py-2.5 border border-border bg-muted/20 gap-3",
                disabled && "opacity-40",
            )}
        >
            <Label
                htmlFor={id}
                className={cn(
                    "flex flex-col gap-0.5 flex-1",
                    !disabled && "cursor-pointer",
                )}
            >
                <span className="text-[11px] font-semibold">{label}</span>
                <span className="text-[10px] text-muted-foreground font-normal leading-snug">
                    {description}
                </span>
            </Label>
            <Checkbox
                id={id}
                checked={checked}
                disabled={disabled}
                onCheckedChange={(v) => onChange(v === true)}
            />
        </div>
    );
}

export function DumpDatabaseDialog({
    open,
    databaseName,
    dbType,
    loading,
    onCancel,
    onConfirm,
}: DumpDatabaseDialogProps) {
    const [includeData, setIncludeData] = useState(true);
    const [includeIndexes, setIncludeIndexes] = useState(true);
    const [includeForeignKeys, setIncludeForeignKeys] = useState(true);
    const [createDatabase, setCreateDatabase] = useState(dbType !== "sqlite");
    const [schema, setSchema] = useState("public");

    // Reset state whenever the dialog opens
    useEffect(() => {
        if (open) {
            setIncludeData(true);
            setIncludeIndexes(true);
            setIncludeForeignKeys(true);
            setCreateDatabase(dbType !== "sqlite");
            setSchema("public");
        }
    }, [open, dbType]);

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                if (!o && !loading) onCancel();
            }}
        >
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Database size={14} />
                        Dump Database
                        <Badge
                            variant="secondary"
                            className="font-mono text-[10px] px-1.5 py-0"
                        >
                            {databaseName}
                        </Badge>
                    </DialogTitle>
                    <DialogDescription>
                        Export the entire database schema and data as a SQL script.
                        {dbType === "postgresql" && (
                            <> Creating the database requires superuser privileges.</>
                        )}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-3 py-1">
                    {/* Schema input — PostgreSQL only */}
                    {dbType === "postgresql" && (
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                Schema
                            </Label>
                            <Input
                                value={schema}
                                onChange={(e) => setSchema(e.target.value)}
                                placeholder="public"
                                className="font-mono text-[12px] h-8"
                                disabled={loading}
                            />
                        </div>
                    )}

                    {/* Options */}
                    <div className="flex flex-col gap-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                            Options
                        </Label>
                        <div className="flex flex-col gap-1.5">
                            <OptionRow
                                id="dump-include-data"
                                checked={includeData}
                                onChange={setIncludeData}
                                disabled={loading}
                                label="Include table data"
                                description="Emit INSERT statements for all rows"
                            />
                            <OptionRow
                                id="dump-include-indexes"
                                checked={includeIndexes}
                                onChange={setIncludeIndexes}
                                disabled={loading}
                                label="Include indexes"
                                description="Emit CREATE INDEX statements for all indexes"
                            />
                            <OptionRow
                                id="dump-include-fk"
                                checked={includeForeignKeys}
                                onChange={setIncludeForeignKeys}
                                disabled={loading}
                                label="Include foreign key constraints"
                                description={
                                    dbType === "sqlite"
                                        ? "FK relationships emitted as comments (SQLite limitation)"
                                        : "Emit ALTER TABLE … ADD CONSTRAINT statements"
                                }
                            />
                            <OptionRow
                                id="dump-create-db"
                                checked={createDatabase}
                                onChange={setCreateDatabase}
                                disabled={loading || dbType === "sqlite"}
                                label="Create database if not exists"
                                description={
                                    dbType === "sqlite"
                                        ? "Not applicable for SQLite"
                                        : dbType === "postgresql"
                                          ? "Adds a \\connect directive and superuser note"
                                          : "Emits CREATE DATABASE IF NOT EXISTS"
                                }
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={onCancel}
                        disabled={loading}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() =>
                            onConfirm({
                                includeData,
                                includeIndexes,
                                includeForeignKeys,
                                createDatabase,
                                schema,
                            })
                        }
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <Loader2 size={12} className="animate-spin" />
                                Generating…
                            </>
                        ) : (
                            "Dump & Save"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
