import { Circle, AlertTriangle, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/useAppStore";
import { DB_COLOR, DB_LOGO } from "@/components/shared/db-ui";

export function StatusBar({
	connectionId,
	executionTimeMs,
	rowCount,
	pendingEditCount = 0,
	isRunning = false,
}: {
	connectionId: string;
	executionTimeMs: number;
	rowCount: number;
	pendingEditCount?: number;
	isRunning?: boolean;
}) {
	const { connections, connectedIds, selectedDatabases, tabs, activeTabId } = useAppStore();
	const conn = connections.find((c) => c.id === connectionId);
	const isConnected = conn ? connectedIds.includes(conn.id) : false;
	const dbName =
		selectedDatabases[connectionId] ?? conn?.database ?? conn?.name ?? "—";
	const connType = conn?.type;
	const Logo = connType ? DB_LOGO[connType] : undefined;
	const logoColor = connType ? DB_COLOR[connType] : "text-muted-foreground";
	const activeTab = tabs.find((t) => t.id === activeTabId);
	return (
		<div className="h-7 bg-background border-t border-border flex items-center justify-between px-3.5 shrink-0 select-none">
			{/* Left: connection indicator */}
			<div className="flex items-center gap-3 min-w-0">
				<div className="flex items-center gap-1.5">
					<Circle
						size={7}
						className={cn(
							"fill-current shrink-0",
							isConnected
								? "text-primary animate-pulse"
								: "text-muted-foreground",
						)}
					/>
					<span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.14em]">
						{isConnected ? "Connected" : "Disconnected"}
					</span>
				</div>
				{Logo && (
					<Logo className={cn("size-3 shrink-0", logoColor)} aria-hidden />
				)}
				<span className="text-[11px] font-mono text-muted-foreground truncate max-w-[160px]">
					<span className="text-foreground/80">{conn?.name ?? connectionId}</span>
				</span>
				<span className="text-muted-foreground text-[10px]">·</span>
				<span className="text-[11px] font-mono text-muted-foreground truncate">
					DB:{" "}
					<span className="text-foreground/80">{dbName}</span>
				</span>
			</div>
			{/* Right: timing + row count + pending edits + status */}
			<div className="flex items-center gap-3.5">
				{pendingEditCount > 0 && (
					<span
						className="text-[11px] font-mono text-warning"
						title="Pending cell edits queued for apply"
					>
						<AlertTriangle size={10} className="inline -translate-y-px mr-1" />
						<span className="text-foreground/80">{pendingEditCount}</span>
						<span className="text-muted-foreground"> pending</span>
					</span>
				)}
				{isRunning ? (
					<span className="text-[11px] font-mono text-primary">
						<span className="text-muted-foreground">Status:</span>{" "}
						<span className="font-semibold uppercase tracking-[0.14em]">Running</span>
					</span>
				) : executionTimeMs > 0 ? (
					<span className="text-[11px] font-mono text-muted-foreground">
						Execution:{" "}
						<span className="text-foreground/80">{executionTimeMs}ms</span>
					</span>
				) : null}
				<span className="text-[11px] font-mono text-muted-foreground">
					Rows:{" "}
					<span className="text-foreground/80">
						{rowCount}
						{activeTab?.filteredResult ? ` / ${activeTab.filteredResult.rows.length}` : ""}
					</span>
				</span>
				{!isRunning && executionTimeMs > 0 && (
					<span className="flex items-center gap-1 text-[11px] font-mono text-success/80">
						<CheckCheck size={11} />
						OK
					</span>
				)}
			</div>
		</div>
	);
}
