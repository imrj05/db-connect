import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QueryHistoryEntry } from "@/types";

export function QueryHistoryPanel({
	history,
	connections,
	onSelectQuery,
	onClearHistory,
}: {
	history: QueryHistoryEntry[];
	connections: { id: string; name: string }[];
	onSelectQuery: (sql: string) => void;
	onClearHistory: () => void;
}) {
	return (
		<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
			<div className="flex items-center justify-between px-3 py-1.5 shrink-0 border-b border-border">
				<span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">
					{history.length} queries
				</span>
				{history.length > 0 && (
					<Button
						variant="ghost"
						size="xs"
						onClick={onClearHistory}
						className="h-5 text-[9px] text-muted-foreground/40 hover:text-destructive uppercase tracking-widest"
					>
						Clear
					</Button>
				)}
			</div>
			<div className="flex-1 overflow-auto scrollbar-thin">
				{history.length === 0 ? (
					<div className="flex flex-col items-center justify-center h-full text-muted-foreground/30 gap-2">
						<Clock size={20} className="opacity-30" />
						<p className="text-[10px] font-mono">No queries executed yet</p>
					</div>
				) : (
					history.map((entry) => {
						const connName =
							connections.find((c) => c.id === entry.connectionId)?.name ??
							entry.connectionId;
						return (
							<div
								key={entry.id}
								onClick={() => onSelectQuery(entry.sql)}
								className="border-b border-border px-3 py-2 hover:bg-muted/40 cursor-pointer group transition-colors"
							>
								<div className="flex items-center justify-between mb-1">
									<div className="flex items-center gap-2 min-w-0">
										<span className="text-[9px] font-mono text-muted-foreground/40 shrink-0">
											{new Date(entry.executedAt).toLocaleString()}
										</span>
										<span className="text-[9px] font-mono text-primary/50 truncate">
											{connName}
										</span>
									</div>
									<span className="text-[9px] font-mono text-muted-foreground/30 shrink-0 ml-2">
										{entry.rowCount} rows · {entry.executionTimeMs}ms
									</span>
								</div>
								<pre className="text-[11px] font-mono text-foreground/80 truncate whitespace-pre-wrap line-clamp-2">
									{entry.sql}
								</pre>
							</div>
						);
					})
				)}
			</div>
		</div>
	);
}
