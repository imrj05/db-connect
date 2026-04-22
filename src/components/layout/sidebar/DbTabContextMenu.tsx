import { RefreshCw, X } from "lucide-react";
import { ConnectionConfig } from "@/types";

export function DbTabContextMenu({
	db,
	x,
	y,
	activeConn,
	selectedDb,
	onRefreshDb,
	onCloseDb,
	onDismiss,
}: {
	db: string;
	x: number;
	y: number;
	activeConn: ConnectionConfig;
	selectedDb: string | null;
	onRefreshDb: (connId: string, db: string) => void;
	onCloseDb: (connId: string, db: string) => void;
	onDismiss: () => void;
}) {
	const menuW = 172;
	const menuH = 96;
	const maxX = Math.min(window.innerWidth, (window.visualViewport?.width ?? window.innerWidth) - menuW - 8);
	const maxY = Math.min(window.innerHeight, (window.visualViewport?.height ?? window.innerHeight) - menuH - 8);
	const left = Math.min(x, maxX);
	const top = Math.min(y, maxY);

	return (
		<>
			<div
				className="fixed inset-0 z-40"
				onClick={onDismiss}
				onContextMenu={(e) => { e.preventDefault(); onDismiss(); }}
			/>
			<div
				className="fixed z-50 bg-popover border border-border rounded-lg shadow-xl p-1 text-popover-foreground"
				style={{ top, left, width: menuW }}
			>
				<div className="px-2 py-1 mb-1">
					<p className="text-[9px] font-mono font-bold uppercase tracking-widest text-muted-foreground/40 truncate max-w-[140px]">
						{db}
					</p>
				</div>
				<button
					className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-[11px] text-foreground/80 hover:bg-muted/40 transition-colors"
					onClick={() => {
						onRefreshDb(activeConn.id, db);
						if (selectedDb !== db) onRefreshDb(activeConn.id, db);
						onDismiss();
					}}
				>
					<RefreshCw size={10} className="shrink-0 text-muted-foreground/60" />
					Refresh DB
				</button>
				<div className="my-1 h-px bg-border" />
				<button
					className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-[11px] text-destructive/80 hover:bg-destructive/10 transition-colors"
					onClick={() => {
						onCloseDb(activeConn.id, db);
						onDismiss();
					}}
				>
					<X size={10} className="shrink-0" />
					Close DB
				</button>
			</div>
		</>
	);
}
