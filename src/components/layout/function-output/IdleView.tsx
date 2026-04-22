import { Search } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

export function IdleView({ onNewConnection }: { onNewConnection: () => void }) {
	return (
		<div className="h-full flex flex-col items-center justify-center bg-surface-2/72 select-none gap-6 px-6">
			{/* Icon */}
			<div className="w-14 h-14 rounded-2xl border border-border-subtle bg-surface-3 flex items-center justify-center shadow-sm">
				<Search size={18} className="text-foreground/42" />
			</div>
			{/* Message */}
			<div className="text-center space-y-2 max-w-md">
				<p className="text-[12px] font-bold uppercase tracking-[0.16em] text-foreground/56">
					Nothing open
				</p>
				<p className="text-[13px] text-foreground/58 leading-relaxed">
					Select a table from the sidebar or search with <Kbd>⌘K</Kbd>
				</p>
			</div>
			{/* Shortcuts */}
			<div className="flex items-center gap-px border border-border-subtle rounded-xl overflow-hidden bg-surface-3 shadow-sm">
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
			<button
				onClick={onNewConnection}
				className="text-[12px] font-medium text-foreground/48 hover:text-foreground/72 transition-colors underline underline-offset-4 decoration-foreground/20"
			>
				+ add connection
			</button>
		</div>
	);
}
