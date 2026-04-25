import { Search } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function IdleView({ onNewConnection }: { onNewConnection: () => void }) {
	return (
		<div className="flex h-full select-none flex-col items-center justify-center gap-6 bg-surface-2 px-6">
			{/* Icon */}
			<div className="flex h-16 w-16 items-center justify-center border border-border-subtle bg-surface-3">
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
			<Button onClick={onNewConnection} size="sm" className="h-9 rounded-sm px-4 text-[12px] font-medium">
				Add Connection
			</Button>
			{/* Shortcuts */}
			<div className="flex items-center gap-px overflow-hidden border border-border-subtle bg-surface-3">
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
