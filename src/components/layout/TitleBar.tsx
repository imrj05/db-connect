import { useState, type CSSProperties } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Search, Settings, WifiOff, ChevronLeft, Pencil, ChevronDown, ExternalLink } from "lucide-react";
import {
	SiPostgresql,
	SiMysql,
	SiSqlite,
	SiMongodb,
	SiRedis,
} from "react-icons/si";
import { useAppStore } from "@/store/useAppStore";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
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

// ── DB type logos ──────────────────────────────────────────────────────────────
const DB_LOGO: Record<string, React.FC<{ className?: string }>> = {
	postgresql: ({ className }) => <SiPostgresql className={className} />,
	mysql: ({ className }) => <SiMysql className={className} />,
	sqlite: ({ className }) => <SiSqlite className={className} />,
	mongodb: ({ className }) => <SiMongodb className={className} />,
	redis: ({ className }) => <SiRedis className={className} />,
};

const DB_COLOR: Record<string, string> = {
	postgresql: "text-blue-400",
	mysql: "text-cyan-400",
	sqlite: "text-slate-400",
	mongodb: "text-emerald-400",
	redis: "text-red-400",
};

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
	const proto = conn.type;
	const user = conn.user ? `${conn.user}@` : "";
	const host = conn.host ?? "localhost";
	const port = conn.port ? `:${conn.port}` : "";
	const db = conn.database ? `/${conn.database}` : "";
	return `${proto}://${user}${host}${port}${db}`;
}

// ── TitleBar ──────────────────────────────────────────────────────────────────
const TitleBar = () => {
	const {
		setCommandPaletteOpen,
		setSettingsOpen,
		activeFunction,
		connectedIds,
		connections,
		disconnectConnection,
		setActiveFunctionOnly,
		setEditingConnection,
		setConnectionDialogOpen,
		setShowConnectionsManager,
	} = useAppStore();

	const [connMenuOpen, setConnMenuOpen] = useState(false);

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

	// All currently connected connections, active-first
	const connectedConns = connections.filter((c) => connectedIds.includes(c.id));
	const orderedConns = activeConn
		? [activeConn, ...connectedConns.filter((c) => c.id !== activeConn.id)]
		: connectedConns;

	return (
		<header
			onMouseDown={handleTitleBarMouseDown}
			onDoubleClick={handleTitleBarDoubleClick}
			className="h-10 bg-sidebar border-b border-border flex items-center justify-between select-none shrink-0 cursor-default"
		>
			{/* ── Left: back arrow + DB logo + name + connection string ── */}
			<div className="flex items-center gap-2 pl-[80px] flex-1 min-w-0">
				{activeFunction && (
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								style={noDragStyle}
								variant="ghost"
								size="icon-xs"
								onClick={() =>
									setActiveFunctionOnly(null as any)
								}
								className="size-6 text-muted-foreground/40 hover:text-muted-foreground shrink-0"
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
						<Logo
							className={cn("text-[15px] shrink-0", logoColor)}
						/>
						<span className="font-mono text-[12px] font-bold text-foreground shrink-0">
							{activeConn.name}
						</span>
						{displayUrl && (
							<span className="font-mono text-[11px] text-muted-foreground/50 truncate">
								{displayUrl}
							</span>
						)}
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									style={noDragStyle}
									variant="ghost"
									size="icon-xs"
									onClick={() => {
										setEditingConnection(activeConn);
										setConnectionDialogOpen(true);
									}}
									className="size-6 text-muted-foreground/30 hover:text-muted-foreground shrink-0"
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
					<span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">
						DB Connect
					</span>
				)}
			</div>

			{/* ── Right: [Cmd+K] · Connection status · Settings ── */}
			<div className="flex items-center gap-1.5 pr-3 shrink-0">
				<Button
					style={noDragStyle}
					variant="outline"
					size="sm"
					onClick={() => setCommandPaletteOpen(true)}
					className="h-6 px-2 text-[10px] font-bold font-mono gap-1.5 text-muted-foreground/60 hover:text-foreground border-border/60"
				>
					<Search size={10} className="shrink-0" />
					[Cmd+K]
				</Button>

				{connectedConns.length > 0 && (
					<DropdownMenu open={connMenuOpen} onOpenChange={setConnMenuOpen}>
						<DropdownMenuTrigger asChild>
							<Button
								style={noDragStyle}
								variant="outline"
								size="sm"
								className="h-6 px-2 text-[10px] font-bold font-mono gap-1.5 text-foreground/70 border-border/60 hover:text-foreground"
							>
								<span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
								<span className="max-w-[100px] truncate">
									{activeConn?.name ?? connectedConns[0].name}
								</span>
								{connectedConns.length > 1 && (
									<span className="text-[9px] font-black text-muted-foreground/60">
										+{connectedConns.length - 1}
									</span>
								)}
								<ChevronDown size={9} className="text-muted-foreground/50 shrink-0" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-72 p-1">
							<div className="px-2 py-1.5 mb-1">
								<p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
									Active connections
								</p>
							</div>
							{orderedConns.map((conn) => {
								const Logo = DB_LOGO[conn.type] ?? DB_LOGO.postgresql;
								const color = DB_COLOR[conn.type] ?? "text-muted-foreground";
								const url = buildDisplayUrl(conn);
								const isActive = conn.id === activeConn?.id;
								return (
									<div
										key={conn.id}
										className="flex items-center gap-2.5 px-2 py-2 rounded-md"
									>
										<Logo className={cn("text-[16px] shrink-0", color)} />
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-1.5">
												<span className={cn(
													"text-[12px] leading-none truncate",
													isActive ? "font-bold text-foreground" : "font-semibold text-foreground/80"
												)}>
													{conn.name}
												</span>
												{isActive && (
													<span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-sm shrink-0">
														Active
													</span>
												)}
											</div>
											<p className="text-[10px] font-mono text-muted-foreground/50 truncate mt-0.5">
												{url}
											</p>
										</div>
										<Button
											variant="ghost"
											size="sm"
											className="h-6 px-2 text-[10px] gap-1 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/15 shrink-0 transition-colors"
											onClick={() => disconnectConnection(conn.id)}
										>
											<WifiOff size={9} />
											Disconnect
										</Button>
									</div>
								);
							})}
							<DropdownMenuSeparator className="my-1" />
							<div
								className="flex items-center gap-2 px-2 py-1.5 rounded-sm text-[11px] text-muted-foreground cursor-pointer hover:bg-muted/30 transition-colors"
								onClick={() => {
									setConnMenuOpen(false);
									setShowConnectionsManager(true);
								}}
							>
								<ExternalLink size={11} className="text-muted-foreground" />
								Manage connections
							</div>
						</DropdownMenuContent>
					</DropdownMenu>
				)}

				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							style={noDragStyle}
							variant="ghost"
							size="icon-xs"
							onClick={() => setSettingsOpen(true)}
							className="size-6 text-muted-foreground/40 hover:text-muted-foreground"
						>
							<Settings size={12} />
						</Button>
					</TooltipTrigger>
					<TooltipContent side="bottom" sideOffset={4}>
						Settings
					</TooltipContent>
				</Tooltip>
			</div>
		</header>
	);
};

export default TitleBar;
