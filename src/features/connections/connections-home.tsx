import { ArrowRight, Clock, Database, Loader2, Pencil, Plus, Server, Table2, WifiOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/kbd";
import { useAppStore } from "@/stores/useAppStore";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { DB_LOGO, DB_COLOR } from "@/components/shared/db-ui";
import { GROUP_PRESETS } from "@/features/connections/connection-dialog-modal";
import { ConnectionConfig } from "@/types";

function buildConnectionUrl(conn: ConnectionConfig): string {
	if (conn.uri) {
		try {
			const u = new URL(conn.uri);
			return `${u.protocol}//${u.username ? u.username + "@" : ""}${u.host}`;
		} catch {
			return conn.uri.slice(0, 60);
		}
	}
	const user = conn.user ? `${conn.user}@` : "";
	const host = conn.host ?? "localhost";
	const port = conn.port ? `:${conn.port}` : "";
	const db = conn.database ? `/${conn.database}` : "";
	return `${conn.type}://${user}${host}${port}${db}`;
}

function getEngineLabel(type: string): string {
	return type === "postgresql"
		? "PostgreSQL"
		: type === "mysql"
			? "MySQL"
			: type === "sqlite"
				? "SQLite"
				: type === "mongodb"
					? "MongoDB"
					: type === "redis"
						? "Redis"
						: type;
}

export function ConnectionsHome({
	connections,
	connectedIds,
	onNewConnection,
	onEdit,
	onConnect,
	onDisconnect,
	onOpenTable,
	connectingIds = [],
	cancellingIds = [],
	onCancelConnect,
}: {
	connections: ConnectionConfig[];
	connectedIds: string[];
	onNewConnection: () => void;
	onEdit: (conn: ConnectionConfig) => void;
	onConnect: (id: string) => void | Promise<void>;
	onDisconnect?: (id: string) => void;
	onOpenTable?: (connectionId: string, tableName: string, schema?: string) => void;
	connectingIds?: string[];
	cancellingIds?: string[];
	onCancelConnect?: (id: string) => void;
}) {
	if (connections.length === 0) {
		return (
			<div className="flex h-full items-center justify-center overflow-auto bg-card px-6 py-10">
				<div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
					<div className="rounded-lg border border-border bg-background p-8">
						<div className="flex items-start justify-between gap-6">
							<div className="min-w-0">
								<p className="shell-section-label">Connection Console</p>
								<h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight text-foreground text-balance">
									Create your first database connection
								</h2>
								<p className="mt-3 max-w-2xl text-[14px] leading-6 text-foreground/62 text-pretty">
									Save a local profile, test availability, and open your database workspace without leaving this screen.
								</p>
							</div>
							<div className="hidden size-14 shrink-0 items-center justify-center rounded-md border border-border bg-card text-foreground/70 md:flex">
								<Database size={22} />
							</div>
						</div>

						<div className="mt-8 grid gap-3 md:grid-cols-3">
							<div className="rounded-md border border-border bg-card px-4 py-3">
								<p className="text-[11px] font-medium text-muted-foreground">Profiles</p>
								<p className="mt-1 text-lg font-semibold text-foreground">Local</p>
							</div>
							<div className="rounded-md border border-border bg-card px-4 py-3">
								<p className="text-[11px] font-medium text-muted-foreground">Engines</p>
								<p className="mt-1 text-lg font-semibold text-foreground">5 supported</p>
							</div>
							<div className="rounded-md border border-border bg-card px-4 py-3">
								<p className="text-[11px] font-medium text-muted-foreground">Shortcuts</p>
								<p className="mt-1 flex items-center gap-1.5 text-lg font-semibold text-foreground">
									<Kbd className="text-[10px]">⌘N</Kbd>
									New
								</p>
							</div>
						</div>

						<Button
							onClick={onNewConnection}
							size="sm"
							className="mt-8 h-9 gap-1.5 px-4 text-[12px] font-medium"
						>
							<Plus size={12} />
							New Connection
							<Kbd className="ml-1 text-[10px]">⌘N</Kbd>
						</Button>
					</div>

					<div className="rounded-lg border border-border bg-background p-5">
						<p className="shell-section-label">Start With</p>
						<div className="mt-4 flex flex-col gap-3">
							{Object.entries(DB_LOGO).map(([type, Logo]) => (
								<div
									key={type}
									className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-3"
								>
									<div className="flex size-9 items-center justify-center rounded-md border border-border bg-popover">
										<Logo className={cn("text-lg", DB_COLOR[type])} />
									</div>
									<div className="min-w-0">
										<p className="text-sm font-semibold text-foreground">
											{getEngineLabel(type)}
										</p>
										<p className="text-[11px] text-muted-foreground">
											URI or manual fields
										</p>
									</div>
								</div>
							))}
						</div>
					</div>
				</div>
			</div>
		);
	}
	return (
		<div className="h-full overflow-auto scrollbar-thin bg-card">
			{/* Header */}
			<div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border bg-background px-6 py-4">
				<div className="flex min-w-0 items-center gap-3">
					<div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-card text-foreground/70">
						<Server size={18} />
					</div>
					<div className="min-w-0">
						<h2 className="text-[15px] font-semibold text-foreground">
							Connections
						</h2>
						<p className="mt-0.5 truncate text-[12px] text-foreground/70">
						{connectedIds.length > 0
							? `${connectedIds.length} of ${connections.length} connected`
							: `${connections.length} saved — not connected`}
						</p>
					</div>
				</div>
				<Button
					onClick={onNewConnection}
					size="sm"
					className="gap-1.5 text-[11px]"
				>
					<Plus size={12} />
					New Connection
					<Kbd className="ml-1 text-[10px]">⌘N</Kbd>
				</Button>
			</div>
			{/* Recent tables */}
			<RecentTablesSection onOpenTable={onOpenTable} />

			{/* Connection list */}
			<div className="mx-auto flex max-w-5xl flex-col gap-2 px-6 py-5">
				{connections.map((conn) => {
					const isConnected = connectedIds.includes(conn.id);
					const isConnecting = connectingIds.includes(conn.id);
					const isCancelling = cancellingIds.includes(conn.id);
					const Logo = DB_LOGO[conn.type] ?? DB_LOGO.postgresql;
					const logoColor =
						DB_COLOR[conn.type] ?? "text-muted-foreground";
					const url = buildConnectionUrl(conn);
					return (
						<div
							key={conn.id}
							className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-lg border border-border bg-background px-4 py-4 transition-colors hover:border-border/70 hover:bg-popover"
						>
							<div className="flex min-w-0 items-center gap-4">
								<div className="flex size-11 shrink-0 items-center justify-center rounded-md border border-border bg-card">
									<Logo
										className={cn(
											"text-[22px]",
											logoColor,
										)}
									/>
								</div>
								<div className="min-w-0">
									<div className="flex min-w-0 items-center gap-2">
										<p className="truncate text-[14px] font-semibold leading-tight text-foreground">
											{conn.name || conn.host || "Untitled"}
										</p>
										{conn.group && (() => {
											const preset = GROUP_PRESETS.find(p => p.id === conn.group);
											return (
												<Badge
													variant="outline"
													className={cn(
														"h-[18px] shrink-0 rounded-sm px-1.5 text-[9px] font-bold uppercase",
														preset ? preset.activeClass : "bg-muted/50 border-border/50 text-muted-foreground",
													)}
												>
													{conn.group}
												</Badge>
											);
										})()}
									</div>
									<p className="mt-1 truncate font-mono text-[12px] text-foreground/70">
										{url}
									</p>
								</div>
							</div>

							{/* Actions */}
							<div className="flex shrink-0 items-center gap-2">
								<Badge
									variant="outline"
									className={cn(
										"h-7 shrink-0 gap-1.5 rounded-md px-2.5 text-[10px] font-bold uppercase",
										isConnected
											? "border-success/30 bg-success/10 text-success"
											: "border-border bg-card text-foreground/70",
									)}
								>
									<span
										className={cn(
											"size-1.5 rounded-full",
											isConnected
												? "bg-success"
												: "bg-muted-foreground/30",
										)}
									/>
									{isConnected ? "Connected" : "Idle"}
								</Badge>
								<Tooltip>
									<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="icon-xs"
										aria-label={`Edit ${conn.name || conn.host || "connection"}`}
									className="size-7 rounded-sm text-foreground/70 hover:text-foreground"
									onClick={() => onEdit(conn)}
										>
											<Pencil size={12} />
										</Button>
									</TooltipTrigger>
									<TooltipContent side="top">
										Edit connection
									</TooltipContent>
								</Tooltip>
								{isConnected && onDisconnect && (
									<Tooltip>
										<TooltipTrigger asChild>
										<Button
										variant="ghost"
										size="icon-xs"
										aria-label={`Disconnect ${conn.name || conn.host || "connection"}`}
									className="size-7 rounded-sm text-foreground/70 transition-colors hover:bg-destructive/10 hover:text-destructive"
									onClick={() =>
												onDisconnect(conn.id)
											}
											>
												<WifiOff size={12} />
											</Button>
										</TooltipTrigger>
										<TooltipContent side="top">
											Disconnect
										</TooltipContent>
									</Tooltip>
								)}
								<Button
									size="sm"
									variant={
										isConnected ? "outline" : "default"
									}
									className="h-8 px-3.5 text-[12px] gap-1.5"
									disabled={isConnecting}
									onClick={() => onConnect(conn.id)}
								>
									{isConnecting && <Loader2 size={12} className="animate-spin" />}
									{isCancelling ? "Cancelling..." : isConnecting ? "Checking..." : isConnected ? "Open" : "Connect"}
									{!isConnecting && !isCancelling && <ArrowRight size={12} />}
								</Button>
								{isConnecting && !isCancelling && onCancelConnect && (
									<Button
										size="sm"
										variant="outline"
										className="h-8 rounded-sm px-3 text-[12px]"
										onClick={() => onCancelConnect(conn.id)}
									>
										Cancel
									</Button>
								)}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

function RecentTablesSection({ onOpenTable }: { onOpenTable?: (connectionId: string, tableName: string, schema?: string) => void }) {
    const { recentTables, clearRecentTables, connectionFunctions } = useAppStore();
    if (recentTables.length === 0) return null;
    return (
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-6 pt-5">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    <Clock size={11} />
                    Recent tables
                </div>
                <Button
                    variant="ghost"
                    size="xs"
                    onClick={clearRecentTables}
                    className="h-5 text-[10px] text-muted-foreground hover:text-foreground"
                >
                    <X size={10} />
                    Clear
                </Button>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {recentTables.map((entry) => {
                    const conn = useAppStore.getState().connections.find((c) => c.id === entry.connectionId);
                    const Logo = conn ? DB_LOGO[conn.type] : undefined;
                    const logoColor = conn ? DB_COLOR[conn.type] : "text-muted-foreground";
                    const fn = Object.values(connectionFunctions[entry.connectionId] ?? {}).flat().find(
                        (f) => f.type === "table" && f.tableName === entry.tableName && f.schema === entry.schema,
                    );
                    return (
                        <button
                            key={`${entry.connectionId}-${entry.tableName}-${entry.schema ?? ""}`}
                            disabled={!fn || !onOpenTable}
                            onClick={() => {
                                if (fn && onOpenTable) onOpenTable(entry.connectionId, entry.tableName, entry.schema);
                            }}
                            className="group flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5 text-left transition-colors hover:border-border/70 hover:bg-popover disabled:opacity-50"
                        >
                            {Logo ? (
                                <Logo className={cn("size-4 shrink-0", logoColor)} />
                            ) : (
                                <Table2 size={14} className="shrink-0 text-muted-foreground" />
                            )}
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[13px] font-semibold text-foreground">{entry.tableName}</p>
                                <p className="truncate text-[11px] text-muted-foreground">
                                    {conn?.name ?? entry.connectionId}
                                    {entry.schema ? <> · <span className="font-mono">{entry.schema}</span></> : null}
                                </p>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
