import { Search, Database, Play, Sidebar, Keyboard } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";

export function IdleView({ onNewConnection }: { onNewConnection: () => void }) {
	return (
		<div className="flex h-full select-none flex-col items-center justify-center gap-6 bg-surface-2 px-6">
			<EmptyState
				icon={Search}
				title="Workspace ready"
				description="Use the sidebar to browse connected databases, or jump anywhere with the command palette."
				action={
					<div className="flex flex-col items-center gap-4">
						<Button onClick={onNewConnection} size="sm" className="h-9 rounded-md px-4 text-[12px] font-medium gap-2">
							<Database size={12} />
							Add Connection
							<Kbd className="text-[10px]">⌘N</Kbd>
						</Button>
						<div className="flex items-center gap-px overflow-hidden border border-border-subtle bg-surface-3">
							{[
								{ key: "⌘K", label: "Search", Icon: Search },
								{ key: "⌘T", label: "New tab", Icon: Play },
								{ key: "⌘B", label: "Sidebar", Icon: Sidebar },
								{ key: "⌘↵", label: "Run", Icon: Play },
								{ key: "?", label: "Shortcuts", Icon: Keyboard },
							].map(({ key, label, Icon }, i, arr) => (
								<div
									key={key}
									className={cn(
										"flex items-center gap-1.5 px-3.5 py-2 bg-surface-3 text-[11px] font-mono text-foreground/70",
										i < arr.length - 1 && "border-r border-border",
									)}
								>
									<Icon size={11} className="text-foreground/70" />
									<span className="text-foreground/82 font-semibold">
										{key}
									</span>
									<span className="text-foreground/70">
										{label}
									</span>
								</div>
							))}
						</div>
					</div>
				}
			/>
		</div>
	);
}
