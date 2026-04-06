import { Search } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

export function IdleView({ onNewConnection }: { onNewConnection: () => void }) {
	return (
		<div className="h-full flex flex-col items-center justify-center bg-background select-none gap-6">
			{/* Icon */}
			<div className="w-10 h-10 border border-border flex items-center justify-center">
				<Search size={16} className="text-muted-foreground/30" />
			</div>
			{/* Message */}
			<div className="text-center space-y-1.5">
				<p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70">
					Nothing open
				</p>
				<p className="text-[11px] text-muted-foreground/40">
					Select a table from the sidebar or search with <Kbd>⌘K</Kbd>
				</p>
			</div>
			{/* Shortcuts */}
			<div className="flex items-center gap-px border border-border">
				{[
					{ key: "⌘K", label: "Search" },
					{ key: "⌘T", label: "New tab" },
					{ key: "⌘↵", label: "Run" },
				].map(({ key, label }, i, arr) => (
					<div
						key={key}
						className={cn(
							"flex items-center gap-1.5 px-3 py-1.5 bg-card text-[10px] font-mono text-muted-foreground/50",
							i < arr.length - 1 && "border-r border-border",
						)}
					>
						<span className="text-muted-foreground/80 font-semibold">
							{key}
						</span>
						<span className="text-muted-foreground/35">
							{label}
						</span>
					</div>
				))}
			</div>
			<button
				onClick={onNewConnection}
				className="text-[10px] font-mono text-muted-foreground/35 hover:text-muted-foreground/70 transition-colors underline underline-offset-4 decoration-muted-foreground/20"
			>
				+ add connection
			</button>
		</div>
	);
}
