import { Bookmark, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SavedQuery } from "@/types";

export function SavedQueriesPanel({
	savedQueries,
	onLoadQuery,
	onDeleteQuery,
}: {
	savedQueries: SavedQuery[];
	onLoadQuery: (sql: string) => void;
	onDeleteQuery: (id: string) => void;
}) {
	return (
		<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
			<div className="flex-1 overflow-auto scrollbar-thin">
				{savedQueries.length === 0 ? (
					<div className="flex flex-col items-center justify-center h-full text-muted-foreground/30 gap-2">
						<Bookmark size={20} className="opacity-30" />
						<p className="text-[10px] font-mono">No saved queries</p>
						<p className="text-[9px] text-muted-foreground/70">
							Use the save button in the Editor tab
						</p>
					</div>
				) : (
					savedQueries.map((sq) => (
						<div
							key={sq.id}
							className="border-b border-border px-3 py-2 hover:bg-accent group transition-colors"
						>
							<div className="flex items-center justify-between mb-1">
								<span className="text-[11px] font-semibold text-foreground/90 truncate flex-1">
									{sq.name}
								</span>
								<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
									<Button
										size="xs"
										variant="secondary"
										onClick={() => onLoadQuery(sq.sql)}
										className="h-5 text-[9px] font-bold uppercase tracking-wider"
									>
										Load
									</Button>
									<Button
										variant="ghost"
										size="icon-xs"
										onClick={() => onDeleteQuery(sq.id)}
										className="size-5 text-muted-foreground/40 hover:text-destructive"
									>
										<Trash2 size={10} />
									</Button>
								</div>
							</div>
							<pre className="text-[10px] font-mono text-muted-foreground/50 truncate">
								{sq.sql.slice(0, 120)}
							</pre>
						</div>
					))
				)}
			</div>
		</div>
	);
}
