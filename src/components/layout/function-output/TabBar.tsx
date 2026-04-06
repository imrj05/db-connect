import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ResultTab } from "@/types";

const TYPE_DOT: Record<string, string> = {
	list: "bg-accent-purple",
	src: "bg-muted-foreground",
	query: "bg-accent-green",
	execute: "bg-accent-orange",
	tbl: "bg-accent-blue",
	table: "bg-accent-blue",
};

export function TabBar({
	tabs,
	activeTabId,
	connectedIds,
	onSwitchTab,
	onCloseTab,
	onNewTab,
}: {
	tabs: ResultTab[];
	activeTabId: string | null;
	connectedIds: string[];
	onSwitchTab: (id: string) => void;
	onCloseTab: (id: string) => void;
	onNewTab: () => void;
}) {
	if (tabs.length === 0) return null;
	return (
		<div className="h-8 bg-sidebar border-b border-border flex items-stretch overflow-x-auto shrink-0 no-scrollbar">
			{tabs.map((tab, index) => {
				const isActive = tab.id === activeTabId;
				return (
					<div
						key={tab.id}
						onClick={() => onSwitchTab(tab.id)}
						className={cn(
							"relative flex items-center gap-1.5 px-3 border-r border-border cursor-pointer shrink-0 select-none group/tab transition-colors",
							isActive
								? "bg-background text-foreground"
								: "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/40",
						)}
					>
						{/* Neon-green active-tab indicator */}
						{isActive && (
							<span className="absolute inset-x-0 top-0 h-[2px] bg-primary" />
						)}
						<span
							className={cn(
								"w-1.5 h-1.5 shrink-0",
								/* square in dark (sharp corners), pill in light */
								"rounded-sm dark:rounded-none",
								TYPE_DOT[tab.fn.type] ?? "bg-accent-blue",
							)}
						/>
						{index < 9 && (
							<span
								className={cn(
									"text-[9px] font-mono shrink-0 tabular-nums",
									isActive
										? "text-primary/80"
										: "text-muted-foreground/35 group-hover/tab:text-muted-foreground/55",
								)}
							>
								{index + 1}
							</span>
						)}
						<span className="text-[10px] font-mono max-w-[120px] truncate">
							{tab.label}
						</span>
						{tabs.length > 1 && (
							<Button
								variant="ghost"
								size="icon-xs"
								onClick={(e) => {
									e.stopPropagation();
									onCloseTab(tab.id);
								}}
								className="ml-0.5 size-4 opacity-0 group-hover/tab:opacity-100 text-muted-foreground/40 hover:text-foreground"
							>
								<X size={9} />
							</Button>
						)}
					</div>
				);
			})}
			{/* New tab button */}
			{connectedIds.length > 0 && (
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon-xs"
							onClick={onNewTab}
							className="mx-1 my-auto size-6 text-muted-foreground/40 hover:text-muted-foreground shrink-0"
						>
							<Plus size={11} />
						</Button>
					</TooltipTrigger>
					<TooltipContent>New query tab</TooltipContent>
				</Tooltip>
			)}
		</div>
	);
}
