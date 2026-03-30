import { useState, useMemo, useEffect } from "react";
import { Reorder } from "framer-motion";
import {
    ChevronDown,
    ChevronRight,
    Plus,
    Loader2,
    Plug,
    Search,
    Table2,
    Database,
    Folder,
    FolderOpen,
    Key,
    Clock,
    Hash,
    AlignJustify,
    Braces,
    ToggleLeft,
    CircleDot,
    HardDrive,
    ChevronsDown,
    ChevronsUp,
    RefreshCw,
    TableProperties,
    X,
    GripVertical,
    ArrowUpDown,
} from "lucide-react";
import {
    SiPostgresql,
    SiMysql,
    SiSqlite,
    SiMongodb,
    SiRedis,
} from "react-icons/si";
import { useAppStore } from "@/store/useAppStore";
import { GROUP_PRESETS } from "@/components/layout/ConnectionDialog";
import { ImportExportDialog } from "@/components/layout/ImportExportDialog";
import { tauriApi } from "@/lib/tauri-api";
import { ConnectionConfig, ConnectionFunction, ColumnInfo, DatabaseType } from "@/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ── DB type logos ──────────────────────────────────────────────────────────────
const DB_LOGO: Record<string, React.FC<{ className?: string }>> = {
    postgresql: ({ className }) => <SiPostgresql className={className} />,
    mysql:      ({ className }) => <SiMysql      className={className} />,
    sqlite:     ({ className }) => <SiSqlite     className={className} />,
    mongodb:    ({ className }) => <SiMongodb    className={className} />,
    redis:      ({ className }) => <SiRedis      className={className} />,
};

const DB_COLOR: Record<string, string> = {
    postgresql: "text-blue-400",
    mysql:      "text-cyan-400",
    sqlite:     "text-slate-400",
    mongodb:    "text-emerald-400",
    redis:      "text-red-400",
};

// ── Column type → icon ─────────────────────────────────────────────────────────
function ColumnIcon({ col }: { col: ColumnInfo }) {
    const t = col.dataType?.toLowerCase() ?? "";
    if (col.isPrimary)
        return <Key size={9} className="shrink-0 text-accent-orange/70" />;
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

// ── Column row ─────────────────────────────────────────────────────────────────
function ColumnRow({ col }: { col: ColumnInfo }) {
    return (
        <div className="flex items-center gap-1.5 h-[22px] pl-1 pr-2 text-muted-foreground/55 hover:text-muted-foreground transition-colors">
            <ColumnIcon col={col} />
            <span className="text-[10px] font-mono truncate flex-1">{col.name}</span>
            <span className="text-[9px] font-mono text-muted-foreground/30 shrink-0">
                {col.dataType}
            </span>
        </div>
    );
}

// ── Middle-truncate long table names ──────────────────────────────────────────
function midTruncate(name: string, max = 26): string {
    if (name.length <= max) return name;
    const front = Math.ceil((max - 1) * 0.55);
    const back  = Math.floor((max - 1) * 0.45);
    return `${name.slice(0, front)}…${name.slice(-back)}`;
}

// ── Table row ──────────────────────────────────────────────────────────────────
function TableRow({
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
                        {/* expand chevron — always visible */}
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

// ── Schema group ───────────────────────────────────────────────────────────────
function SchemaGroup({
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
                    className="w-full flex items-center gap-1.5 h-[26px] pl-1 pr-2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                >
                    <span className="flex items-center justify-center w-4 shrink-0 text-muted-foreground/30">
                        {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                    </span>
                    {open
                        ? <FolderOpen size={11} className="shrink-0 text-muted-foreground/40" />
                        : <Folder     size={11} className="shrink-0 text-muted-foreground/30" />}
                    <span className="text-[10px] font-mono flex-1 text-left">{schema}</span>
                    <span className="text-[9px] font-mono text-muted-foreground/70">{fns.length}</span>
                </button>
            )}

            {open && (
                <div className={cn("w-full min-w-0 overflow-hidden", showLabel ? "pl-4" : "")}>
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

// ── Create-table column builder helpers ────────────────────────────────────────
type ColDef = { id: string; name: string; type: string; nullable: boolean; isPrimary: boolean; defaultValue: string; comment: string };

const COL_TYPES: Record<DatabaseType, string[]> = {
    postgresql: ["TEXT","INTEGER","BIGINT","BOOLEAN","TIMESTAMP","FLOAT","DECIMAL","JSON","UUID","SERIAL","VARCHAR(255)"],
    mysql:      ["VARCHAR(255)","INT","BIGINT","TEXT","BOOLEAN","DATETIME","FLOAT","DOUBLE","DECIMAL","JSON"],
    sqlite:     ["TEXT","INTEGER","REAL","BLOB","NUMERIC"],
    mongodb:    [],
    redis:      [],
};

function qi(n: string, dbType: string): string {
    return dbType === "mysql" ? `\`${n}\`` : `"${n}"`;
}

function buildCreateTableSql(tableName: string, cols: ColDef[], dbType: string): string {
    const pkCols = cols.filter((c) => c.isPrimary);
    const colLines = cols.map((c) => {
        const parts = [qi(c.name, dbType), c.type];
        if (!c.nullable && !c.isPrimary) parts.push("NOT NULL");
        if (c.isPrimary && pkCols.length === 1) parts.push("PRIMARY KEY");
        if (c.defaultValue.trim()) parts.push(`DEFAULT ${c.defaultValue.trim()}`);
        if (c.comment.trim() && dbType === "mysql") parts.push(`COMMENT '${c.comment.trim().replace(/'/g, "''")}'`);
        return "  " + parts.join(" ");
    });
    if (pkCols.length > 1)
        colLines.push(`  PRIMARY KEY (${pkCols.map((c) => qi(c.name, dbType)).join(", ")})`);
    const create = `CREATE TABLE ${qi(tableName, dbType)} (\n${colLines.join(",\n")}\n)`;
    // PostgreSQL/SQLite: emit COMMENT ON COLUMN after CREATE TABLE
    if (dbType !== "mysql") {
        const comments = cols
            .filter((c) => c.comment.trim())
            .map((c) => `COMMENT ON COLUMN ${qi(tableName, dbType)}.${qi(c.name, dbType)} IS '${c.comment.trim().replace(/'/g, "''")}';`);
        if (comments.length) return create + ";\n\n" + comments.join("\n");
    }
    return create;
}

// ── Database node ──────────────────────────────────────────────────────────────
function DatabaseNode({
    connection,
    isConnected,
    isLoading,
    tableFns,
    tableInfoMap,
    activeFunctionId,
    filter,
    selectedDb,
    onConnect,
    onInvoke,
    onRefreshTables,
    onAddTable,
    onLoadColumns,
}: {
    connection: ConnectionConfig;
    isConnected: boolean;
    isLoading: boolean;
    tableFns: ConnectionFunction[];
    tableInfoMap: Record<string, ColumnInfo[]>;
    activeFunctionId?: string;
    filter: string;
    selectedDb?: string;
    onConnect: () => void;
    onInvoke: (fn: ConnectionFunction) => void;
    onRefreshTables: () => Promise<void>;
    onAddTable: (sql: string) => Promise<void>;
    onLoadColumns: (tableName: string) => Promise<void>;
}) {
    const [open, setOpen] = useState(true);

    // Tables section state
    const [expandAll, setExpandAll] = useState<boolean | null>(null);
    const [isRefreshingTables, setIsRefreshingTables] = useState(false);
    const [addTableOpen, setAddTableOpen] = useState(false);
    const dtType = connection.type === "postgresql" ? "TIMESTAMPTZ" : connection.type === "sqlite" ? "TEXT" : "DATETIME";
    const idType = connection.type === "mysql" ? "INT" : "INTEGER";
    const defaultCols = (): ColDef[] => [
        { id: "c0", name: "id",         type: idType, nullable: false, isPrimary: true,  defaultValue: "", comment: "Primary key" },
        { id: "c1", name: "created_at", type: dtType, nullable: false, isPrimary: false, defaultValue: "CURRENT_TIMESTAMP", comment: "Record creation timestamp" },
        { id: "c2", name: "updated_at", type: dtType, nullable: false, isPrimary: false, defaultValue: "CURRENT_TIMESTAMP", comment: "Record last update timestamp" },
    ];
    const [newTableName, setNewTableName] = useState("");
    const [colDefs, setColDefs] = useState<ColDef[]>(defaultCols);
    const [createTableLoading, setCreateTableLoading] = useState(false);
    const [createTableError, setCreateTableError] = useState<string | null>(null);

    const handleRefreshTables = async () => {
        setIsRefreshingTables(true);
        try {
            await Promise.all([onRefreshTables(), new Promise((r) => setTimeout(r, 800))]);
        } finally {
            setIsRefreshingTables(false);
        }
    };

    const resetCreateTable = () => {
        setNewTableName("");
        setColDefs(defaultCols());
        setCreateTableError(null);
    };

    const executeCreateTable = async () => {
        if (!newTableName.trim() || colDefs.length === 0) return;
        setCreateTableLoading(true);
        setCreateTableError(null);
        try {
            const sql = buildCreateTableSql(newTableName.trim(), colDefs, connection.type);
            await onAddTable(sql);
            setAddTableOpen(false);
            resetCreateTable();
        } catch (e) {
            setCreateTableError(String(e));
        } finally {
            setCreateTableLoading(false);
        }
    };

    const Logo = DB_LOGO[connection.type] ?? DB_LOGO.postgresql;
    const logoColor = DB_COLOR[connection.type] ?? "text-muted-foreground";

    // filter tables
    const filtered = useMemo(() => {
        const q = filter.trim().toLowerCase();
        if (!q) return tableFns;
        return tableFns.filter((f) =>
            (f.tableName ?? "").toLowerCase().includes(q),
        );
    }, [tableFns, filter]);

    // group by schema
    const bySchema = useMemo(() => {
        const groups: Record<string, ConnectionFunction[]> = {};
        for (const fn of filtered) {
            const schema = tableInfoMap[fn.tableName ?? ""]
                ? Object.keys(tableInfoMap).length > 0
                    ? (fn as any).schema ?? "public"
                    : "public"
                : "public";
            (groups[schema] ??= []).push(fn);
        }
        return groups;
    }, [filtered, tableInfoMap]);

    const schemaKeys = Object.keys(bySchema);
    const showSchemaLabels = schemaKeys.length > 1 || (schemaKeys.length === 1 && schemaKeys[0] !== "public");

    return (
        <div className="border-b border-border/50">
            {/* DB name row */}
            <button
                onClick={() => isConnected ? setOpen((v) => !v) : onConnect()}
                className={cn(
                    "group w-full flex items-center gap-2 h-8 px-2 transition-colors select-none",
                    "hover:bg-muted/40 text-foreground",
                )}
            >
                <span className="text-muted-foreground/40 shrink-0 w-3">
                    {isConnected
                        ? open ? <ChevronDown size={11} /> : <ChevronRight size={11} />
                        : <ChevronRight size={11} />}
                </span>
                <Logo className={cn("text-[14px] shrink-0", logoColor)} />
                <span className="text-[12px] font-mono font-semibold flex-1 text-left truncate min-w-0">
                    {connection.name}
                </span>
                {connection.group && (() => {
                    const preset = GROUP_PRESETS.find(p => p.id === connection.group);
                    return (
                        <span className={cn(
                            "shrink-0 px-1.5 h-[14px] flex items-center rounded text-[8px] font-bold uppercase tracking-wide border",
                            preset ? preset.activeClass : "bg-muted/50 border-border/50 text-muted-foreground/60"
                        )}>
                            {connection.group}
                        </span>
                    );
                })()}
                {isLoading && <Loader2 size={10} className="animate-spin text-muted-foreground/40 shrink-0" />}
                {!isConnected && !isLoading && (
                    <Plug size={10} className="text-muted-foreground/70 shrink-0 group-hover:text-primary/60 transition-colors" />
                )}
            </button>

            {/* Tables header */}
            {isConnected && open && (
                <div className="flex items-center gap-1 h-7 px-2 border-b border-border/30 shrink-0">
                    <TableProperties size={11} className="shrink-0 text-muted-foreground/30" />
                    <span className="text-[9px] font-mono font-bold uppercase tracking-[0.18em] text-muted-foreground/35 flex-1">
                        Tables
                    </span>
                    {!isLoading && tableFns.length > 0 && (
                        <span className="text-[9px] font-mono text-muted-foreground/40 tabular-nums mr-0.5">
                            {filter.trim() ? `${filtered.length}/` : ""}{tableFns.length}
                        </span>
                    )}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                onClick={() => { resetCreateTable(); setAddTableOpen(true); }}
                                className="flex items-center justify-center w-5 h-5 text-muted-foreground/35 hover:text-foreground transition-colors"
                            >
                                <Plus size={11} />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" sideOffset={4}>Add table</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                onClick={handleRefreshTables}
                                disabled={isRefreshingTables}
                                className="flex items-center justify-center w-5 h-5 text-muted-foreground/35 hover:text-foreground transition-colors disabled:opacity-40"
                            >
                                <RefreshCw size={11} className={isRefreshingTables ? "animate-spin" : ""} />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" sideOffset={4}>Refresh tables</TooltipContent>
                    </Tooltip>
                    {tableFns.length > 0 && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => setExpandAll((v) => v === true ? false : true)}
                                    className="flex items-center justify-center w-5 h-5 text-muted-foreground/35 hover:text-foreground transition-colors"
                                >
                                    {expandAll === true ? <ChevronsUp size={11} /> : <ChevronsDown size={11} />}
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="right" sideOffset={4}>
                                {expandAll === true ? "Collapse all" : "Expand all"}
                            </TooltipContent>
                        </Tooltip>
                    )}
                </div>
            )}

            {/* Add Table dialog */}
            <Dialog open={addTableOpen} onOpenChange={(v) => { setAddTableOpen(v); if (!v) setCreateTableError(null); }}>
                <DialogContent className="!max-w-4xl !flex !flex-col !h-[90vh]">
                    <DialogHeader className="shrink-0">
                        <DialogTitle>Add Table</DialogTitle>
                        <DialogDescription className="font-mono">
                            on <span className="text-foreground/70">{selectedDb ?? connection.name}</span>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col gap-3 flex-1 min-h-0">
                        {/* Table name */}
                        <div className="flex items-center gap-3 shrink-0">
                            <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground shrink-0">
                                Table Name
                            </Label>
                            <Input
                                value={newTableName}
                                onChange={(e) => setNewTableName(e.target.value)}
                                placeholder="e.g. users"
                                className="h-8 text-[12px] font-mono flex-1"
                                autoComplete="off"
                            />
                        </div>

                        {/* Columns */}
                        <div className="flex flex-col gap-1.5 flex-1 min-h-0">
                            <div className="flex items-center justify-between shrink-0">
                                <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                                    Columns
                                </Label>
                                <Button
                                    variant="ghost"
                                    size="xs"
                                    className="h-6 text-[10px] gap-1 text-muted-foreground"
                                    onClick={() =>
                                        setColDefs((prev) => [
                                            ...prev,
                                            {
                                                id: `c${Date.now()}`,
                                                name: "",
                                                type: COL_TYPES[connection.type as DatabaseType]?.[0] ?? "TEXT",
                                                nullable: true,
                                                isPrimary: false,
                                                defaultValue: "",
                                                comment: "",
                                            },
                                        ])
                                    }
                                >
                                    <Plus size={10} /> Add column
                                </Button>
                            </div>

                            <Reorder.Group
                                axis="y"
                                values={colDefs}
                                onReorder={setColDefs}
                                className="flex flex-col gap-1 flex-1 overflow-y-auto"
                            >
                                {colDefs.map((col) => (
                                    <Reorder.Item key={col.id} value={col} className="flex items-center gap-2 bg-background">
                                        <span className="cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground/60 shrink-0 touch-none">
                                            <GripVertical size={12} />
                                        </span>
                                        <Input
                                            value={col.name}
                                            onChange={(e) =>
                                                setColDefs((prev) =>
                                                    prev.map((c) => c.id === col.id ? { ...c, name: e.target.value } : c),
                                                )
                                            }
                                            placeholder="name"
                                            className="h-7 text-[11px] font-mono w-28 shrink-0"
                                            autoComplete="off"
                                        />
                                        <Select
                                            value={col.type}
                                            onValueChange={(v) =>
                                                setColDefs((prev) =>
                                                    prev.map((c) => c.id === col.id ? { ...c, type: v } : c),
                                                )
                                            }
                                        >
                                            <SelectTrigger className="h-7 text-[11px] font-mono w-32 shrink-0">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {(COL_TYPES[connection.type as DatabaseType] ?? ["TEXT"]).map((t) => (
                                                    <SelectItem key={t} value={t} className="text-[11px] font-mono">
                                                        {t}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <button
                                                    onClick={() =>
                                                        setColDefs((prev) =>
                                                            prev.map((c) => c.id === col.id ? { ...c, nullable: !c.nullable } : c),
                                                        )
                                                    }
                                                    className={cn(
                                                        "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border transition-colors shrink-0",
                                                        col.nullable
                                                            ? "border-border text-muted-foreground"
                                                            : "border-primary/40 text-primary",
                                                    )}
                                                >
                                                    NULL
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent>Toggle nullable</TooltipContent>
                                        </Tooltip>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <button
                                                    onClick={() =>
                                                        setColDefs((prev) =>
                                                            prev.map((c) => c.id === col.id ? { ...c, isPrimary: !c.isPrimary } : c),
                                                        )
                                                    }
                                                    className={cn(
                                                        "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border transition-colors shrink-0",
                                                        col.isPrimary
                                                            ? "border-primary/40 text-primary"
                                                            : "border-border text-muted-foreground",
                                                    )}
                                                >
                                                    PK
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent>Toggle primary key</TooltipContent>
                                        </Tooltip>
                                        <Input
                                            value={col.defaultValue}
                                            onChange={(e) =>
                                                setColDefs((prev) =>
                                                    prev.map((c) => c.id === col.id ? { ...c, defaultValue: e.target.value } : c),
                                                )
                                            }
                                            placeholder="default"
                                            className="h-7 text-[11px] font-mono w-28 shrink-0"
                                            autoComplete="off"
                                        />
                                        <Textarea
                                            value={col.comment}
                                            onChange={(e) =>
                                                setColDefs((prev) =>
                                                    prev.map((c) => c.id === col.id ? { ...c, comment: e.target.value } : c),
                                                )
                                            }
                                            placeholder="comment"
                                            className="text-[11px] font-mono flex-1 min-h-0 h-7 resize-none py-1"
                                            autoComplete="off"
                                        />
                                        {colDefs.length > 1 && (
                                            <Button
                                                variant="ghost"
                                                size="icon-xs"
                                                className="text-muted-foreground/40 hover:text-destructive shrink-0"
                                                onClick={() => setColDefs((prev) => prev.filter((c) => c.id !== col.id))}
                                            >
                                                <X size={10} />
                                            </Button>
                                        )}
                                    </Reorder.Item>
                                ))}
                            </Reorder.Group>
                        </div>

                        {createTableError && (
                            <p className="text-[11px] text-destructive font-mono shrink-0">{createTableError}</p>
                        )}
                    </div>

                    <DialogFooter className="shrink-0">
                        <Button variant="outline" size="sm" onClick={() => setAddTableOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            disabled={!newTableName.trim() || colDefs.length === 0 || createTableLoading}
                            onClick={executeCreateTable}
                        >
                            {createTableLoading ? "Creating…" : "Create Table"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Tree */}
            {isConnected && open && (
                <div className="pb-1">
                    {isLoading ? (
                        <div className="flex items-center gap-2 px-4 py-2">
                            <Loader2 size={10} className="animate-spin text-muted-foreground/30" />
                            <span className="text-[10px] font-mono text-muted-foreground/30">Loading…</span>
                        </div>
                    ) : tableFns.length === 0 ? (
                        <p className="px-4 py-2 text-[10px] font-mono text-muted-foreground/30">
                            No tables
                        </p>
                    ) : filtered.length === 0 ? (
                        <p className="px-4 py-2 text-[10px] font-mono text-muted-foreground/30">
                            No match
                        </p>
                    ) : (
                        <div className="pl-2 w-full min-w-0 overflow-hidden">
                            {schemaKeys.map((schema) => (
                                <SchemaGroup
                                    key={schema}
                                    schema={schema}
                                    fns={bySchema[schema]}
                                    tableInfoMap={tableInfoMap}
                                    activeFunctionId={activeFunctionId}
                                    onInvoke={onInvoke}
                                    showLabel={showSchemaLabels}
                                    forceOpen={expandAll}
                                    onLoadColumns={onLoadColumns}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Main Sidebar ───────────────────────────────────────────────────────────────
const Sidebar = () => {
    const {
        connections,
        connectedIds,
        connectionFunctions,
        connectionTables,
        selectedDatabases,
        openDatabases,
        activeFunction,
        connectAndInit,
        selectDatabase,
        closeOpenDatabase,
        refreshTables,
        loadTableColumns,
        invokeFunction,
        setActiveFunctionOnly,
        setConnectionDialogOpen,
        setEditingConnection,
        addConnection,
        setActiveConnection,
    } = useAppStore();

    const [filter, setFilter] = useState("");
    const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
    const [importExportOpen, setImportExportOpen] = useState(false);
    const [dbCtxMenu, setDbCtxMenu] = useState<{ db: string; x: number; y: number } | null>(null);

    const handleConnect = async (connId: string) => {
        setLoadingIds((prev) => new Set(prev).add(connId));
        try {
            await connectAndInit(connId);
        } finally {
            setLoadingIds((prev) => {
                const next = new Set(prev);
                next.delete(connId);
                return next;
            });
        }
    };

    // active connection: prefer activeFunction's connection, then first connected
    const activeConn = useMemo(() => {
        return (activeFunction
            ? connections.find((c) => c.id === activeFunction.connectionId)
            : null) ?? connections.find((c) => connectedIds.includes(c.id)) ?? null;
    }, [activeFunction, connections, connectedIds]);

    const currentDb = useMemo(() => {
        if (!activeConn) return null;
        return selectedDatabases[activeConn.id] ?? activeConn.database ?? null;
    }, [activeConn, selectedDatabases]);

    const handleInvoke = (fn: ConnectionFunction) => {
        if (fn.type === "query" || fn.type === "execute") {
            setActiveFunctionOnly(fn);
        } else {
            invokeFunction(fn);
        }
    };

    const activeDatabases = activeConn ? (openDatabases[activeConn.id] ?? []) : [];
    const selectedDb = activeConn ? (selectedDatabases[activeConn.id] ?? null) : null;

    return (
        <div className="h-full flex bg-sidebar border-r border-sidebar-border overflow-hidden min-h-0">

            {/* ── Left: open database tabs ── */}
            {activeDatabases.length > 0 && (
                <div className="flex flex-col shrink-0 border-r border-border bg-sidebar overflow-y-auto" style={{ width: 64 }}>
                    {activeDatabases.map((db) => {
                        const isActive = db === selectedDb;
                        return (
                            <button
                                key={db}
                                onClick={() => selectDatabase(activeConn!.id, db)}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setDbCtxMenu({ db, x: rect.right + 4, y: e.clientY });
                                }}
                                title={db}
                                className={cn(
                                    "flex flex-col items-center gap-1.5 py-3 px-1 w-full transition-colors border-r-2 shrink-0",
                                    isActive
                                        ? "border-r-primary bg-background text-foreground"
                                        : "border-r-transparent text-muted-foreground/40 hover:text-muted-foreground/70 hover:bg-muted/20"
                                )}
                            >
                                <Database
                                    size={18}
                                    className={cn("shrink-0", isActive ? "text-primary/70" : "text-muted-foreground/30")}
                                />
                                <span className="text-[8px] font-mono leading-tight text-center break-all line-clamp-2 w-full px-0.5">
                                    {db}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* ── DB tab context menu ── */}
            {dbCtxMenu && activeConn && (() => {
                const menuW = 172;
                const menuH = 96;
                const left = dbCtxMenu.x;
                const top = Math.min(dbCtxMenu.y, window.innerHeight - menuH - 8);
                return (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setDbCtxMenu(null)}
                        onContextMenu={(e) => { e.preventDefault(); setDbCtxMenu(null); }}
                    />
                    <div
                        className="fixed z-50 bg-popover border border-border rounded-lg shadow-xl p-1 text-popover-foreground"
                        style={{ top, left, width: menuW }}
                    >
                        <div className="px-2 py-1 mb-1">
                            <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-muted-foreground/40 truncate max-w-[140px]">
                                {dbCtxMenu.db}
                            </p>
                        </div>
                        <button
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-[11px] text-foreground/80 hover:bg-muted/40 transition-colors"
                            onClick={() => {
                                refreshTables(activeConn.id, dbCtxMenu.db);
                                if (selectedDb !== dbCtxMenu.db) selectDatabase(activeConn.id, dbCtxMenu.db);
                                setDbCtxMenu(null);
                            }}
                        >
                            <RefreshCw size={10} className="shrink-0 text-muted-foreground/60" />
                            Refresh DB
                        </button>
                        <div className="my-1 h-px bg-border" />
                        <button
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-[11px] text-destructive/80 hover:bg-destructive/10 transition-colors"
                            onClick={() => {
                                closeOpenDatabase(activeConn.id, dbCtxMenu.db);
                                setDbCtxMenu(null);
                            }}
                        >
                            <X size={10} className="shrink-0" />
                            Close DB
                        </button>
                    </div>
                </>
                );
            })()}

            {/* ── Right: main content ── */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">

            {/* ── Header ── */}
            <div className="h-10 flex items-center justify-between px-3 border-b border-border shrink-0">
                <span className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-muted-foreground/40">
                    Explorer
                </span>
                <div className="flex items-center gap-1">
                    {loadingIds.size > 0 && (
                        <Loader2 size={10} className="animate-spin text-muted-foreground/40" />
                    )}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => setImportExportOpen(true)}
                                className="text-muted-foreground/40 hover:text-foreground"
                            >
                                <ArrowUpDown size={14} />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" sideOffset={4}>Import / Export</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => {
                                    setEditingConnection(null);
                                    setConnectionDialogOpen(true);
                                }}
                                className="text-muted-foreground/40 hover:text-foreground"
                            >
                                <Plus size={14} />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" sideOffset={4}>New connection</TooltipContent>
                    </Tooltip>
                </div>
            </div>

            {/* ── Filter ── */}
            {connections.length > 0 && (
                <div className="px-2 py-1.5 border-b border-border shrink-0">
                    <div className="relative">
                        <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/30 pointer-events-none" />
                        <Input
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            placeholder="Filter tables…"
                            className="h-7 pl-6 pr-2 text-[11px] font-mono bg-muted/30 border-border/40 placeholder:text-muted-foreground/30 focus-visible:ring-0 focus-visible:border-primary/40"
                        />
                    </div>
                </div>
            )}

            {/* ── Tree ── */}
            {connections.length === 0 ? (
                <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-4 px-4 pb-10">
                    <div className="size-10 border border-border flex items-center justify-center">
                        <Database size={18} className="text-muted-foreground/70" />
                    </div>
                    <div className="text-center space-y-1">
                        <p className="text-[10px] font-mono font-bold text-muted-foreground/40 uppercase tracking-widest">
                            No connections
                        </p>
                        <p className="text-[9px] font-mono text-muted-foreground/70">
                            Add a database to get started
                        </p>
                    </div>
                    <Button
                        size="sm"
                        onClick={() => { setEditingConnection(null); setConnectionDialogOpen(true); }}
                        className="h-7 text-[10px] font-mono font-bold uppercase tracking-widest gap-1.5"
                    >
                        <Plus size={11} />
                        Add Connection
                    </Button>
                </div>
            ) : (
                <ScrollArea className="flex-1 min-h-0">
                    <div className="py-1">
                        {activeConn ? (() => {
                            const conn = activeConn;
                            const fns = connectionFunctions[conn.id] ?? [];
                            const tableFns = fns.filter((f) => f.type === "table");
                            const tables = connectionTables[conn.id] ?? [];
                            const tableInfoMap: Record<string, ColumnInfo[]> =
                                Object.fromEntries(tables.map((t) => [t.name, t.columns ?? []]));
                            return (
                                <DatabaseNode
                                    key={conn.id}
                                    connection={conn}
                                    isConnected={connectedIds.includes(conn.id)}
                                    isLoading={loadingIds.has(conn.id)}
                                    tableFns={tableFns}
                                    tableInfoMap={tableInfoMap}
                                    activeFunctionId={activeFunction?.id}
                                    filter={filter}
                                    selectedDb={selectedDatabases[conn.id]}
                                    onConnect={() => handleConnect(conn.id)}
                                    onInvoke={handleInvoke}
                                    onRefreshTables={() => refreshTables(conn.id)}
                                    onAddTable={async (sql) => {
                                        const result = await tauriApi.executeQuery(conn.id, sql);
                                        if (result.error) throw new Error(result.error);
                                        await refreshTables(conn.id);
                                    }}
                                    onLoadColumns={(tableName) => loadTableColumns(conn.id, tableName)}
                                />
                            );
                        })() : (
                            <div className="flex flex-col items-center justify-center gap-3 py-8 px-4 text-center">
                                <p className="text-[10px] font-mono text-muted-foreground/40">No active connection</p>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            )}

            {/* ── Status Footer ── always pinned to bottom */}
            <div className="shrink-0 border-t border-border px-3 h-7 flex items-center gap-2 bg-sidebar overflow-hidden">
                <CircleDot
                    size={8}
                    className={cn("shrink-0", connectedIds.length > 0 ? "text-primary" : "text-muted-foreground/50")}
                />
                <span className="text-[10px] font-mono shrink-0 whitespace-nowrap">
                    <span className={connectedIds.length > 0 ? "text-primary" : "text-muted-foreground/70"}>{connectedIds.length}</span>
                    <span className="text-muted-foreground/60">/{connections.length} conn</span>
                </span>
                <span className="text-muted-foreground/40 shrink-0">·</span>
                <HardDrive size={8} className="shrink-0 text-muted-foreground/50" />
                <span className="text-[10px] font-mono truncate text-muted-foreground/70 min-w-0">
                    {currentDb ?? <span className="text-muted-foreground/40">no db</span>}
                </span>
            </div>

            </div>{/* end right content */}

            {importExportOpen && (
                <ImportExportDialog
                    onClose={() => setImportExportOpen(false)}
                    onImportComplete={(newConns) => {
                        newConns.forEach((c) => addConnection(c));
                    }}
                />
            )}
        </div>
    );
};

export default Sidebar;
