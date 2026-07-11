import { useState } from "react";
import { Plus, GripVertical, X, ChevronsUpDown, Check, Eye, EyeOff, Table2, ToggleLeft, ToggleRight } from "lucide-react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Command,
    CommandEmpty,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { FieldInput } from "@/components/ui/field-input";
import { DatabaseType } from "@/types";
function TypeCombobox({
    value,
    types,
    onChange,
}: {
    value: string;
    types: string[];
    onChange: (v: string) => void;
}) {
    const [open, setOpen] = useState(false);
    return (
        <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
            <PopoverPrimitive.Trigger asChild>
                <button
                    role="combobox"
                    aria-expanded={open}
                    className={cn(
                        "h-5 md:h-6 px-2 shrink-0 flex items-center justify-between gap-1 rounded border transition-all text-[9px] md:text-[10px] font-mono",
                        "hover:bg-muted/50 focus-visible:ring-1 focus-visible:ring-ring/50",
                        open
                            ? "border-ring bg-muted/40 text-foreground"
                            : "border-border/60 bg-muted/30 text-foreground/80 hover:border-border"
                    )}
                >
                    <span className="truncate max-w-[80px] md:max-w-[100px]">{value}</span>
                    <ChevronsUpDown className="size-3 shrink-0 opacity-50" />
                </button>
            </PopoverPrimitive.Trigger>
            <PopoverPrimitive.Content
                side="bottom"
                align="start"
                sideOffset={4}
                avoidCollisions
                collisionPadding={8}
                style={{ zIndex: 200 }}
                className={cn(
                    "w-48 md:w-56 rounded-md border border-border/60 bg-popover p-1 text-popover-foreground shadow-xl overflow-hidden",
                    "origin-[--radix-popover-content-transform-origin]",
                    "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-top-2",
                    "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
                )}
            >
                <Command>
                    <CommandInput placeholder="Search..." className="text-[10px] md:text-[11px] font-mono h-7 md:h-8" />
                    <CommandList className="max-h-40 md:max-h-56">
                        <CommandEmpty className="text-[10px] md:text-[11px] py-4 md:py-6 text-center text-muted-foreground">No type found.</CommandEmpty>
                        {types.map((t) => (
                            <CommandItem
                                key={t}
                                value={t}
                                onSelect={() => { onChange(t); setOpen(false); }}
                                className={cn(
                                    "text-[10px] md:text-[11px] font-mono py-1.5 md:py-2 px-2 cursor-pointer hover:bg-accent",
                                    "data-[selected=true]:text-foreground",
                                    value === t && "text-primary font-medium"
                                )}
                            >
                                <span className="flex-1 truncate">{t}</span>
                                {value === t && <Check className="size-3 shrink-0 text-primary ml-2" />}
                            </CommandItem>
                        ))}
                    </CommandList>
                </Command>
            </PopoverPrimitive.Content>
        </PopoverPrimitive.Root>
    );
}
type ColDef = {
    id: string;
    name: string;
    type: string;
    nullable: boolean;
    isPrimary: boolean;
    defaultValue: string;
    comment: string;
};
const COL_TYPES: Record<DatabaseType, string[]> = {
    postgresql: [
        "TEXT", "VARCHAR(255)", "CHAR(1)",
        "INTEGER", "SMALLINT", "BIGINT", "SERIAL", "BIGSERIAL",
        "BOOLEAN",
        "FLOAT", "REAL", "DOUBLE PRECISION", "DECIMAL", "NUMERIC", "MONEY",
        "TIMESTAMP", "TIMESTAMPTZ", "DATE", "TIME", "TIMETZ", "INTERVAL",
        "JSON", "JSONB",
        "UUID",
        "BYTEA",
        "INET", "CIDR", "MACADDR",
        "TSVECTOR", "TSQUERY",
        "OID",
    ],
    mysql: [
        "VARCHAR(255)", "CHAR(1)", "TINYTEXT", "TEXT", "MEDIUMTEXT", "LONGTEXT",
        "TINYINT", "SMALLINT", "MEDIUMINT", "INT", "BIGINT",
        "BOOLEAN",
        "FLOAT", "DOUBLE", "DECIMAL",
        "DATE", "DATETIME", "TIMESTAMP", "TIME", "YEAR",
        "JSON",
        "BINARY", "VARBINARY(255)", "TINYBLOB", "BLOB", "MEDIUMBLOB", "LONGBLOB",
        "ENUM", "SET",
    ],
    sqlite: [
        "TEXT", "VARCHAR(255)", "CHAR(1)",
        "INTEGER",
        "REAL",
        "BLOB",
        "NUMERIC", "BOOLEAN",
        "DATE", "DATETIME",
        "JSON",
    ],
    mongodb: [],
    redis: [],
};
function qi(n: string, dbType: string, dbPrefix?: string): string {
    const quoted = dbType === "mysql" ? `\`${n}\`` : `"${n}"`;
    return dbPrefix ? `${dbType === "mysql" ? `\`${dbPrefix}\`` : `"${dbPrefix}"`}.${quoted}` : quoted;
}
function buildCreateTableSql(tableName: string, cols: ColDef[], dbType: string, database?: string): string {
    const pkCols = cols.filter((c) => c.isPrimary);
    const colLines = cols.map((c) => {
        const parts = [qi(c.name, dbType, database), c.type];
        if (!c.nullable && !c.isPrimary) parts.push("NOT NULL");
        if (c.isPrimary && pkCols.length === 1) parts.push("PRIMARY KEY");
        if (c.defaultValue.trim()) parts.push(`DEFAULT ${c.defaultValue.trim()}`);
        if (c.comment.trim() && dbType === "mysql") parts.push(`COMMENT '${c.comment.trim().replace(/'/g, "''")}'`);
        return "  " + parts.join(" ");
    });
    if (pkCols.length > 1)
        colLines.push(`  PRIMARY KEY (${pkCols.map((c) => qi(c.name, dbType, database)).join(", ")})`);
    const create = `CREATE TABLE ${qi(tableName, dbType, database)} (\n${colLines.join(",\n")}\n)`;
    if (dbType !== "mysql") {
        const comments = cols
            .filter((c) => c.comment.trim())
            .map((c) => `COMMENT ON COLUMN ${qi(tableName, dbType, database)}.${qi(c.name, dbType, database)} IS '${c.comment.trim().replace(/'/g, "''")}';`);
        if (comments.length) return create + ";\n\n" + comments.join("\n");
    }
    return create;
}
export function AddTableDialog({
    open,
    onOpenChange,
    connectionType,
    connectionName,
    selectedDb,
    onAddTable,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    connectionType: DatabaseType;
    connectionName: string;
    selectedDb?: string;
    onAddTable: (sql: string) => Promise<void>;
}) {
    const dtType = connectionType === "postgresql" ? "TIMESTAMPTZ" : connectionType === "sqlite" ? "TEXT" : "DATETIME";
    const idType = connectionType === "mysql" ? "INT" : "INTEGER";
    const defaultCols = (): ColDef[] => [
        { id: "c0", name: "id", type: idType, nullable: false, isPrimary: true, defaultValue: "AUTO_INCREMENT" in {} ? "" : "", comment: "Primary key" },
        { id: "c1", name: "created_at", type: dtType, nullable: false, isPrimary: false, defaultValue: "CURRENT_TIMESTAMP", comment: "Record creation timestamp" },
        { id: "c2", name: "updated_at", type: dtType, nullable: false, isPrimary: false, defaultValue: "CURRENT_TIMESTAMP", comment: "Record last update timestamp" },
    ];
    const [newTableName, setNewTableName] = useState("");
    const [colDefs, setColDefs] = useState<ColDef[]>(defaultCols());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPreview, setShowPreview] = useState(true);
    const types = COL_TYPES[connectionType] ?? ["TEXT"];
    const sqlPreview = buildCreateTableSql(newTableName || "table_name", colDefs, connectionType, selectedDb);
    const reset = () => {
        setNewTableName("");
        setColDefs(defaultCols());
        setError(null);
    };
    const handleOpenChange = (v: boolean) => {
        onOpenChange(v);
        if (!v) setError(null);
    };
    const handleCreate = async () => {
        if (!newTableName.trim() || colDefs.length === 0) return;
        setLoading(true);
        setError(null);
        try {
            const sql = buildCreateTableSql(newTableName.trim(), colDefs, connectionType, selectedDb);
            await onAddTable(sql);
            onOpenChange(false);
            reset();
        } catch (e) {
            setError(String(e));
        } finally {
            setLoading(false);
        }
    };
    const addColumn = () => {
        setColDefs((prev) => [
            ...prev,
            {
                id: `c${Date.now()}`,
                name: "",
                type: types[0] ?? "TEXT",
                nullable: true,
                isPrimary: false,
                defaultValue: "",
                comment: "",
            },
        ]);
    };
    const removeColumn = (id: string) => {
        if (colDefs.length > 1) {
            setColDefs((prev) => prev.filter((c) => c.id !== id));
        }
    };
    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="flex flex-col gap-0 overflow-hidden rounded-md p-0" style={{ maxWidth: '80vw', maxHeight: '80vh', width: 'calc(100vw - 2rem)' }}>
                {/* Header */}
                <DialogHeader className="shrink-0 px-3 md:px-4 py-2 md:py-2.5 border-b border-border-subtle bg-surface-2/72">
                    <div className="flex items-center gap-2">
                        <div className="size-7 rounded-md border border-primary/18 bg-primary/8 md:size-8 flex items-center justify-center shrink-0">
                            <Table2 size={14} className="text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <DialogTitle className="text-xs md:text-sm font-semibold">Create New Table</DialogTitle>
                            <DialogDescription className="text-[9px] md:text-[10px] font-mono truncate">
                                in <span className="text-foreground/70">{selectedDb ?? connectionName}</span>
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>
                {/* Body - Scrollable */}
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col gap-2 md:gap-3 p-3 md:p-4">
                    {/* Column Config */}
                    <div className="flex flex-col gap-2 md:gap-3 min-h-0 overflow-hidden" style={{ maxHeight: showPreview ? '45%' : '100%' }}>
                        {/* Table Name */}
                        <FieldInput
                            inline
                            prefix="tb_"
                            prefixWidth="w-7"
                            value={newTableName}
                            onChange={(e) => setNewTableName(e.target.value)}
                            placeholder="users"
                            className="flex-1 h-7 md:h-8"
                            autoComplete="off"
                        />
                        {/* Column List */}
                        <div className="flex flex-col gap-1.5 flex-1 min-h-0 overflow-hidden">
                            <div className="flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-2">
                                    <Label className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                        Columns ({colDefs.length})
                                    </Label>
                                    <Button
                                        variant="ghost"
                                        size="icon-xs"
                                        className="h-4 w-4 text-muted-foreground/40 hover:text-foreground"
                                        onClick={() => setShowPreview(!showPreview)}
                                    >
                                        {showPreview ? <EyeOff size={9} /> : <Eye size={9} />}
                                    </Button>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 md:h-6 text-[9px] md:text-[10px] gap-1 text-muted-foreground hover:text-foreground hover:bg-accent shrink-0"
                                    onClick={addColumn}
                                >
                                    <Plus size={9} /> <span className="hidden sm:inline">Add Column</span>
                                </Button>
                            </div>
                            {/* Column Cards - Scrollable */}
                            <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin overscroll-contain">
                                {colDefs.map((col, index) => (
                                    <div
                                        key={col.id}
                                        className={cn(
                                            "rounded-md border transition-all p-1.5 md:p-2",
                                            col.isPrimary
                                                ? "border-primary/30 bg-primary/10 dark:bg-primary/5"
                                                : "border-border/60 bg-card hover:border-border"
                                        )}
                                    >
                                        {/* Column Header - Responsive Grid */}
                                        <div className="flex items-center gap-1 md:gap-1.5 mb-1.5 md:mb-2">
                                            <span className="cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground/50 shrink-0 hidden sm:block">
                                                <GripVertical size={10} />
                                            </span>
                                            <span className={cn(
                                                "text-[8px] md:text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded shrink-0",
                                                index === 0 ? "bg-accent-blue/10 text-accent-blue" : "bg-muted text-muted-foreground"
                                            )}>
                                                #{index + 1}
                                            </span>
                                            <Input
                                                value={col.name}
                                                onChange={(e) =>
                                                    setColDefs((prev) =>
                                                        prev.map((c) => c.id === col.id ? { ...c, name: e.target.value } : c),
                                                    )
                                                }
                                                placeholder="column_name"
                                                className="h-5 md:h-6 text-[9px] md:text-[10px] font-mono flex-1 bg-muted/30 focus-visible:ring-1 focus-visible:ring-ring/50"
                                                autoComplete="off"
                                            />
                                            {colDefs.length > 1 && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon-xs"
                                                    className="size-5 text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 shrink-0"
                                                    onClick={() => removeColumn(col.id)}
                                                >
                                                    <X size={10} />
                                                </Button>
                                            )}
                                        </div>
                                        {/* Column Body - Responsive */}
                                        <div className="space-y-1 md:space-y-1.5">
                                            {/* Type */}
                                            <div className="flex items-center gap-1.5 md:gap-2">
                                                <span className="text-[8px] md:text-[9px] text-muted-foreground/60 w-7 md:w-8 shrink-0">Type</span>
                                                <TypeCombobox
                                                    value={col.type}
                                                    types={types}
                                                    onChange={(v) =>
                                                        setColDefs((prev) =>
                                                            prev.map((c) => c.id === col.id ? { ...c, type: v } : c)
                                                        )
                                                    }
                                                />
                                            </div>
                                            {/* Properties - Wrapped */}
                                            <div className="flex flex-wrap items-center gap-1 md:gap-1.5">
                                                <span className="text-[8px] md:text-[9px] text-muted-foreground/60 w-7 md:w-8 shrink-0">Props</span>
                                                <div className="flex flex-wrap items-center gap-1">
                                                    {/* Nullable Toggle */}
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <button
                                                                onClick={() =>
                                                                    setColDefs((prev) =>
                                                                        prev.map((c) => c.id === col.id ? { ...c, nullable: !c.nullable } : c),
                                                                    )
                                                                }
                                                                className={cn(
                                                                    "flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] md:text-[9px] font-medium transition-all shrink-0",
                                                                    col.nullable
                                                                        ? "bg-accent-green/10 text-accent-green border border-accent-green/20"
                                                                        : "bg-muted text-muted-foreground/60 border border-transparent hover:border-border"
                                                                )}
                                                            >
                                                                {col.nullable ? <ToggleRight size={9} /> : <ToggleLeft size={9} />}
                                                                <span className="hidden sm:inline">NULL</span>
                                                            </button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>Allow NULL values</TooltipContent>
                                                    </Tooltip>
                                                    {/* PK Toggle */}
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <button
                                                                onClick={() =>
                                                                    setColDefs((prev) =>
                                                                        prev.map((c) => c.id === col.id ? { ...c, isPrimary: !c.isPrimary } : c),
                                                                    )
                                                                }
                                                                className={cn(
                                                                    "flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] md:text-[9px] font-medium transition-all shrink-0",
                                                                    col.isPrimary
                                                                        ? "bg-primary/10 text-primary border border-primary/20"
                                                                        : "bg-muted text-muted-foreground/60 border border-transparent hover:border-border"
                                                                )}
                                                            >
                                                                <KeyIcon className={cn("size-2.5", col.isPrimary ? "text-primary" : "text-muted-foreground/40")} />
                                                                <span className="hidden sm:inline">PK</span>
                                                            </button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>Primary Key</TooltipContent>
                                                    </Tooltip>
                                                </div>
                                            </div>
                                            {/* Default Value */}
                                            <FieldInput
                                                prefix="Default"
                                                prefixWidth="w-7 md:w-8"
                                                value={col.defaultValue}
                                                onChange={(e) =>
                                                    setColDefs((prev) =>
                                                        prev.map((c) => c.id === col.id ? { ...c, defaultValue: e.target.value } : c),
                                                    )
                                                }
                                                placeholder="CURRENT_TIMESTAMP"
                                                autoComplete="off"
                                            />
                                            {/* Comment */}
                                            <FieldInput
                                                prefix="Comment"
                                                prefixWidth="w-7 md:w-8"
                                                value={col.comment}
                                                onChange={(e) =>
                                                    setColDefs((prev) =>
                                                        prev.map((c) => c.id === col.id ? { ...c, comment: e.target.value } : c),
                                                    )
                                                }
                                                placeholder="Column description..."
                                                autoComplete="off"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {error && (
                                <div className="shrink-0 bg-destructive/10 border border-destructive/20 rounded px-2 py-1.5">
                                    <p className="text-[9px] md:text-[10px] text-destructive font-mono truncate">{error}</p>
                                </div>
                            )}
                        </div>
                    </div>
                    {/* SQL Preview - Bottom */}
                    {showPreview && (
                        <div className="flex flex-col min-h-[20vh] flex-1 overflow-hidden rounded border border-border/60 bg-code-preview-bg">
                            <div className="shrink-0 px-2 py-1.5 border-b border-border/50 bg-code-preview-header-bg">
                                <Label className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                    SQL Preview
                                </Label>
                            </div>
                            <div className="flex-1 overflow-auto p-2 md:p-3 bg-code-preview-bg">
                                <pre className="text-[9px] md:text-[10px] font-mono leading-relaxed whitespace-pre-wrap text-code-preview-text">{sqlPreview}</pre>
                            </div>
                        </div>
                    )}
                </div>
                {/* Footer */}
                <div className="shrink-0 flex flex-col sm:flex-row items-center justify-between gap-2 rounded-b-md border-t border-border-subtle bg-surface-2/72 px-3 py-2 md:px-4 md:py-3 sm:gap-4">
                    <div className="text-[8px] md:text-[9px] text-muted-foreground/50 hidden sm:block">
                        Press <kbd className="px-1 py-0.5 bg-muted rounded text-[7px] md:text-[8px] font-mono">Enter</kbd> to create
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onOpenChange(false)}
                            className="flex-1 sm:flex-none text-[10px]"
                        >
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            disabled={!newTableName.trim() || colDefs.length === 0 || loading}
                            onClick={handleCreate}
                            className="gap-1 flex-1 sm:flex-none text-[10px]"
                        >
                            {loading ? (
                                <>
                                    <div className="size-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                                    <span className="hidden sm:inline">Creating...</span>
                                </>
                            ) : (
                                <>
                                    <Plus size={11} />
                                    Create Table
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
function KeyIcon({ className }: { className?: string }) {
    return (
        <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
        </svg>
    );
}
