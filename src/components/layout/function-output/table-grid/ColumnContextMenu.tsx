import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export function ColumnContextMenu({
	colCtxMenu,
	hasTableName,
	onClose,
	onSetNull,
	onCopyValues,
	onCopyName,
	onCopyAsTSV,
	onCopyAsJSON,
	onCopyAsMarkdown,
	onCopyAsSQL,
	onCopyForIN,
	onSortAsc,
	onSortDesc,
	onResizeAllToMatch,
	onResizeAllToFitContent,
	onResizeAllFixed,
	onHideColumn,
	onResetLayout,
	onOpenFilter,
	getColSize,
}: {
	colCtxMenu: { x: number; y: number; colId: string } | null;
	hasTableName: boolean;
	onClose: () => void;
	onSetNull: (colId: string) => void;
	onCopyValues: (colId: string) => void;
	onCopyName: (colId: string) => void;
	onCopyAsTSV: (colId: string) => void;
	onCopyAsJSON: (colId: string) => void;
	onCopyAsMarkdown: (colId: string) => void;
	onCopyAsSQL: (colId: string) => void;
	onCopyForIN: (colId: string) => void;
	onSortAsc: (colId: string) => void;
	onSortDesc: (colId: string) => void;
	onResizeAllToMatch: (size: number) => void;
	onResizeAllToFitContent: () => void;
	onResizeAllFixed: () => void;
	onHideColumn: (colId: string) => void;
	onResetLayout: () => void;
	onOpenFilter: (colId: string) => void;
	getColSize: (colId: string) => number;
}) {
	if (!colCtxMenu) return null;

	return createPortal(
		<div
			className="fixed inset-0 z-[9999]"
			onClick={() => onClose()}
			onContextMenu={(e) => {
				e.preventDefault();
				onClose();
			}}
		>
			<div
				className="absolute z-[9999] min-w-[14rem] rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 p-1 text-[13px] animate-in fade-in-0 zoom-in-95 duration-100"
				style={{
					left: Math.min(colCtxMenu.x, window.innerWidth - 234),
					top: Math.min(colCtxMenu.y, window.innerHeight - 400),
				}}
				onClick={(e) => e.stopPropagation()}
			>
				{(() => {
					const { colId } = colCtxMenu;
					const colSize = getColSize(colId);
					const item = (
						label: string,
						action: () => void,
						shortcut?: string,
						destructive?: boolean,
					) => (
						<button
							key={label}
							className={cn(
								"w-full flex items-center justify-between rounded-md px-2 py-1.5 text-left cursor-default select-none transition-colors focus:outline-none",
								destructive
									? "text-destructive hover:bg-destructive/10"
									: "hover:bg-accent hover:text-accent-foreground",
							)}
							onClick={() => {
								action();
								onClose();
							}}
						>
							<span>{label}</span>
							{shortcut && (
								<span className="ml-4 text-xs text-muted-foreground">
									{shortcut}
								</span>
							)}
						</button>
					);
					const sep = (k: string) => (
						<div key={k} className="-mx-1 my-1 h-px bg-border" />
					);
					return [
						hasTableName &&
							item(
								"Set as NULL",
								() => onSetNull(colId),
								undefined,
								true,
							),
						hasTableName && sep("s0"),
						item("Copy", () => onCopyValues(colId), "⌘C"),
						item("Copy column name", () => onCopyName(colId)),
						item("Copy as TSV for Excel", () => onCopyAsTSV(colId)),
						item("Copy as JSON", () => onCopyAsJSON(colId)),
						item("Copy as Markdown", () => onCopyAsMarkdown(colId)),
						item("Copy as SQL", () => onCopyAsSQL(colId)),
						item("Copy for IN statement", () => onCopyForIN(colId)),
						sep("s1"),
						item("Sort ascending", () => onSortAsc(colId)),
						item("Sort descending", () => onSortDesc(colId)),
						sep("s2"),
						item("Resize all columns to match", () =>
							onResizeAllToMatch(colSize),
						),
						item("Resize all columns to fit content", () =>
							onResizeAllToFitContent(),
						),
						item("Resize all columns to fixed width", () =>
							onResizeAllFixed(),
						),
						sep("s3"),
						item(`Hide ${colId}`, () => onHideColumn(colId)),
						item("Reset layout", () => onResetLayout()),
						item("Open column filter", () => onOpenFilter(colId)),
					];
				})()}
			</div>
		</div>,
		document.body,
	);
}
