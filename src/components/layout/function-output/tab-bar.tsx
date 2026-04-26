import { Code2, FileCode2, List, Play, Plus, Table2, X, Copy, CopyX, ArrowRight, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { ResultTab } from "@/types";
import { toast } from "@/components/ui/sonner";
import { useEffect, useRef, useState } from "react";

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
	onCloseOthers,
	onCloseRight,
	onDuplicateTab,
	onReorderTabs,
}: {
	tabs: ResultTab[];
	activeTabId: string | null;
	connectedIds: string[];
	onSwitchTab: (id: string) => void;
	onCloseTab: (id: string) => void;
	onNewTab: () => void;
	onCloseOthers?: (id: string) => void;
	onCloseRight?: (id: string) => void;
	onDuplicateTab?: (id: string) => void;
	onReorderTabs?: (fromId: string, toId: string) => void;
}) {
	// ── Pointer-based drag state ─────────────────────────────────────────────────
	const dragState = useRef<{
		fromId: string | null;
		toId: string | null;
		dragging: boolean;
		startX: number;
		startY: number;
	}>({ fromId: null, toId: null, dragging: false, startX: 0, startY: 0 });

	const tabRefs = useRef<Map<string, HTMLDivElement>>(new Map());
	const ghostRef = useRef<HTMLDivElement>(null);
	const tabsRef = useRef(tabs);
	useEffect(() => { tabsRef.current = tabs; });

	// State — only re-renders on drag start/end and when hover target changes
	const [draggingTabId, setDraggingTabId] = useState<string | null>(null);
	const [dragOverId, setDragOverId] = useState<string | null>(null);

	useEffect(() => {
		const onMove = (e: PointerEvent) => {
			const s = dragState.current;
			if (!s.fromId) return;

			const moved =
				Math.abs(e.clientX - s.startX) > 4 ||
				Math.abs(e.clientY - s.startY) > 4;
			if (!moved && !s.dragging) return;

			// First move past threshold — start drag
			if (!s.dragging) {
				s.dragging = true;
				document.body.style.cursor = "grabbing";
				document.body.style.userSelect = "none";
				setDraggingTabId(s.fromId);
				// Show ghost after React commits the new label content
				requestAnimationFrame(() => {
					if (ghostRef.current) {
						ghostRef.current.style.opacity = "1";
					}
				});
			}

			// Move ghost via direct DOM — zero re-renders per frame
			if (ghostRef.current) {
				ghostRef.current.style.transform = `translate(${e.clientX + 14}px, ${e.clientY - 18}px)`;
			}

			// Find which tab is under the cursor
			const el = document.elementFromPoint(e.clientX, e.clientY);
			let found: string | null = null;
			for (const [id, ref] of tabRefs.current) {
				if (ref.contains(el as Node)) { found = id; break; }
			}
			const toId = found !== s.fromId ? found : null;
			s.toId = toId;
			setDragOverId(toId);
		};

		const onUp = () => {
			const { fromId, toId, dragging } = dragState.current;
			if (dragging && fromId && toId && onReorderTabs) {
				onReorderTabs(fromId, toId);
			}
			// Reset ghost
			if (ghostRef.current) {
				ghostRef.current.style.opacity = "0";
			}
			document.body.style.cursor = "";
			document.body.style.userSelect = "";
			dragState.current = { fromId: null, toId: null, dragging: false, startX: 0, startY: 0 };
			setDraggingTabId(null);
			setDragOverId(null);
		};

		document.addEventListener("pointermove", onMove);
		document.addEventListener("pointerup", onUp);
		return () => {
			document.removeEventListener("pointermove", onMove);
			document.removeEventListener("pointerup", onUp);
		};
	}, [onReorderTabs]);

	const handleCopySql = (tab: ResultTab) => {
		const sql = tab.pendingSql ?? tab.result?.queryResult?.columns?.join(", ") ?? "";
		navigator.clipboard.writeText(sql).then(() => toast.success("SQL copied"));
	};

	if (tabs.length === 0) return null;

	// Find the dragged tab's metadata for the ghost label
	const draggingTab = draggingTabId ? tabs.find((t) => t.id === draggingTabId) : null;
	const ghostMeta = draggingTab ? TYPE_META[draggingTab.fn.type] ?? TYPE_META.table : null;
	const GhostIcon = ghostMeta?.icon ?? null;

	return (
		<div className="shell-toolbar no-scrollbar flex h-10 shrink-0 items-center gap-1 overflow-x-auto border-b border-border-subtle px-3 py-1">
			{tabs.map((tab) => {
				const isActive = tab.id === activeTabId;
				const hasPendingEdits = tab.pendingEdits.length > 0;
				const typeMeta = TYPE_META[tab.fn.type] ?? TYPE_META.table;
				const TabIcon = typeMeta.icon;
				const tabIdx = tabs.findIndex((t) => t.id === tab.id);
				const hasRight = tabIdx < tabs.length - 1;
				const isBeingDragged = draggingTabId === tab.id;
				const isDragOver = dragOverId === tab.id;

				return (
					<div
						key={tab.id}
						ref={(el) => {
							if (el) tabRefs.current.set(tab.id, el);
							else tabRefs.current.delete(tab.id);
						}}
						onPointerDown={(e) => {
							if (e.button !== 0) return;
							dragState.current = {
								fromId: tab.id,
								toId: null,
								dragging: false,
								startX: e.clientX,
								startY: e.clientY,
							};
						}}
						className={cn(
							"relative shrink-0 select-none cursor-grab transition-opacity duration-150",
							// Source tab fades out while being dragged
							isBeingDragged && "opacity-30",
						)}
					>
						{/* Drop indicator — blue bar + background tint on the target tab */}
						{isDragOver && (
							<>
								<span className="pointer-events-none absolute inset-y-0.5 left-0 z-50 w-[3px] rounded-full bg-primary shadow-[0_0_6px_1px] shadow-primary/60" />
								<span className="pointer-events-none absolute inset-0 z-10 rounded-sm bg-primary/8" />
							</>
						)}
						<ContextMenu>
							<ContextMenuTrigger asChild>
								<div
									onClick={() => {
										if (!dragState.current.dragging) onSwitchTab(tab.id);
									}}
									className={cn(
										"group/tab flex h-8 shrink-0 items-center gap-2 border border-transparent bg-transparent px-3 transition-[color,background-color,border-color]",
										isActive
											? "border-border-subtle bg-surface-3 text-foreground"
											: "border-border/42 text-foreground/60 hover:border-border/60 hover:bg-surface-2 hover:text-foreground/84",
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
										isActive ? "text-foreground" : "text-foreground/68",
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
												"shell-icon-button ml-1 size-6 text-foreground/36 hover:bg-surface-2 hover:text-foreground",
												isActive ? "opacity-100" : "opacity-0 group-hover/tab:opacity-100",
											)}
										>
											<X size={11} />
										</Button>
									)}
								</div>
							</ContextMenuTrigger>
							<ContextMenuContent className="w-44">
								<ContextMenuItem onClick={() => handleCopySql(tab)}>
									<Copy size={11} className="mr-2" />Copy SQL
								</ContextMenuItem>
								{onDuplicateTab && (
									<ContextMenuItem onClick={() => onDuplicateTab(tab.id)}>
										<Copy size={11} className="mr-2" />Duplicate tab
									</ContextMenuItem>
								)}
								<ContextMenuSeparator />
								<ContextMenuItem onClick={() => onCloseTab(tab.id)}>
									<X size={11} className="mr-2" />Close tab
								</ContextMenuItem>
								{onCloseOthers && tabs.length > 1 && (
									<ContextMenuItem onClick={() => onCloseOthers(tab.id)}>
										<CopyX size={11} className="mr-2" />Close others
									</ContextMenuItem>
								)}
								{onCloseRight && hasRight && (
									<ContextMenuItem onClick={() => onCloseRight(tab.id)}>
										<ArrowRight size={11} className="mr-2" />Close to the right
									</ContextMenuItem>
								)}
							</ContextMenuContent>
						</ContextMenu>
					</div>
				);
			})}

			{/* Floating ghost tab — follows the cursor, position set via direct DOM */}
			<div
				ref={ghostRef}
				className="pointer-events-none fixed left-0 top-0 z-[9999] opacity-0 transition-opacity duration-100 will-change-transform"
				style={{ transform: "translate(0px, 0px)" }}
			>
				<div className="flex h-8 items-center gap-2 rounded border border-primary/40 bg-surface-elevated px-3 shadow-xl ring-1 ring-primary/20 backdrop-blur-sm">
					{GhostIcon && (
						<GhostIcon
							size={13}
							className={cn("shrink-0", ghostMeta?.iconClassName)}
						/>
					)}
					<span className="max-w-[160px] truncate text-[11px] font-medium text-foreground">
						{draggingTab?.label ?? ""}
					</span>
				</div>
			</div>

			{/* New tab button */}
			{connectedIds.length > 0 && (
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="outline"
							size="sm"
							onClick={onNewTab}
							className="my-auto ml-2 h-8 shrink-0 gap-1.5 rounded-md border-border-subtle bg-surface-2 px-3.5 text-[12px] font-medium text-foreground/76 hover:bg-surface-3 hover:text-foreground"
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
