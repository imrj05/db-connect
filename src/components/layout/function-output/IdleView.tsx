import { Search } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function IdleView({ onNewConnection }: { onNewConnection: () => void }) {
	return (
		<div className="h-full flex flex-col items-center justify-center bg-surface-2/72 select-none gap-6 px-6">
			{/* Icon */}
			<div className="w-16 h-16 rounded-2xl border border-border-subtle bg-surface-3/96 flex items-center justify-center shadow-sm">
				<Search size={20} className="text-foreground/42" />
			</div>
			{/* Message */}
			<div className="text-center space-y-2 max-w-md">
				<p className="text-[12px] font-semibold text-muted-foreground">
					Workspace Ready
				</p>
				<h2 className="text-[22px] font-semibold tracking-tight text-foreground text-balance">
					Open a table or start with a new connection
				</h2>
				<p className="text-[14px] text-foreground/60 leading-relaxed text-pretty">
					Use the sidebar to browse connected databases, or jump anywhere with <Kbd>⌘K</Kbd>.
				</p>
			</div>
			<Button onClick={onNewConnection} size="sm" className="h-9 px-4 text-[12px] font-medium">
				Add Connection
			</Button>
			{/* Shortcuts */}
			<div className="flex items-center gap-px border border-border-subtle rounded-lg overflow-hidden bg-surface-3 shadow-sm">
				{[
					{ key: "⌘K", label: "Search" },
					{ key: "⌘T", label: "New tab" },
					{ key: "⌘↵", label: "Run" },
				].map(({ key, label }, i, arr) => (
					<div
						key={key}
						className={cn(
							"flex items-center gap-1.5 px-3.5 py-2 bg-surface-3 text-[11px] font-mono text-foreground/54",
							i < arr.length - 1 && "border-r border-border",
						)}
					>
						<span className="text-foreground/82 font-semibold">
							{key}
						</span>
						<span className="text-foreground/46">
							{label}
						</span>
					</div>
				))}
			</div>
		</div>
	);
}
