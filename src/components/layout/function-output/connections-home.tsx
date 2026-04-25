import { Database, Plus, Pencil, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
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
			<div className="flex h-full flex-col items-center justify-center gap-4 bg-surface-2 px-6">
				<div className="flex h-16 w-16 items-center justify-center border border-border-subtle bg-surface-3">
					<Database size={24} className="text-foreground/32" />
				</div>
				<div className="text-center space-y-1.5">
					<p className="text-[12px] font-semibold text-muted-foreground">
						Get Started
					</p>
					<h2 className="text-[22px] font-semibold tracking-tight text-foreground text-balance">
						Create your first database connection
					</h2>
					<p className="text-[14px] text-foreground/58 text-pretty">
						Save a local connection profile, connect in one click, and start browsing tables right away.
					</p>
				</div>
				<Button
					onClick={onNewConnection}
					size="sm"
					className="mt-1 h-9 gap-1.5 rounded-sm px-4 text-[12px] font-medium"
				>
					<Plus size={12} />
					New Connection
				</Button>
			</div>
		);
	}
	return (
		<div className="h-full overflow-auto scrollbar-thin bg-surface-2">
			{/* Header */}
			<div className="sticky top-0 z-10 flex items-center justify-between border-b border-border-subtle bg-surface-1 px-6 py-4">
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
					className="gap-1.5 rounded-sm text-[11px]"
				>
					<Plus size={12} />
					New Connection
				</Button>
			</div>
			{/* Connection list */}
			<div className="max-w-3xl space-y-2 px-6 py-5">
				{connections.map((conn) => {
					const isConnected = connectedIds.includes(conn.id);
					const Logo = DB_LOGO[conn.type] ?? DB_LOGO.postgresql;
					const logoColor =
						DB_COLOR[conn.type] ?? "text-muted-foreground";
					const url = buildConnectionUrl(conn);
					return (
						<div
							key={conn.id}
						className="flex items-center gap-4 border border-border-subtle bg-surface-3 px-4 py-4 transition-colors hover:bg-surface-elevated hover:border-border/70"
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
								"shell-badge h-[15px] shrink-0 px-1.5 text-[9px]",
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
								"shell-badge shrink-0 gap-1.5 px-3",
								isConnected
									? "text-accent-green bg-accent-green/10"
									: "text-foreground/54 bg-surface-2",
								)}
							>
								<span
									className={cn(
										"w-1.5 h-1.5 rounded-full shrink-0",
										isConnected
											? "bg-accent-green"
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
									className="h-8 rounded-sm px-3.5 text-[12px]"
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
