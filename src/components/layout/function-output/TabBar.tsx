import { Code2, FileCode2, List, Play, Plus, Table2, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ResultTab } from "@/types";

const TYPE_META: Record<string, { icon: LucideIcon; iconClassName: string }> = {
	list: { icon: List, iconClassName: "text-accent-purple" },
	src: { icon: FileCode2, iconClassName: "text-foreground/58" },
	query: { icon: Code2, iconClassName: "text-accent-blue" },
	execute: { icon: Play, iconClassName: "text-accent-orange" },
	tbl: { icon: Table2, iconClassName: "text-accent-blue" },
	table: { icon: Table2, iconClassName: "text-accent-blue" },
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
		<div className="flex h-12 shrink-0 items-center gap-1.5 overflow-x-auto border-b border-border-subtle bg-surface-1/94 px-3.5 py-1 no-scrollbar">
			{tabs.map((tab) => {
				const isActive = tab.id === activeTabId;
				const hasPendingEdits = tab.pendingEdits.length > 0;
				const typeMeta = TYPE_META[tab.fn.type] ?? TYPE_META.table;
				const TabIcon = typeMeta.icon;
				const tabPaddingClass = tabs.length > 1 ? "pl-3 pr-1.5" : "px-3";
				return (
					<div
						key={tab.id}
						onClick={() => onSwitchTab(tab.id)}
						className={cn(
							"group/tab relative flex h-9 shrink-0 cursor-pointer select-none items-center gap-2 rounded-md border border-transparent bg-transparent transition-[color,background-color,border-color,box-shadow]",
							isActive
								? "bg-surface-3 text-foreground shadow-xs ring-1 ring-border-subtle"
								: "border-border/42 text-foreground/60 hover:border-border/60 hover:bg-surface-2 hover:text-foreground/84",
							tabPaddingClass,
						)}
					>
						<TabIcon
							size={13}
							className={cn(
								"shrink-0 transition-opacity",
								typeMeta.iconClassName,
								isActive ? "opacity-100" : "opacity-70",
							)}
						/>
						{hasPendingEdits && (
							<span className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
						)}
						<span className={cn(
							"max-w-[160px] truncate text-[11px] font-medium",
							isActive ? "text-foreground" : "text-foreground/68"
						)}>
							{tab.label}
						</span>
						{tabs.length > 1 && (
							<Button
								variant="ghost"
								size="icon-xs"
								aria-label={`Close ${tab.label}`}
								onClick={(e) => {
									e.stopPropagation();
									onCloseTab(tab.id);
								}}
								className={cn(
									"ml-1 size-6 rounded-md text-foreground/36 hover:bg-surface-2 hover:text-foreground",
									isActive ? "opacity-100" : "opacity-0 group-hover/tab:opacity-100",
								)}
							>
								<X size={11} />
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
							variant="outline"
							size="sm"
							onClick={onNewTab}
							className="my-auto ml-2 h-8 shrink-0 gap-1.5 rounded-md border-border-subtle bg-surface-2/88 px-3.5 text-[12px] font-medium text-foreground/76 shadow-xs hover:bg-surface-3 hover:text-foreground"
						>
							<Plus size={12} />
							New Tab
						</Button>
					</TooltipTrigger>
					<TooltipContent>New query tab</TooltipContent>
				</Tooltip>
			)}
		</div>
	);
}
