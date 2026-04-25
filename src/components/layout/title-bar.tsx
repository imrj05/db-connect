import { useState, useEffect, useRef, type CSSProperties } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
    Search,
    Settings,
    WifiOff,
    ChevronLeft,
    Pencil,
    ChevronDown,
    ExternalLink,
    PanelLeft,
    ScrollText,
    Database,
    KeyRound,
    RefreshCw,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { DB_LOGO, DB_COLOR } from "@/lib/db-ui";
import { Button } from "@/components/ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { GROUP_PRESETS } from "@/components/layout/ConnectionDialog";
import type { ConnectionConfig } from "@/types";
// Inline styles — only reliable way to set -webkit-app-region in Tauri 2
const noDragStyle: CSSProperties = {
    WebkitAppRegion: "no-drag",
} as CSSProperties;
// Drag the window on mousedown unless the click is on an interactive element
function handleTitleBarMouseDown(e: React.MouseEvent<HTMLElement>) {
    if (e.button !== 0) return; // left-click only
    if (e.detail >= 2) return; // skip on double-click — handled by onDoubleClick below
    const el = e.target as HTMLElement;
    if (el.closest("button, a, input, select, textarea, [data-no-drag]"))
        return;
    getCurrentWindow().startDragging();
}
// Double-click titlebar → maximize / restore
function handleTitleBarDoubleClick(e: React.MouseEvent<HTMLElement>) {
    const el = e.target as HTMLElement;
    if (el.closest("button, a, input, select, textarea, [data-no-drag]"))
        return;
    getCurrentWindow().toggleMaximize();
}
// Build a short display URL from a connection config
function buildDisplayUrl(conn: ConnectionConfig): string {
    if (conn.uri) {
        // Strip password from mongo/redis URI
        try {
            const u = new URL(conn.uri);
            return `${u.protocol}//${u.username ? u.username + "@" : ""}${u.host}`;
        } catch {
            return conn.uri.slice(0, 40);
        }
    }
    const proto = conn.type === "postgresql" ? "postgres" : conn.type;
    const host = conn.host ?? "localhost";
    const port = conn.port ? `:${conn.port}` : "";
    if (conn.type === "redis") {
        return `redis://${host}${port}`;
    }
    const user = conn.user ? `${conn.user}@` : "";
    const db = conn.database ? `/${conn.database}` : "";
    return `${proto}://${user}${host}${port}${db}`;
}
// ── TitleBar ────────────────────────────────────────────────────────────���─────
interface TitleBarProps {
    isLicensed?: boolean | null;
    onActivate?: () => void;
}

const TitleBar = ({ isLicensed, onActivate }: TitleBarProps) => {
    const {
        setCommandPaletteOpen,
        setActiveView,
        activeView,
        activeFunction,
        connectedIds,
        connections,
        disconnectConnection,
        setActiveFunctionOnly,
        setEditingConnection,
        setConnectionDialogOpen,
        setShowConnectionsManager,
        sidebarCollapsed,
        toggleSidebar,
        queryLogOpen,
        toggleQueryLog,
        connectionDatabases,
        selectedDatabases,
        selectDatabase,
        refreshDatabases,
        setActiveConnection,
    } = useAppStore();
    const [connMenuOpen, setConnMenuOpen] = useState(false);
    const connMenuRef = useRef<HTMLDivElement>(null);
    const [dbMenuOpen, setDbMenuOpen] = useState(false);
    const dbMenuRef = useRef<HTMLDivElement>(null);
    const isMac =
        typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
    useEffect(() => {
        if (!connMenuOpen) return;
        const handler = (e: MouseEvent) => {
            if (
                connMenuRef.current &&
                !connMenuRef.current.contains(e.target as Node)
            ) {
                setConnMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [connMenuOpen]);
    useEffect(() => {
        if (!dbMenuOpen) return;
        const handler = (e: MouseEvent) => {
            if (
                dbMenuRef.current &&
                !dbMenuRef.current.contains(e.target as Node)
            ) {
                setDbMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [dbMenuOpen]);
    // Resolve which connection is "active" — prefer the one tied to the active function
    const activeConn =
        (activeFunction
            ? connections.find((c) => c.id === activeFunction.connectionId)
            : null) ??
        connections.find((c) => connectedIds.includes(c.id)) ??
        null;
    const Logo = activeConn
        ? (DB_LOGO[activeConn.type] ?? DB_LOGO.postgresql)
        : null;
    const logoColor = activeConn
        ? (DB_COLOR[activeConn.type] ?? "text-muted-foreground")
        : "";
    const displayUrl = activeConn ? buildDisplayUrl(activeConn) : null;
    // Database picker state for active connection
    const activeDatabases = activeConn
        ? (connectionDatabases[activeConn.id] ?? [])
        : [];
    const selectedDb = activeConn
        ? (selectedDatabases[activeConn.id] ?? null)
        : null;
    const showDbPicker =
        activeConn &&
        connectedIds.includes(activeConn.id) &&
        activeDatabases.length > 0;
    // All currently connected connections, active-first
    const connectedConns = connections.filter((c) =>
        connectedIds.includes(c.id),
);
    const orderedConns = activeConn
        ? [activeConn, ...connectedConns.filter((c) => c.id !== activeConn.id)]
        : [];
    const leadingInset = isMac ? 78 : 12;
    return (
        <header
            onMouseDown={handleTitleBarMouseDown}
            onDoubleClick={handleTitleBarDoubleClick}
            className="relative z-40 h-10 bg-surface-1/95 border-b border-border-subtle flex items-center justify-between select-none shrink-0 cursor-default backdrop-blur-xl"
        >
            {/* ── Left: back arrow + DB logo + name + connection string ── */}
            <div
                className="flex items-center gap-3 pr-4 flex-1 min-w-0"
                style={{ paddingLeft: leadingInset }}
            >
                {activeFunction && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                style={noDragStyle}
                                variant="ghost"
                                size="icon-xs"
                                aria-label="Back"
                                onClick={() =>
                                    setActiveFunctionOnly(null as any)
                                }
                                className="size-7 rounded-md text-foreground/50 hover:text-foreground hover:bg-surface-2 shrink-0"
                            >
                                <ChevronLeft size={13} />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" sideOffset={4}>
                            Back
                        </TooltipContent>
                    </Tooltip>
                )}
                {activeConn && Logo ? (
                    <>
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-2 ring-1 ring-border-subtle shadow-xs">
                            <Logo
                                className={cn("text-[16px] shrink-0", logoColor)}
                            />
                        </div>
                        <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="text-[13px] font-semibold text-foreground truncate leading-none">
                                {activeConn.name}
                            </span>
                            {displayUrl && (
                                <span className="font-mono text-[11px] text-foreground/48 truncate max-w-[360px] leading-none">
                                    {displayUrl}
                                </span>
                            )}
                        </div>
                        {activeConn.group &&
                            (() => {
                                const preset = GROUP_PRESETS.find(
                                    (p) => p.id === activeConn.group,
                                );
                                return (
                                    <span
                                        className={cn(
                                            "shrink-0 px-2 h-7 flex items-center rounded-md text-[10px] font-semibold uppercase tracking-[0.12em] border",
                                            preset
                                                ? preset.activeClass
                                                : "bg-muted/50 border-border/50 text-muted-foreground/60",
                                        )}
                                    >
                                        {activeConn.group}
                                    </span>
                                );
                            })()}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    style={noDragStyle}
                                    variant="ghost"
                                    size="icon-xs"
                                    aria-label="Edit connection"
                                    onClick={() => {
                                        setEditingConnection(activeConn);
                                        setConnectionDialogOpen(true);
                                    }}
                                    className="size-7 rounded-md text-foreground/46 hover:text-foreground hover:bg-surface-2 shrink-0"
                                >
                                    <Pencil size={11} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" sideOffset={4}>
                                Edit connection
                            </TooltipContent>
                        </Tooltip>
                    </>
                ) : (
                    <span className="text-[11px] font-black uppercase tracking-[0.16em] text-foreground/48">
                        DB Connect
                    </span>
                )}
            </div>
            {/* ── Right: panel toggles · [Cmd+K] · Connection status · Settings ── */}
            <div className="flex items-center gap-1 pr-3 shrink-0">
                {/* Sidebar toggle */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            style={noDragStyle}
                            variant="outline"
                            size="sm"
                            aria-label={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
                            onClick={toggleSidebar}
                            className={cn(
                                "h-7 px-2.5 rounded-md border-transparent bg-transparent shadow-none text-[11px] font-medium transition-colors",
                                sidebarCollapsed
                                    ? "text-foreground/54 hover:text-foreground hover:bg-surface-2"
                                    : "text-foreground/66 hover:text-foreground hover:bg-surface-2",
                            )}
                        >
                            <PanelLeft size={10} className="shrink-0" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={4}>
                        {sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
                    </TooltipContent>
                </Tooltip>
                {/* Query log toggle */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            style={noDragStyle}
                            variant="outline"
                            size="sm"
                            aria-label={queryLogOpen ? "Hide query log" : "Show query log"}
                            onClick={toggleQueryLog}
                            className={cn(
                                "h-7 px-2.5 rounded-md border-transparent bg-transparent shadow-none text-[11px] font-medium transition-colors",
                                queryLogOpen
                                    ? "text-foreground/68 hover:text-foreground hover:bg-surface-2"
                                    : "text-foreground/54 hover:text-foreground hover:bg-surface-2",
                            )}
                        >
                            <ScrollText size={10} className="shrink-0" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={4}>
                        {queryLogOpen ? "Hide query log" : "Show query log"}
                    </TooltipContent>
                </Tooltip>
                <Button
                    style={noDragStyle}
                    variant="outline"
                    size="sm"
                    onClick={() => setCommandPaletteOpen(true)}
                    className="h-8 px-3 text-[12px] font-medium gap-1.5 text-foreground/72 hover:text-foreground border-border-subtle bg-surface-3/92 rounded-md"
                >
                    <Search size={10} className="shrink-0" />
                    <span className="hidden sm:inline">Search</span>
                    <span className="font-mono text-[10px] text-foreground/45">Cmd+K</span>
                </Button>
                {showDbPicker && (
                    <div
                        ref={dbMenuRef}
                        className="relative"
                        style={noDragStyle}
                    >
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDbMenuOpen((o) => !o)}
                            className="h-8 px-3 text-[11px] font-medium gap-1.5 text-foreground/68 border-border-subtle bg-surface-3/92 hover:text-foreground rounded-md"
                        >
                            <Database
                                size={10}
                                className="shrink-0 text-foreground/55"
                            />
                            <span className="max-w-[92px] truncate">
                                {selectedDb ?? "Select DB"}
                            </span>
                            <ChevronDown
                                size={9}
                                className="text-foreground/45 shrink-0"
                            />
                        </Button>
                        {dbMenuOpen && (
                            <div className="absolute right-0 top-full mt-1 w-52 z-[80] bg-popover/98 border border-border-subtle rounded-md shadow-md p-1 text-popover-foreground backdrop-blur-xl">
                                <div className="flex items-center justify-between px-2 py-1.5 mb-1">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/55">
                                        Databases
                                    </p>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon-xs"
                                                aria-label="Refresh databases"
                                                className="size-6 text-foreground/45 hover:text-foreground shrink-0"
                                                onClick={() => {
                                                    refreshDatabases(activeConn!.id);
                                                    setDbMenuOpen(false);
                                                }}
                                            >
                                                <RefreshCw size={9} />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" sideOffset={4}>
                                            Refresh databases
                                        </TooltipContent>
                                    </Tooltip>
                                </div>
                                {activeDatabases.map((db) => (
                                    <div
                                        key={db}
                                        className={cn(
                                            "flex items-center gap-2 px-2.5 py-2 rounded-md text-[12px] cursor-pointer hover:bg-surface-selected/82 transition-colors",
                                            db === selectedDb
                                                ? "font-bold text-foreground"
                                                : "text-foreground/78",
                                        )}
                                        onClick={() => {
                                            selectDatabase(activeConn!.id, db);
                                            setDbMenuOpen(false);
                                        }}
                                    >
                                        <Database
                                            size={10}
                                            className="shrink-0 text-muted-foreground/50"
                                        />
                                        <span className="truncate">{db}</span>
                                        {db === selectedDb && (
                                            <span className="ml-auto text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-md shrink-0">
                                                Active
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                {connectedConns.length > 0 && (
                    <div
                        ref={connMenuRef}
                        className="relative"
                        style={noDragStyle}
                    >
                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setConnMenuOpen((o) => !o)}
                            className="h-8 px-3 text-[11px] font-medium gap-1.5 text-foreground/68 border-border-subtle bg-surface-3/92 hover:text-foreground rounded-md"
                        >
                            {activeConn ? (
                                (() => {
                                    const L =
                                        DB_LOGO[activeConn.type] ??
                                        DB_LOGO.postgresql;
                                    return (
                                        <L
                                            className={cn(
                                                "text-[12px] shrink-0",
                                                DB_COLOR[activeConn.type] ??
                                                "text-muted-foreground",
                                            )}
                                        />
                                    );
                                })()
                            ) : (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                            )}
                            <span className="max-w-[112px] truncate">
                                {activeConn?.name ?? connectedConns[0].name}
                            </span>
                            {connectedConns.length > 1 && (
                                <span className="text-[10px] font-black text-foreground/45">
                                    +{connectedConns.length - 1}
                                </span>
                            )}
                            <ChevronDown
                                size={9}
                                className="text-foreground/45 shrink-0"
                            />
                        </Button>
                        {connMenuOpen && (
                            <div className="absolute right-0 top-full mt-1 w-80 z-[80] overflow-hidden rounded-lg border border-border-subtle bg-popover/98 text-popover-foreground shadow-lg backdrop-blur-xl">
                                <div className="flex items-center justify-between border-b border-border-subtle px-2.5 py-2">
                                    <div className="min-w-0">
                                        <p className="text-[12px] font-semibold leading-none text-foreground">
                                            Connections
                                        </p>
                                        <p className="mt-0.5 text-[10px] text-muted-foreground/60">
                                            {connectedConns.length} active
                                        </p>
                                    </div>
                                    <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                                        Live
                                    </span>
                                </div>
                                <div className="space-y-1 p-1.5">
                                {orderedConns.map((conn) => {
                                    const Logo =
                                        DB_LOGO[conn.type] ??
                                        DB_LOGO.postgresql;
                                    const color =
                                        DB_COLOR[conn.type] ??
                                        "text-muted-foreground";
                                    const url = buildDisplayUrl(conn);
                                    const isActive = conn.id === activeConn?.id;
                                    return (
                                        <div
                                            key={conn.id}
                                            className={cn(
                                                "group grid grid-cols-[24px_minmax(0,1fr)_24px] items-center gap-2.5 rounded-md px-2 py-2 transition-colors",
                                                isActive && "bg-surface-selected/64 ring-1 ring-border-subtle",
                                                !isActive &&
                                                "cursor-pointer hover:bg-surface-selected/58",
                                            )}
                                            onClick={() => {
                                                if (!isActive) {
                                                    setActiveConnection(
                                                        conn.id,
                                                    );
                                                    setConnMenuOpen(false);
                                                }
                                            }}
                                        >
                                            <span className={cn(
                                                "relative flex size-6 shrink-0 items-center justify-center rounded-md bg-surface-3 ring-1 ring-border-subtle",
                                                isActive && "bg-surface-elevated",
                                            )}>
                                                <Logo className={cn("text-[13px] shrink-0", color)} />
                                                <span
                                                    className={cn(
                                                        "absolute -right-0.5 -bottom-0.5 size-2 rounded-full border border-popover",
                                                        isActive ? "bg-emerald-500" : "bg-muted-foreground/35",
                                                    )}
                                                />
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex min-w-0 items-center gap-1.5">
                                                    <span
                                                        className={cn(
                                                            "min-w-0 truncate text-[12px] leading-none",
                                                            isActive
                                                                ? "font-semibold text-foreground"
                                                                : "font-medium text-foreground/82",
                                                        )}
                                                    >
                                                        {conn.name}
                                                    </span>
                                                    {isActive && (
                                                        <span className="shrink-0 rounded border border-emerald-500/20 bg-emerald-500/10 px-1 py-0.5 text-[9px] font-medium leading-none text-emerald-600 dark:text-emerald-400">
                                                            Active
                                                        </span>
                                                    )}
                                                    {conn.group &&
                                                        (() => {
                                                            const preset =
                                                                GROUP_PRESETS.find(
                                                                    (p) =>
                                                                        p.id ===
                                                                        conn.group,
                                                                );
                                                            return (
                                                                <span
                                                                    className={cn(
                                                                        "shrink-0 h-4 px-1.5 flex items-center rounded text-[9px] font-medium border leading-none",
                                                                        preset
                                                                            ? preset.activeClass
                                                                            : "bg-muted/50 border-border/50 text-muted-foreground/60",
                                                                    )}
                                                                >
                                                                    {conn.group}
                                                                </span>
                                                            );
                                                        })()}
                                                </div>
                                                <div className="mt-1 flex min-w-0 items-center gap-1.5">
                                                    <span className="shrink-0 rounded bg-surface-3 px-1 py-0.5 text-[9px] font-medium leading-none text-muted-foreground/70">
                                                        {conn.type === "postgresql" ? "Postgres" : conn.type}
                                                    </span>
                                                    <span className="min-w-0 truncate font-mono text-[10px] leading-none text-foreground/50">
                                                        {url}
                                                    </span>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon-xs"
                                                aria-label={`Disconnect ${conn.name}`}
                                                className="size-6 shrink-0 text-foreground/38 opacity-70 transition-colors hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 dark:hover:bg-destructive/15"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    disconnectConnection(
                                                        conn.id,
                                                    );
                                                }}
                                            >
                                                <WifiOff size={10} />
                                            </Button>
                                        </div>
                                    );
                                })}
                                </div>
                                <div className="h-px bg-border-subtle" />
                                <div
                                    className="flex cursor-pointer items-center gap-2 px-3 py-2 text-[12px] font-medium text-foreground/72 transition-colors hover:bg-surface-selected/58 hover:text-foreground"
                                    onClick={() => {
                                        setConnMenuOpen(false);
                                        setActiveView("main");
                                        setShowConnectionsManager(true);
                                    }}
                                >
                                    <ExternalLink
                                        size={11}
                                        className="text-muted-foreground"
                                    />
                                    Manage connections
                                </div>
                            </div>
                        )}
                    </div>
                )}
                {/* License badge — only shown when check is done and not licensed */}
                {isLicensed === false && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                style={noDragStyle}
                                variant="outline"
                                size="sm"
                                onClick={onActivate}
                                className="h-8 px-3 gap-1.5 border-amber-500/35 bg-amber-500/8 text-amber-700 dark:text-amber-300 hover:bg-amber-500/12 hover:border-amber-500/50 rounded-md"
                        >
                            <KeyRound size={10} className="shrink-0" />
                            <span className="text-[11px] font-semibold">Activate</span>
                        </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" sideOffset={4}>
                            License not activated — click to activate
                        </TooltipContent>
                    </Tooltip>
                )}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            style={noDragStyle}
                            variant="outline"
                            size="sm"
                            aria-label="Settings"
                            onClick={() => setActiveView(activeView === "settings" ? "main" : "settings")}
                            className="h-7 px-2.5 rounded-md border-transparent bg-transparent text-foreground/48 hover:text-foreground hover:bg-surface-2"
                        >
                            <Settings size={11} className="shrink-0" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={4}>
                        {activeView === "settings" ? "Close settings" : "Settings"}
                    </TooltipContent>
                </Tooltip>
            </div>
        </header>
    );
};
export default TitleBar;
