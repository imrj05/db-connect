import { useState, useMemo } from "react";
import { Clock, Search, RotateCcw, Copy, Bookmark, Trash2, CheckCircle2, XCircle, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QueryHistoryEntry } from "@/types";
import { cn } from "@/lib/utils";

function formatTime(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	return `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(ts: number): string {
	const d = new Date(ts);
	const now = new Date();
	const diffMs = now.getTime() - d.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	if (diffMins < 1) return "just now";
	if (diffMins < 60) return `${diffMins}m ago`;
	const diffHours = Math.floor(diffMins / 60);
	if (diffHours < 24) return `${diffHours}h ago`;
	return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function QueryHistoryPanel({
	history,
	connections,
	onSelectQuery,
	onClearHistory,
	onDeleteEntry,
	onSaveQuery,
}: {
	history: QueryHistoryEntry[];
	connections: { id: string; name: string }[];
	onSelectQuery: (sql: string) => void;
	onClearHistory: () => void;
	onDeleteEntry?: (id: string) => void;
	onSaveQuery?: (sql: string) => void;
}) {
	const [search, setSearch] = useState("");
	const [connFilter, setConnFilter] = useState<string>("all");
	const [statusFilter, setStatusFilter] = useState<"all" | "success" | "error">("all");
	const [connDropOpen, setConnDropOpen] = useState(false);
	const [copiedId, setCopiedId] = useState<string | null>(null);

	const filtered = useMemo(() => {
		return history.filter((e) => {
			if (connFilter !== "all" && e.connectionId !== connFilter) return false;
			if (statusFilter !== "all") {
				if (statusFilter === "error" && e.status !== "error") return false;
				if (statusFilter === "success" && e.status === "error") return false;
			}
			if (search.trim()) {
				const q = search.trim().toLowerCase();
				if (!e.sql.toLowerCase().includes(q)) return false;
			}
			return true;
		});
	}, [history, connFilter, statusFilter, search]);

	function handleCopy(id: string, sql: string) {
		navigator.clipboard.writeText(sql).catch(console.error);
		setCopiedId(id);
		setTimeout(() => setCopiedId(null), 1500);
	}

	const activeConnName = connFilter === "all"
		? "All connections"
		: (connections.find((c) => c.id === connFilter)?.name ?? connFilter);

	return (
		<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
			{/* ── Toolbar ── */}
			<div className="shrink-0 flex flex-col gap-1.5 px-3 py-2 border-b border-border">
				{/* Search */}
				<div className="relative">
					<Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/40 pointer-events-none" />
					<Input
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Filter by SQL..."
						className="h-6 text-[11px] pl-6 bg-muted/30 border-border/40 focus-visible:ring-2 focus-visible:ring-ring/50"
					/>
				</div>
				{/* Filters row */}
				<div className="flex items-center gap-1.5 justify-between">
					{/* Connection dropdown */}
					<div className="relative">
						<button
							onClick={() => setConnDropOpen((v) => !v)}
							className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground/60 hover:text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
						>
							<span className="truncate max-w-[120px]">{activeConnName}</span>
							<ChevronDown size={9} />
						</button>
						{connDropOpen && (
							<div className="absolute top-full left-0 mt-1 z-50 bg-popover border border-border rounded-md shadow-lg min-w-[160px] py-1">
								{[{ id: "all", name: "All connections" }, ...connections].map((c) => (
								<button
									key={c.id}
									onClick={() => { setConnFilter(c.id); setConnDropOpen(false); }}
									className={cn(
										"w-full text-left px-3 py-1 text-[10px] font-mono hover:bg-muted/60 transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
										connFilter === c.id && "text-primary font-semibold"
									)}
								>
										{c.name}
									</button>
								))}
							</div>
						)}
					</div>
					{/* Status filter */}
					<div className="flex items-center gap-1">
						{(["all", "success", "error"] as const).map((s) => (
						<button
							key={s}
							onClick={() => setStatusFilter(s)}
							className={cn(
								"text-[8px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
									statusFilter === s
										? s === "error" ? "bg-destructive/20 text-destructive"
											: s === "success" ? "bg-green-500/20 text-green-400"
												: "bg-primary/20 text-primary"
										: "text-muted-foreground/40 hover:text-muted-foreground"
								)}
							>
								{s}
							</button>
						))}
					</div>
					{/* Clear all */}
					{history.length > 0 && (
						<Button
							variant="ghost"
							size="xs"
							onClick={onClearHistory}
							className="h-5 text-[8px] text-muted-foreground/30 hover:text-destructive uppercase tracking-widest ml-auto"
						>
							Clear all
						</Button>
					)}
				</div>
				<span className="text-[9px] font-mono text-muted-foreground/30">
					{filtered.length} / {history.length} queries
				</span>
			</div>

			{/* ── List ── */}
			<div className="flex-1 overflow-auto scrollbar-thin">
				{filtered.length === 0 ? (
					<div className="flex flex-col items-center justify-center h-full text-muted-foreground/30 gap-2">
						<Clock size={20} className="opacity-30" />
						<p className="text-[10px] font-mono">
							{history.length === 0 ? "No queries executed yet" : "No matches"}
						</p>
					</div>
				) : (
					filtered.map((entry) => {
						const connName = connections.find((c) => c.id === entry.connectionId)?.name ?? entry.connectionId;
						const isError = entry.status === "error";
						const isCopied = copiedId === entry.id;
						return (
							<div
								key={entry.id}
								className="border-b border-border px-3 py-2 hover:bg-muted/30 group transition-colors relative"
							>
								{/* Top row */}
								<div className="flex items-center gap-1.5 mb-1 min-w-0">
									{/* Status icon */}
									{entry.status === "success" && (
										<CheckCircle2 size={9} className="text-green-400 shrink-0" />
									)}
									{entry.status === "error" && (
										<XCircle size={9} className="text-destructive shrink-0" />
									)}
									{!entry.status && (
										<Clock size={9} className="text-muted-foreground/30 shrink-0" />
									)}
									<span className="text-[9px] font-mono text-muted-foreground/50 shrink-0">
										{formatDate(entry.executedAt)}
									</span>
									<span className="text-[9px] font-mono text-primary/50 truncate">
										{connName}
									</span>
									{!isError && (
										<span className="text-[9px] font-mono text-muted-foreground/30 shrink-0 ml-auto">
											{entry.rowCount}r · {formatTime(entry.executionTimeMs)}
										</span>
									)}
								</div>

								{/* SQL preview */}
								<pre
									onClick={() => onSelectQuery(entry.sql)}
									className={cn(
										"text-[10px] font-mono truncate whitespace-pre-wrap line-clamp-2 cursor-pointer",
										isError ? "text-destructive/70" : "text-foreground/75 hover:text-foreground"
									)}
								>
									{entry.sql}
								</pre>

								{/* Error message */}
								{isError && entry.errorMessage && (
									<p className="text-[9px] font-mono text-destructive/60 mt-0.5 line-clamp-1">
										{entry.errorMessage}
									</p>
								)}

								{/* Hover action bar */}
								<div className="absolute right-2 top-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-card border border-border rounded px-1 py-0.5 shadow-sm">
								<button
									title="Re-run"
									onClick={() => onSelectQuery(entry.sql)}
									className="p-0.5 text-muted-foreground/50 hover:text-primary transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
								>
										<RotateCcw size={9} />
									</button>
								<button
									title={isCopied ? "Copied!" : "Copy SQL"}
									onClick={() => handleCopy(entry.id, entry.sql)}
									className={cn("p-0.5 transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none", isCopied ? "text-green-400" : "text-muted-foreground/50 hover:text-primary")}
								>
										<Copy size={9} />
									</button>
									{onSaveQuery && (
								<button
									title="Save query"
									onClick={() => onSaveQuery(entry.sql)}
									className="p-0.5 text-muted-foreground/50 hover:text-primary transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
								>
											<Bookmark size={9} />
										</button>
									)}
									{onDeleteEntry && (
								<button
									title="Delete"
									onClick={() => onDeleteEntry(entry.id)}
									className="p-0.5 text-muted-foreground/50 hover:text-destructive transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
								>
											<Trash2 size={9} />
										</button>
									)}
								</div>
							</div>
						);
					})
				)}
			</div>
		</div>
	);
}
