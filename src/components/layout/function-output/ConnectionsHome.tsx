import { Database, Plus, Pencil, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { DB_LOGO, DB_COLOR } from "@/lib/db-ui";
import { GROUP_PRESETS } from "@/components/layout/ConnectionDialog";
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

export function ConnectionsHome({
	connections,
	connectedIds,
	onNewConnection,
	onEdit,
	onConnect,
	onDisconnect,
}: {
	connections: ConnectionConfig[];
	connectedIds: string[];
	onNewConnection: () => void;
	onEdit: (conn: ConnectionConfig) => void;
	onConnect: (id: string) => void;
	onDisconnect?: (id: string) => void;
}) {
	if (connections.length === 0) {
		return (
			<div className="h-full flex flex-col items-center justify-center bg-surface-2/72 gap-4 px-6">
				<div className="w-14 h-14 rounded-2xl bg-surface-3 border border-border-subtle flex items-center justify-center shadow-sm">
					<Database size={24} className="text-foreground/32" />
				</div>
				<div className="text-center space-y-1.5">
					<p className="text-[12px] font-bold uppercase tracking-[0.16em] text-foreground/56">
						No connections
					</p>
					<p className="text-[13px] text-foreground/58">
						Add your first database connection to get started
					</p>
				</div>
				<Button
					onClick={onNewConnection}
					size="sm"
					className="mt-1 gap-1.5 text-xs"
				>
					<Plus size={12} />
					New Connection
				</Button>
			</div>
		);
	}
	return (
		<div className="h-full overflow-auto scrollbar-thin bg-surface-2/72">
			{/* Header */}
			<div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle sticky top-0 bg-surface-2/94 backdrop-blur-md z-10">
				<div>
					<h2 className="text-[15px] font-semibold text-foreground">
						Connections
					</h2>
					<p className="text-[12px] text-foreground/54 mt-0.5">
						{connectedIds.length > 0
							? `${connectedIds.length} of ${connections.length} connected`
							: `${connections.length} saved — not connected`}
					</p>
				</div>
				<Button
					onClick={onNewConnection}
					size="sm"
					className="gap-1.5 text-[11px]"
				>
					<Plus size={12} />
					New Connection
				</Button>
			</div>
			{/* Connection list */}
			<div className="px-6 py-5 space-y-3 max-w-3xl">
				{connections.map((conn) => {
					const isConnected = connectedIds.includes(conn.id);
					const Logo = DB_LOGO[conn.type] ?? DB_LOGO.postgresql;
					const logoColor =
						DB_COLOR[conn.type] ?? "text-muted-foreground";
					const url = buildConnectionUrl(conn);
					return (
						<div
							key={conn.id}
							className="flex items-center gap-4 px-4 py-4 border border-border-subtle rounded-2xl bg-surface-3 hover:bg-surface-elevated hover:border-border/70 transition-colors shadow-sm"
						>
							{/* DB logo */}
							<Logo
								className={cn(
									"text-[22px] shrink-0",
									logoColor,
								)}
							/>
							{/* Name + URL */}
							<div className="flex-1 min-w-0">
								<div className="flex items-center gap-2">
									<p className="text-[14px] font-semibold text-foreground leading-tight truncate">
										{conn.name || conn.host || "Untitled"}
									</p>
									{conn.group && (() => {
										const preset = GROUP_PRESETS.find(p => p.id === conn.group);
										return (
											<span className={cn(
												"shrink-0 px-1.5 h-[15px] flex items-center rounded text-[9px] font-bold uppercase tracking-wide border",
												preset ? preset.activeClass : "bg-muted/50 border-border/50 text-muted-foreground/60"
											)}>
												{conn.group}
											</span>
										);
									})()}
								</div>
								<p className="text-[12px] font-mono text-foreground/52 truncate mt-0.5">
									{url}
								</p>
							</div>
							{/* Status badge */}
							<div
								className={cn(
									"flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide shrink-0 px-3 py-1 rounded-full",
									isConnected
										? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
										: "text-foreground/54 bg-surface-2",
								)}
							>
								<span
									className={cn(
										"w-1.5 h-1.5 rounded-full shrink-0",
										isConnected
											? "bg-emerald-500"
											: "bg-muted-foreground/30",
									)}
								/>
								{isConnected ? "Connected" : "Idle"}
							</div>
							{/* Actions */}
							<div className="flex items-center gap-1.5 shrink-0">
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="ghost"
											size="icon-xs"
											className="size-7 text-foreground/46 hover:text-foreground"
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
											className="size-7 text-foreground/46 hover:text-destructive hover:bg-destructive/10 transition-colors"
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
									className="text-[12px] h-8 px-3.5"
									onClick={() => onConnect(conn.id)}
								>
									{isConnected ? "Open" : "Connect"}
								</Button>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
