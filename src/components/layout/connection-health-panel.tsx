import { useEffect, useState } from "react";
import { Activity, RefreshCw, Wifi, WifiOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";

function formatUptime(connectedAt: number): string {
	const secs = Math.floor((Date.now() - connectedAt) / 1000);
	if (secs < 60) return `${secs}s`;
	if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
	const h = Math.floor(secs / 3600);
	const m = Math.floor((secs % 3600) / 60);
	return `${h}h ${m}m`;
}

function LatencyBadge({ ms }: { ms: number | null | undefined }) {
	if (ms === undefined) return <span className="text-foreground/36 text-[10px]">—</span>;
	if (ms === null) return <span className="text-warning text-[10px] font-mono">timeout</span>;
	const color = ms < 50 ? "text-success" : ms < 200 ? "text-warning" : "text-destructive";
	return <span className={cn("text-[10px] font-mono", color)}>{ms}ms</span>;
}

export function ConnectionHealthPanel({ onClose }: { onClose: () => void }) {
	const {
		connections,
		connectedIds,
		connectionLatency,
		connectionConnectedAt,
		pingConnectionHealth,
	} = useAppStore();

	const [pinging, setPinging] = useState<Record<string, boolean>>({});
	const [now, setNow] = useState(Date.now());

	// Tick every second to update uptime display
	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(timer);
	}, []);

	const handlePing = async (id: string) => {
		setPinging((p) => ({ ...p, [id]: true }));
		await pingConnectionHealth(id);
		setPinging((p) => ({ ...p, [id]: false }));
	};

	const handlePingAll = async () => {
		await Promise.all(connectedIds.map((id) => handlePing(id)));
	};

	return (
		<div className="absolute bottom-10 left-0 right-0 z-50 mx-3 mb-1 rounded-lg border border-border bg-surface-2 shadow-xl">
			{/* Header */}
			<div className="flex items-center justify-between border-b px-3 py-2">
				<div className="flex items-center gap-1.5">
					<Activity size={11} className="text-foreground/60" />
					<span className="text-[11px] font-semibold text-foreground/80">Connection Health</span>
				</div>
				<div className="flex items-center gap-1">
					{connectedIds.length > 0 && (
						<Button
							variant="ghost"
							size="icon-xs"
							className="h-5 w-5 text-foreground/50 hover:text-foreground"
							onClick={handlePingAll}
							title="Ping all"
						>
							<RefreshCw size={10} />
						</Button>
					)}
					<Button
						variant="ghost"
						size="icon-xs"
						className="h-5 w-5 text-foreground/50 hover:text-foreground"
						onClick={onClose}
					>
						<X size={10} />
					</Button>
				</div>
			</div>

			{/* Connection list */}
			<div className="max-h-64 overflow-y-auto">
				{connections.length === 0 ? (
					<p className="px-3 py-4 text-center text-[11px] text-foreground/40">No connections configured</p>
				) : (
					<table className="w-full text-[11px]">
						<thead>
							<tr className="border-b">
								<th className="px-3 py-1.5 text-left font-medium text-foreground/40">Connection</th>
								<th className="px-3 py-1.5 text-right font-medium text-foreground/40">Latency</th>
								<th className="px-3 py-1.5 text-right font-medium text-foreground/40">Uptime</th>
								<th className="px-2 py-1.5" />
							</tr>
						</thead>
						<tbody>
							{connections.map((conn) => {
								const isConnected = connectedIds.includes(conn.id);
								const lat = connectionLatency[conn.id];
								const connectedAt = connectionConnectedAt[conn.id];
								return (
									<tr key={conn.id} className="border-b border-border/40 last:border-0 hover:bg-surface-3/50 transition-colors">
										<td className="px-3 py-2">
											<div className="flex items-center gap-2">
												{isConnected
													? <Wifi size={10} className="text-success shrink-0" />
													: <WifiOff size={10} className="text-foreground/30 shrink-0" />
												}
												<span className={cn("truncate max-w-[130px] font-medium", isConnected ? "text-foreground" : "text-foreground/40")}>
													{conn.name}
												</span>
												{conn.group && (
													<span className="rounded px-1 py-0.5 text-[9px] font-medium bg-surface-3 text-foreground/50">{conn.group}</span>
												)}
											</div>
										</td>
										<td className="px-3 py-2 text-right">
											{isConnected ? <LatencyBadge ms={lat} /> : <span className="text-foreground/24 text-[10px]">—</span>}
										</td>
										<td className="px-3 py-2 text-right font-mono text-foreground/60">
											{isConnected && connectedAt
												? formatUptime(connectedAt)
												: <span className="text-foreground/24">—</span>
											}
										</td>
										<td className="px-2 py-2">
											{isConnected && (
												<Button
													variant="ghost"
													size="icon-xs"
													className="h-5 w-5 text-foreground/40 hover:text-foreground"
													onClick={() => handlePing(conn.id)}
													disabled={pinging[conn.id]}
													title="Ping"
												>
													<RefreshCw size={9} className={cn(pinging[conn.id] && "animate-spin")} />
												</Button>
											)}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				)}
			</div>

			{/* Summary footer */}
			<div className="flex items-center justify-between border-t px-3 py-1.5">
				<span className="text-[10px] text-foreground/40">
					{connectedIds.length} / {connections.length} active
				</span>
				{connectedIds.length > 0 && (
					<span className="text-[10px] text-foreground/40">
						avg {Math.round(
							connectedIds
								.map((id) => connectionLatency[id])
								.filter((v): v is number => typeof v === "number")
								.reduce((a, b, _i, arr) => a + b / arr.length, 0)
						) || "—"}ms
					</span>
				)}
			</div>

			{/* Suppress unused `now` warning — it drives re-render for uptime */}
			<span style={{ display: "none" }}>{now}</span>
		</div>
	);
}
