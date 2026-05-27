import { ArrowRight, Database, Loader2, Pencil, Plus, Server, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/kbd";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { DB_LOGO, DB_COLOR } from "@/lib/db-ui";
import { GROUP_PRESETS } from "@/components/layout/connection-dialog-modal";
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
	connectingIds?: string[];
	cancellingIds?: string[];
	onCancelConnect?: (id: string) => void;
}) {
	if (connections.length === 0) {
		return (
			<div className="flex h-full items-center justify-center overflow-auto bg-surface-2 px-6 py-10">
				<div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
					<div className="rounded-lg border border-border-subtle bg-surface-1 p-8">
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
							<div className="hidden size-14 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-surface-2 text-foreground/40 md:flex">
								<Database size={22} />
							</div>
						</div>

						<div className="mt-8 grid gap-3 md:grid-cols-3">
							<div className="rounded-md border border-border-subtle bg-surface-2 px-4 py-3">
								<p className="text-[11px] font-medium text-muted-foreground/66">Profiles</p>
								<p className="mt-1 text-lg font-semibold text-foreground">Local</p>
							</div>
							<div className="rounded-md border border-border-subtle bg-surface-2 px-4 py-3">
								<p className="text-[11px] font-medium text-muted-foreground/66">Engines</p>
								<p className="mt-1 text-lg font-semibold text-foreground">5 supported</p>
							</div>
							<div className="rounded-md border border-border-subtle bg-surface-2 px-4 py-3">
								<p className="text-[11px] font-medium text-muted-foreground/66">Shortcuts</p>
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

					<div className="rounded-lg border border-border-subtle bg-surface-1 p-5">
						<p className="shell-section-label">Start With</p>
						<div className="mt-4 flex flex-col gap-3">
							{Object.entries(DB_LOGO).map(([type, Logo]) => (
								<div
									key={type}
									className="flex items-center gap-3 rounded-md border border-border-subtle bg-surface-2 px-3 py-3"
								>
									<div className="flex size-9 items-center justify-center rounded-md border border-border-subtle bg-surface-elevated">
										<Logo className={cn("text-lg", DB_COLOR[type])} />
									</div>
									<div className="min-w-0">
										<p className="text-sm font-semibold text-foreground">
											{getEngineLabel(type)}
										</p>
										<p className="text-[11px] text-muted-foreground/58">
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
		<div className="h-full overflow-auto scrollbar-thin bg-surface-2">
			{/* Header */}
			<div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border-subtle bg-surface-1 px-6 py-4">
				<div className="flex min-w-0 items-center gap-3">
					<div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-surface-2 text-foreground/45">
						<Server size={18} />
					</div>
					<div className="min-w-0">
						<h2 className="text-[15px] font-semibold text-foreground">
							Connections
						</h2>
						<p className="mt-0.5 truncate text-[12px] text-foreground/54">
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
							className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-lg border border-border-subtle bg-surface-1 px-4 py-4 transition-colors hover:border-border/70 hover:bg-surface-elevated"
						>
							<div className="flex min-w-0 items-center gap-4">
								<div className="flex size-11 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-surface-2">
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
														preset ? preset.activeClass : "bg-muted/50 border-border/50 text-muted-foreground/60",
													)}
												>
													{conn.group}
												</Badge>
											);
										})()}
									</div>
									<p className="mt-1 truncate font-mono text-[12px] text-foreground/52">
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
											? "border-accent-green/30 bg-accent-green/10 text-accent-green"
											: "border-border-subtle bg-surface-2 text-foreground/54",
									)}
								>
									<span
										className={cn(
											"size-1.5 rounded-full",
											isConnected
												? "bg-accent-green"
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
									className="size-7 rounded-sm text-foreground/46 hover:text-foreground"
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
									className="size-7 rounded-sm text-foreground/46 transition-colors hover:bg-destructive/10 hover:text-destructive"
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
