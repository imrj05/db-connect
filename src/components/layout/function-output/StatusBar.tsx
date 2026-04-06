import { Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";

export function StatusBar({
	connectionId,
	executionTimeMs,
	rowCount,
}: {
	connectionId: string;
	executionTimeMs: number;
	rowCount: number;
}) {
	const { connections, connectedIds, selectedDatabases } = useAppStore();
	const conn = connections.find((c) => c.id === connectionId);
	const isConnected = conn ? connectedIds.includes(conn.id) : false;
	const dbName =
		selectedDatabases[connectionId] ?? conn?.database ?? conn?.name ?? "—";
	return (
		<div className="h-6 bg-card border-t border-border flex items-center justify-between px-3 shrink-0 select-none">
			{/* Left: connection indicator */}
			<div className="flex items-center gap-2.5">
				<div className="flex items-center gap-1.5">
					<Circle
						size={6}
						className={cn(
							"fill-current shrink-0",
							isConnected
								? "text-primary animate-pulse"
								: "text-muted-foreground/30",
						)}
					/>
					<span className="text-[9px] font-mono text-muted-foreground/60 uppercase tracking-wider">
						{isConnected ? "Connected" : "Disconnected"}
					</span>
				</div>
				<span className="text-muted-foreground/70 text-[9px]">·</span>
				<span className="text-[9px] font-mono text-muted-foreground/50">
					Current DB:{" "}
					<span className="text-muted-foreground/80">{dbName}</span>
				</span>
			</div>
			{/* Right: timing + row count */}
			<div className="flex items-center gap-3">
				<span className="text-[9px] font-mono text-muted-foreground/50">
					Execution Time:{" "}
					<span className="text-muted-foreground/80">
						{executionTimeMs}ms
					</span>
				</span>
				<span className="text-[9px] font-mono text-muted-foreground/50">
					Rows:{" "}
					<span className="text-muted-foreground/80">{rowCount}</span>
				</span>
			</div>
		</div>
	);
}
