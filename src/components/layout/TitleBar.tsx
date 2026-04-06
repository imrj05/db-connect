import { useState, useEffect, useRef, type CSSProperties } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Search, Settings, WifiOff, ChevronLeft, Pencil, ChevronDown, ExternalLink, PanelLeft, ScrollText, Database } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { DB_LOGO, DB_COLOR } from "@/lib/db-ui";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { GROUP_PRESETS } from "@/components/layout/ConnectionDialog";;
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
		sidebarCollapsed,
		toggleSidebar,
		queryLogOpen,
		toggleQueryLog,
		connectionDatabases,
		selectedDatabases,
		selectDatabase,
		setActiveConnection,
	} = useAppStore();

	const [connMenuOpen, setConnMenuOpen] = useState(false);
	const connMenuRef = useRef<HTMLDivElement>(null);
	const [dbMenuOpen, setDbMenuOpen] = useState(false);
	const dbMenuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!connMenuOpen) return;
		const handler = (e: MouseEvent) => {
			if (connMenuRef.current && !connMenuRef.current.contains(e.target as Node)) {
				setConnMenuOpen(false);
			}
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [connMenuOpen]);

	useEffect(() => {
		if (!dbMenuOpen) return;
		const handler = (e: MouseEvent) => {
			if (dbMenuRef.current && !dbMenuRef.current.contains(e.target as Node)) {
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
	const activeDatabases = activeConn ? (connectionDatabases[activeConn.id] ?? []) : [];
	const selectedDb = activeConn ? (selectedDatabases[activeConn.id] ?? null) : null;
	const showDbPicker = activeConn && connectedIds.includes(activeConn.id) && activeDatabases.length > 0;

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
						{activeConn.group && (() => {
							const preset = GROUP_PRESETS.find(p => p.id === activeConn.group);
							return (
								<span className={cn(
									"shrink-0 px-1.5 h-[14px] flex items-center rounded text-[8px] font-bold uppercase tracking-wide border",
									preset ? preset.activeClass : "bg-muted/50 border-border/50 text-muted-foreground/60"
								)}>
									{activeConn.group}
								</span>
							);
						})()}
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

			{/* ── Right: panel toggles · [Cmd+K] · Connection status · Settings ── */}
			<div className="flex items-center gap-2 pr-3 shrink-0">
				{/* Sidebar toggle */}
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							style={noDragStyle}
							variant="outline"
							size="sm"
							onClick={toggleSidebar}
							className={cn(
								"h-6 px-2 border-border/60 transition-colors",
								sidebarCollapsed
									? "text-muted-foreground/60 hover:text-foreground"
									: "text-foreground/70 hover:text-foreground",
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
							onClick={toggleQueryLog}
							className={cn(
								"h-6 px-2 border-border/60 transition-colors",
								queryLogOpen
									? "text-foreground/70 hover:text-foreground"
									: "text-muted-foreground/60 hover:text-foreground",
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
					className="h-6 px-2 text-[10px] font-bold font-mono gap-1.5 text-muted-foreground/60 hover:text-foreground border-border/60"
				>
					<Search size={10} className="shrink-0" />
					[Cmd+K]
				</Button>

				{showDbPicker && (
					<div ref={dbMenuRef} className="relative" style={noDragStyle}>
						<Button
							variant="outline"
							size="sm"
							onClick={() => setDbMenuOpen((o) => !o)}
							className="h-6 px-2 text-[10px] font-bold font-mono gap-1.5 text-foreground/70 border-border/60 hover:text-foreground"
						>
							<Database size={9} className="shrink-0 text-muted-foreground/60" />
							<span className="max-w-[80px] truncate">
								{selectedDb ?? "Select DB"}
							</span>
							<ChevronDown size={9} className="text-muted-foreground/50 shrink-0" />
						</Button>
						{dbMenuOpen && (
							<div className="absolute right-0 top-full mt-1 w-52 z-50 bg-popover border border-border rounded-lg shadow-md p-1 text-popover-foreground">
								<div className="px-2 py-1.5 mb-1">
									<p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
										Databases
									</p>
								</div>
								{activeDatabases.map((db) => (
									<div
										key={db}
										className={cn(
											"flex items-center gap-2 px-2 py-1.5 rounded-sm text-[11px] cursor-pointer hover:bg-muted/30 transition-colors",
											db === selectedDb ? "font-bold text-foreground" : "text-foreground/80"
										)}
										onClick={() => {
											selectDatabase(activeConn!.id, db);
											setDbMenuOpen(false);
										}}
									>
										<Database size={10} className="shrink-0 text-muted-foreground/50" />
										<span className="truncate">{db}</span>
										{db === selectedDb && (
											<span className="ml-auto text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-sm shrink-0">
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
					<div ref={connMenuRef} className="relative" style={noDragStyle}>
							<Button
								variant="outline"
								size="sm"
								onClick={() => setConnMenuOpen((o) => !o)}
								className="h-6 px-2 text-[10px] font-bold font-mono gap-1.5 text-foreground/70 border-border/60 hover:text-foreground"
							>
								{activeConn
									? (() => { const L = DB_LOGO[activeConn.type] ?? DB_LOGO.postgresql; return <L className={cn("text-[11px] shrink-0", DB_COLOR[activeConn.type] ?? "text-muted-foreground")} />; })()
									: <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
								}
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
							{connMenuOpen && (
								<div className="absolute right-0 top-full mt-1 w-72 z-50 bg-popover border border-border rounded-lg shadow-md p-1 text-popover-foreground">
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
												className={cn(
													"flex items-center gap-2.5 px-2 py-2 rounded-md transition-colors",
													!isActive && "cursor-pointer hover:bg-muted/30"
												)}
												onClick={() => {
													if (!isActive) {
														setActiveConnection(conn.id);
														setConnMenuOpen(false);
													}
												}}
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
														{conn.group && (() => {
															const preset = GROUP_PRESETS.find(p => p.id === conn.group);
															return (
																<span className={cn(
																	"shrink-0 px-1.5 h-[14px] flex items-center rounded text-[8px] font-bold uppercase tracking-wide border",
																	preset ? preset.activeClass : "bg-muted/50 border-border/50 text-muted-foreground/60"
																)}>
																	{conn.group}
																</span>
															);
														})()}
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
									<div className="my-1 h-px bg-border -mx-1" />
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
								</div>
							)}
					</div>
				)}

				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							style={noDragStyle}
							variant="outline"
							size="sm"
							onClick={() => setSettingsOpen(true)}
							className="h-6 px-2 border-border/60 text-muted-foreground/50 hover:text-foreground"
						>
							<Settings size={11} className="shrink-0" />
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
