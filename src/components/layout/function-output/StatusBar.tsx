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
		<div className="h-7 bg-card border-t border-border/80 flex items-center justify-between px-3.5 shrink-0 select-none">
			{/* Left: connection indicator */}
			<div className="flex items-center gap-3">
				<div className="flex items-center gap-1.5">
					<Circle
						size={7}
						className={cn(
							"fill-current shrink-0",
							isConnected
								? "text-primary animate-pulse"
								: "text-foreground/36",
						)}
					/>
					<span className="text-[11px] font-semibold text-foreground/64 uppercase tracking-[0.14em]">
						{isConnected ? "Connected" : "Disconnected"}
					</span>
				</div>
				<span className="text-foreground/32 text-[10px]">·</span>
				<span className="text-[11px] font-mono text-foreground/52">
					Current DB:{" "}
					<span className="text-foreground/76">{dbName}</span>
				</span>
			</div>
			{/* Right: timing + row count */}
			<div className="flex items-center gap-3.5">
				<span className="text-[11px] font-mono text-foreground/52">
					Execution Time:{" "}
					<span className="text-foreground/76">
						{executionTimeMs}ms
					</span>
				</span>
				<span className="text-[11px] font-mono text-foreground/52">
					Rows:{" "}
					<span className="text-foreground/76">{rowCount}</span>
				</span>
			</div>
		</div>
	);
}
