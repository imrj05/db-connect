import { useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { FilterCondition, FilterOp } from "@/types";

export function RowContextMenu({
	contextMenu,
	hasTableName,
	onClose,
	onEditInModal,
	onSetNull,
	onSetQuickFilter,
	onCopy,
	onCopyColumnName,
	onCopyAsTSV,
	onCopyAsJSON,
	onCopyAsMarkdown,
	onCopyAsSQL,
	onCopyForIN,
	onPaste,
	onCloneRow,
	onDeleteRow,
	onSeeDetails,
}: {
	contextMenu: {
		x: number;
		y: number;
		rowIdx: number;
		col: string | null;
		rowData: Record<string, unknown>;
	} | null;
	hasTableName: boolean;
	onClose: () => void;
	onEditInModal: (rowIdx: number, col: string, value: unknown) => void;
	onSetNull: (rowData: Record<string, unknown>, col: string) => void;
	onSetQuickFilter: (filter: Omit<FilterCondition, "id">) => void;
	onCopy: (value: unknown) => void;
	onCopyColumnName: (col: string) => void;
	onCopyAsTSV: (col: string, value: unknown) => void;
	onCopyAsJSON: (col: string, value: unknown) => void;
	onCopyAsMarkdown: (col: string, value: unknown) => void;
	onCopyAsSQL: (value: unknown) => void;
	onCopyForIN: (value: unknown) => void;
	onPaste: (rowIdx: number, col: string) => void;
	onCloneRow: (rowData: Record<string, unknown>) => void;
	onDeleteRow: (rowData: Record<string, unknown>) => void;
	onSeeDetails: (rowIdx: number) => void;
}) {
	const [showQFSubmenu, setShowQFSubmenu] = useState(false);

	if (!contextMenu) return null;

	return createPortal(
		<div
			className="fixed inset-0 z-[9999]"
			onClick={() => {
				onClose();
				setShowQFSubmenu(false);
			}}
			onContextMenu={(e) => {
				e.preventDefault();
				onClose();
				setShowQFSubmenu(false);
			}}
		>
			{(() => {
				const { x, y, rowIdx, col, rowData } = contextMenu;
				const cellValue = col !== null ? rowData[col] : null;
				const menuW = 224;
				const menuH = hasTableName ? 480 : 340;
				const left = Math.min(x, window.innerWidth - menuW - 8);
				const top =
					y + menuH > window.innerHeight - 8
						? Math.max(8, y - menuH)
						: y;
				const close = () => {
					onClose();
					setShowQFSubmenu(false);
				};
				const item = (
					label: string,
					action: () => void,
					shortcut?: string,
					destructive?: boolean,
					disabled?: boolean,
				) => (
					<button
						key={label}
						disabled={disabled}
						className={cn(
							"w-full flex items-center justify-between rounded-md px-2 py-1.5 text-left cursor-default select-none transition-colors focus:outline-none disabled:opacity-40 disabled:pointer-events-none",
							destructive
								? "text-destructive hover:bg-destructive/10"
								: "hover:bg-accent hover:text-accent-foreground",
						)}
						onClick={() => {
							action();
							close();
						}}
					>
						<span>{label}</span>
						{shortcut && (
							<span className="ml-6 text-xs text-muted-foreground">
								{shortcut}
							</span>
						)}
					</button>
				);
				const sep = (k: string) => (
					<div key={k} className="-mx-1 my-1 h-px bg-border" />
				);
				const qfOps: Array<{
					label: string;
					op: FilterOp;
					value: string;
				}> = col
					? [
							{
								label: `= "${String(cellValue ?? "")}"`,
								op: "=",
								value: String(cellValue ?? ""),
							},
							{
								label: `≠ "${String(cellValue ?? "")}"`,
								op: "!=",
								value: String(cellValue ?? ""),
							},
							{
								label: `Contains "${String(cellValue ?? "")}"`,
								op: "LIKE",
								value: String(cellValue ?? ""),
							},
							{ label: "IS NULL", op: "IS NULL", value: "" },
							{ label: "IS NOT NULL", op: "IS NOT NULL", value: "" },
						]
					: [];
				return (
					<div
						className="absolute z-[9999] min-w-[14rem] rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 p-1 text-[13px] animate-in fade-in-0 zoom-in-95 duration-100"
						style={{ left, top }}
						onClick={(e) => e.stopPropagation()}
					>
						{item(
							"Edit in modal",
							() =>
								col &&
								onEditInModal(rowIdx, col, rowData[col]),
							"⇧Enter",
							false,
							!col || !hasTableName,
						)}
						{hasTableName &&
							col &&
							item("Set as NULL", () =>
								onSetNull(rowData, col),
							)}
						{col && (
							<div className="relative">
								<button
									className="w-full flex items-center justify-between rounded-md px-2 py-1.5 text-left cursor-default select-none transition-colors hover:bg-accent hover:text-accent-foreground"
									onMouseEnter={() => setShowQFSubmenu(true)}
									onClick={(e) => {
										e.stopPropagation();
										setShowQFSubmenu((v) => !v);
									}}
								>
									<span>Quick Filter</span>
									<span className="ml-6 text-xs text-muted-foreground">
										›
									</span>
								</button>
								{showQFSubmenu && (
									<div
										className="absolute left-full top-0 ml-1 min-w-[13rem] rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 p-1 text-[13px]"
										style={{
											left:
												left + menuW + 4 >
												window.innerWidth - 8
													? -4
													: "100%",
										}}
										onMouseLeave={() =>
											setShowQFSubmenu(false)
										}
										onClick={(e) => e.stopPropagation()}
									>
										{qfOps.map((op) => (
											<button
												key={op.label}
												className="w-full flex items-center rounded-md px-2 py-1.5 text-left cursor-default select-none transition-colors hover:bg-accent hover:text-accent-foreground truncate text-[12px] font-mono"
												onClick={() => {
													onSetQuickFilter({
														col: col!,
														op: op.op,
														value: op.value,
														join: "AND",
													});
													close();
												}}
											>
												{op.label}
											</button>
										))}
									</div>
								)}
							</div>
						)}
						{sep("s0")}
						{item(
							"Copy",
							() => col && onCopy(cellValue),
							"⌘C",
							false,
							!col,
						)}
						{item(
							"Copy Column Name",
							() => col && onCopyColumnName(col),
							undefined,
							false,
							!col,
						)}
						{item(
							"Copy as TSV for Excel",
							() => col && onCopyAsTSV(col, cellValue),
							undefined,
							false,
							!col,
						)}
						{item(
							"Copy as JSON",
							() => col && onCopyAsJSON(col, cellValue),
							undefined,
							false,
							!col,
						)}
						{item(
							"Copy as Markdown",
							() => col && onCopyAsMarkdown(col, cellValue),
							undefined,
							false,
							!col,
						)}
						{item(
							"Copy as SQL",
							() => onCopyAsSQL(cellValue),
							undefined,
							false,
							!col,
						)}
						{item(
							"Copy for IN statement",
							() => onCopyForIN(cellValue),
							undefined,
							false,
							!col,
						)}
						{sep("s1")}
						{item(
							"Paste",
							() => col && onPaste(rowIdx, col),
							"⌘V",
							false,
							!col || !hasTableName,
						)}
						{hasTableName &&
							item("Clone row", () => onCloneRow(rowData), "⌘D")}
						{hasTableName &&
							item(
								"Delete row",
								() => onDeleteRow(rowData),
								"Del",
								true,
							)}
						{sep("s2")}
						{item("See details", () => onSeeDetails(rowIdx))}
					</div>
				);
			})()}
		</div>,
		document.body,
	);
}
