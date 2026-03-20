import type { CSSProperties } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Search, Settings, WifiOff, ChevronLeft } from "lucide-react";
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
	} = useAppStore();

	// Resolve which connection is "active" — prefer the one tied to the active function
	const activeConn =
		(activeFunction
			? connections.find((c) => c.id === activeFunction.connectionId)
			: null) ??
		connections.find((c) => connectedIds.includes(c.id)) ??
		null;

	const isConnected = activeConn
		? connectedIds.includes(activeConn.id)
		: false;

	const Logo = activeConn
		? (DB_LOGO[activeConn.type] ?? DB_LOGO.postgresql)
		: null;
	const logoColor = activeConn
		? (DB_COLOR[activeConn.type] ?? "text-muted-foreground")
		: "";
	const displayUrl = activeConn ? buildDisplayUrl(activeConn) : null;

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
					</>
				) : (
					<span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">
						DB Connect
					</span>
				)}
			</div>

			{/* ── Right: [Cmd+K] · Disconnect · Settings ── */}
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

				{activeConn && isConnected && (
					<Button
						style={noDragStyle}
						variant="outline"
						size="sm"
						onClick={() => disconnectConnection(activeConn.id)}
						className="h-6 px-2 text-[10px] font-bold font-mono gap-1.5 text-muted-foreground/60 hover:text-destructive hover:border-destructive/40 border-border/60"
					>
						<WifiOff size={10} className="shrink-0" />
						Disconnect
					</Button>
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
