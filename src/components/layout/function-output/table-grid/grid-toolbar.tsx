import { useState } from "react";
import {
	Filter,
	FilterX,
	RefreshCw,
	Search,
	Upload,
	Download,
	Pencil,
	Check,
	RotateCcw,
	X,
	Trash2,
	Info,
	PanelRightOpen,
	PanelRightClose,
	Columns3,
	Sigma,
	Paintbrush,
	Plus,
	Timer,
	MoreHorizontal,
	Eye,
} from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	DropdownMenuSub,
	DropdownMenuSubTrigger,
	DropdownMenuSubContent,
	DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ConnectionFunction } from "@/types";

function ColumnVisibilityPanel({
	columnIds,
	hiddenColumns,
	onToggleColumn,
}: {
	columnIds: string[];
	hiddenColumns?: Record<string, boolean>;
	onToggleColumn: (colId: string, visible: boolean) => void;
}) {
	const [search, setSearch] = useState("");
	const filtered = columnIds.filter(
		(id) => !search || id.toLowerCase().includes(search.toLowerCase()),
	);
	return (
		<>
			<div className="px-2.5 py-1.5 border-b border-border-subtle">
				<input
					autoFocus
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					placeholder="Search columns…"
					className="w-full bg-transparent text-[11px] font-mono outline-none text-foreground placeholder:text-foreground/38"
				/>
			</div>
			<div className="max-h-60 overflow-y-auto">
				{filtered.map((colId) => {
					const visible = hiddenColumns?.[colId] !== false;
					return (
						<button
							key={colId}
							type="button"
							onClick={() => onToggleColumn(colId, !visible)}
							className="flex items-center gap-2 w-full px-2 py-1.5 hover:bg-surface-2 cursor-pointer"
						>
							<span
								className={cn(
									"w-3.5 h-3.5 flex items-center justify-center rounded border border-border-subtle shrink-0",
									visible ? "bg-primary border-primary" : "bg-transparent",
								)}
							>
								{visible && <Check size={9} className="text-primary-foreground" />}
							</span>
							<span className="font-mono text-[11px] truncate">{colId}</span>
						</button>
					);
				})}
			</div>
		</>
	);
}

export function GridToolbar({
	fn,
	executionTimeMs,
	filtersActive,
	filterCount,
	showSearchBar,
	cellSearch,
	searchedRowCount,
	totalRowCount,
	pendingEditCount,
	applyPendingLoading,
	viewMode,
	onClearFilters,
	onAddFilter,
	onApplyPendingEdits,
	onResetPendingEdits,
	onRefresh,
	onToggleSearch,
	onSearchChange,
	onClearSearch,
	onToggleImport,
	onExport,
	hasSelectedRows,
	onRenameTable,
	onDropTable,
	showInfo,
	onToggleInfo,
	showRowDetail,
	onToggleRowDetail,
	columnIds,
	hiddenColumns,
	onToggleColumn,
	undoCount = 0,
	onUndo,
	selectedRowCount = 0,
	onBulkDelete,
	bulkDeleteLoading = false,
	showAggFooter,
	onToggleAggFooter,
	showColorRules,
	onToggleColorRules,
	showInsertRow,
	onInsertRow,
	autoRefreshInterval,
	onSetAutoRefresh,
}: {
	fn: ConnectionFunction;
	executionTimeMs: number;
	filtersActive: boolean;
	filterCount: number;
	showSearchBar: boolean;
	cellSearch: string;
	searchedRowCount: number;
	totalRowCount: number;
	pendingEditCount: number;
	applyPendingLoading: boolean;
	viewMode: "data" | "form" | "structure" | "er";
	onClearFilters: () => void;
	onAddFilter: () => void;
	onApplyPendingEdits: () => void;
	onResetPendingEdits: () => void;
	onRefresh: () => Promise<void>;
	onToggleSearch: () => void;
	onSearchChange: (value: string) => void;
	onClearSearch: () => void;
	onToggleImport: () => void;
	onExport?: (preset: import("@/lib/export-utils").ExportPreset, selectedOnly: boolean) => void;
	hasSelectedRows?: boolean;
	onRenameTable: () => void;
	onDropTable: () => void;
	showInfo?: boolean;
	onToggleInfo?: () => void;
	showRowDetail?: boolean;
	onToggleRowDetail?: () => void;
	columnIds?: string[];
	hiddenColumns?: Record<string, boolean>;
	onToggleColumn?: (colId: string, visible: boolean) => void;
	undoCount?: number;
	onUndo?: () => void;
	selectedRowCount?: number;
	onBulkDelete?: () => void;
	bulkDeleteLoading?: boolean;
	showAggFooter?: boolean;
	onToggleAggFooter?: () => void;
	showColorRules?: boolean;
	onToggleColorRules?: () => void;
	showInsertRow?: boolean;
	onInsertRow?: () => void;
	autoRefreshInterval?: number | null;
	onSetAutoRefresh?: (n: number | null) => void;
}) {
	return (
		<>
			{/* Header */}
			<div className="h-10 px-4 flex items-center justify-between border-b border-border-subtle bg-surface-2/92 shrink-0 gap-3 backdrop-blur-sm">
				<span className="text-[13px] font-semibold text-foreground truncate">
					{fn.type === "table"
						? fn.tableName
						: fn.callSignature
								.slice(fn.prefix.length + 1)
								.replace(/\(.*$/, "")}
				</span>
				<div className="flex items-center gap-2 shrink-0">
					<span className="text-[11px] font-mono text-foreground/44 mr-1.5">
						{executionTimeMs}ms
					</span>
					{fn.tableName && (
						<>
							{pendingEditCount > 0 && (
								<span className="rounded-md border border-warning/18 bg-warning/8 px-2 py-1 text-[10px] font-semibold text-warning/86 shadow-xs">
									{pendingEditCount} pending
								</span>
							)}
							<Button
								variant="outline"
								size="sm"
								onClick={onApplyPendingEdits}
								disabled={pendingEditCount === 0 || applyPendingLoading}
								className={cn(
									"h-7 px-3 text-[11px] font-medium border-border-subtle shadow-xs",
									pendingEditCount > 0
										? "bg-accent-green/14 text-accent-green border-accent-green/22 hover:bg-accent-green/18"
										: "bg-surface-elevated text-foreground/42 hover:bg-surface-elevated",
								)}
							>
								<Check size={11} className="mr-1" />
								Apply
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={onResetPendingEdits}
								disabled={pendingEditCount === 0 || applyPendingLoading}
								className={cn(
									"h-7 px-3 text-[11px] font-medium border-border-subtle shadow-xs",
									pendingEditCount > 0
										? "bg-warning/10 text-warning border-warning/22 hover:bg-warning/14"
										: "bg-surface-elevated text-foreground/42 hover:bg-surface-elevated",
								)}
							>
								<RotateCcw size={11} className="mr-1" />
								Reset
							</Button>
						{undoCount > 0 && onUndo && (
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="outline"
										size="sm"
										onClick={onUndo}
										className="h-7 px-3 text-[11px] font-medium border-border-subtle bg-surface-elevated text-foreground/60 hover:bg-surface-2 shadow-xs"
									>
										<RotateCcw size={11} className="mr-1" />
										Undo ({undoCount})
									</Button>
								</TooltipTrigger>
								<TooltipContent>Undo last committed edit (⌘Z)</TooltipContent>
							</Tooltip>
						)}
						{selectedRowCount > 1 && onBulkDelete && (
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="outline"
										size="sm"
										onClick={onBulkDelete}
										disabled={bulkDeleteLoading}
										className="h-7 px-3 text-[11px] font-medium border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 shadow-xs"
									>
										<Trash2 size={11} className="mr-1" />
										{bulkDeleteLoading ? "Deleting…" : `Delete ${selectedRowCount} rows`}
									</Button>
								</TooltipTrigger>
								<TooltipContent>Delete all selected rows</TooltipContent>
							</Tooltip>
						)}
						</>
					)}
					{viewMode === "data" && (
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="outline"
									size="sm"
								onClick={() => {
									if (filtersActive) {
										onClearFilters();
									} else {
										onAddFilter();
									}
								}}
								className={cn(
									"h-7 gap-1.5 rounded-md border-border-subtle px-3 text-[11px] font-medium shadow-xs",
									filtersActive
										? "bg-accent-blue/12 text-accent-blue border-accent-blue/18 hover:bg-accent-blue/16"
										: "bg-surface-elevated text-foreground/68 hover:bg-surface-2",
								)}
							>
								<span className="relative">
									{filtersActive ? (
										<FilterX size={11} />
										) : (
											<Filter size={11} />
										)}
										{filtersActive && (
											<span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] rounded-full bg-accent-blue text-[8px] font-black text-accent-foreground flex items-center justify-center px-0.5 leading-none">
												{filterCount}
											</span>
										)}
								</span>
								Filters
							</Button>
						</TooltipTrigger>
						<TooltipContent>Toggle filters</TooltipContent>
						</Tooltip>
					)}
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="outline"
									size="sm"
									onClick={onRefresh}
								className="h-7 rounded-md border-border-subtle bg-surface-elevated px-3 text-[11px] font-medium text-foreground/68 shadow-xs hover:bg-surface-2"
								>
									<RefreshCw size={11} />
									Refresh
							</Button>
						</TooltipTrigger>
						<TooltipContent>Refresh table</TooltipContent>
					</Tooltip>
					{viewMode === "data" && (
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
								variant="outline"
								size="sm"
								onClick={onToggleSearch}
								className={cn(
									"h-7 gap-1.5 rounded-md border-border-subtle px-3 text-[11px] font-medium shadow-xs",
									cellSearch
										? "bg-accent-purple/12 text-accent-purple border-accent-purple/18 hover:bg-accent-purple/16"
										: showSearchBar
											? "bg-surface-selected/72 text-foreground"
											: "bg-surface-elevated text-foreground/68 hover:bg-surface-2",
								)}
							>
									<span className="relative">
										<Search size={11} />
										{cellSearch && (
											<span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] rounded-full bg-accent-blue text-[8px] font-black text-accent-foreground flex items-center justify-center px-0.5 leading-none">
												{searchedRowCount}
											</span>
										)}
								</span>
								Search
							</Button>
						</TooltipTrigger>
						<TooltipContent>Search cells (⌘F)</TooltipContent>
						</Tooltip>
					)}
					{viewMode === "data" && (
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="outline"
									size="sm"
									onClick={onToggleImport}
								className="h-7 rounded-md border-border-subtle bg-surface-elevated px-3 text-[11px] font-medium text-foreground/68 shadow-xs hover:bg-surface-2"
								>
								<Upload size={11} />
								Import
							</Button>
						</TooltipTrigger>
						<TooltipContent>Import data</TooltipContent>
						</Tooltip>
					)}
					{viewMode === "data" && onExport && (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="outline"
									size="sm"
									className="h-7 rounded-md border-border-subtle bg-surface-elevated px-3 text-[11px] font-medium text-foreground/68 shadow-xs hover:bg-surface-2"
								>
									<Download size={11} />
									Export
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="min-w-[180px]">
								<DropdownMenuItem onClick={() => onExport("csv", false)}>
									Export as CSV
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => onExport("tsv", false)}>
									Export as TSV
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => onExport("json", false)}>
									Export as JSON
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => onExport("sql-inserts", false)}>
									Export as SQL INSERTs
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => onExport("markdown", false)}>
									Export as Markdown Table
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem onClick={() => onExport("clipboard-tsv", false)}>
									Copy to Clipboard (TSV)
								</DropdownMenuItem>
								{hasSelectedRows && (
									<>
										<DropdownMenuSeparator />
										<DropdownMenuItem onClick={() => onExport("csv", true)}>
											Export Selected Rows (CSV)
										</DropdownMenuItem>
										<DropdownMenuItem onClick={() => onExport("clipboard-tsv", true)}>
											Copy Selected Rows
										</DropdownMenuItem>
									</>
								)}
							</DropdownMenuContent>
						</DropdownMenu>
					)}
			{fn.tableName && viewMode === "data" && onInsertRow && (
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								onClick={onInsertRow}
								className={cn(
									"h-7 rounded-md border-border-subtle px-3 text-[11px] font-medium shadow-xs",
									showInsertRow
										? "bg-accent-green/12 text-accent-green border-accent-green/22 hover:bg-accent-green/16"
										: "bg-surface-elevated text-foreground/68 hover:bg-surface-2",
								)}
							>
								<Plus size={11} />
								New Row
							</Button>
						</TooltipTrigger>
						<TooltipContent>Insert new row</TooltipContent>
					</Tooltip>
				)}
				{/* View dropdown — Columns, Aggregation, Color rules, Auto-refresh */}
				{viewMode === "data" && (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								className="h-7 rounded-md border-border-subtle bg-surface-elevated px-3 text-[11px] font-medium text-foreground/68 shadow-xs hover:bg-surface-2"
							>
								<Eye size={11} />
								View
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="min-w-[200px]">
							{/* Columns sub-menu */}
							{columnIds && columnIds.length > 0 && onToggleColumn && (
								<DropdownMenuSub>
									<DropdownMenuSubTrigger className="text-[11px] gap-2">
										<Columns3 size={11} />
										Columns
									</DropdownMenuSubTrigger>
									<DropdownMenuSubContent className="p-0 min-w-[180px]">
										<ColumnVisibilityPanel
											columnIds={columnIds}
											hiddenColumns={hiddenColumns}
											onToggleColumn={onToggleColumn}
										/>
									</DropdownMenuSubContent>
								</DropdownMenuSub>
							)}
							{/* Aggregation footer */}
							{onToggleAggFooter && (
								<DropdownMenuCheckboxItem
									checked={!!showAggFooter}
									onCheckedChange={onToggleAggFooter}
									className="text-[11px] gap-2"
								>
									<Sigma size={11} />
									Aggregation footer
								</DropdownMenuCheckboxItem>
							)}
							{/* Color rules */}
							{onToggleColorRules && (
								<DropdownMenuCheckboxItem
									checked={!!showColorRules}
									onCheckedChange={onToggleColorRules}
									className="text-[11px] gap-2"
								>
									<Paintbrush size={11} />
									Color rules
								</DropdownMenuCheckboxItem>
							)}
							{/* Auto-refresh sub-menu */}
							{onSetAutoRefresh && (
								<>
									<DropdownMenuSeparator />
									<DropdownMenuSub>
										<DropdownMenuSubTrigger className="text-[11px] gap-2">
											<span className="relative">
												<Timer size={11} />
												{autoRefreshInterval && (
													<span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
												)}
											</span>
											Auto-refresh
											{autoRefreshInterval && (
												<span className="ml-auto text-[10px] text-accent-green font-medium">
													{autoRefreshInterval < 60
														? `${autoRefreshInterval}s`
														: `${autoRefreshInterval / 60}m`}
												</span>
											)}
										</DropdownMenuSubTrigger>
										<DropdownMenuSubContent className="text-[11px] w-[130px]">
											{(
												[
													{ label: "Off", value: null },
													{ label: "30 seconds", value: 30 },
													{ label: "1 minute", value: 60 },
													{ label: "5 minutes", value: 300 },
												] as { label: string; value: number | null }[]
											).map(({ label, value }) => (
												<DropdownMenuItem
													key={label}
													onClick={() => onSetAutoRefresh(value)}
													className={cn(
														"gap-2 cursor-pointer",
														autoRefreshInterval === value && "font-semibold text-primary",
													)}
												>
													{label}
													{autoRefreshInterval === value && (
														<span className="ml-auto text-primary">✓</span>
													)}
												</DropdownMenuItem>
											))}
										</DropdownMenuSubContent>
									</DropdownMenuSub>
								</>
							)}
						</DropdownMenuContent>
					</DropdownMenu>
				)}
				{/* More (...) dropdown — Info, Row detail, Rename, Drop table */}
				{fn.tableName && (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								className="h-7 rounded-md border-border-subtle bg-surface-elevated px-3 text-[11px] font-medium text-foreground/68 shadow-xs hover:bg-surface-2"
							>
								<MoreHorizontal size={11} />
								More
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="min-w-[180px]">
							{onToggleInfo && (
								<DropdownMenuItem
									onClick={onToggleInfo}
									className={cn("text-[11px] gap-2", showInfo && "text-accent-blue")}
								>
									<Info size={11} />
									{showInfo ? "Hide table info" : "Table info"}
								</DropdownMenuItem>
							)}
							{onToggleRowDetail && (
								<DropdownMenuItem
									onClick={onToggleRowDetail}
									className={cn("text-[11px] gap-2", showRowDetail && "text-accent-blue")}
								>
									{showRowDetail ? <PanelRightClose size={11} /> : <PanelRightOpen size={11} />}
									{showRowDetail ? "Close row detail" : "Row detail"}
								</DropdownMenuItem>
							)}
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={onRenameTable}
								className="text-[11px] gap-2"
							>
								<Pencil size={11} />
								Rename table
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={onDropTable}
								className="text-[11px] gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
							>
								<Trash2 size={11} />
								Drop table
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				)}
				</div>
			</div>
			{/* Search bar */}
			{showSearchBar && viewMode === "data" && (
				<div className="shrink-0 border-b border-border-subtle bg-surface-2/86">
					<div className="flex items-center gap-2.5 px-3 py-2">
						{/* Search icon */}
						<div className="w-8 h-8 flex items-center justify-center shrink-0">
							<Search size={15} className="text-foreground/45" />
						</div>
						
						{/* Search input */}
						<div className="flex-1 relative">
							<Input
								autoFocus
								value={cellSearch}
								onChange={(e) => onSearchChange(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Escape") {
										onClearSearch();
									}
								}}
								placeholder="Search in all columns…"
								className="h-9 text-[12px] bg-surface-elevated/96 border-border-subtle pr-20"
							/>
							{/* Result count badge */}
							{cellSearch && (
								<span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-foreground/60 bg-muted px-1.5 py-0.5 rounded-md">
									{searchedRowCount}/{totalRowCount}
								</span>
							)}
						</div>
						
						{/* Close button */}
						<Button
							variant="ghost"
							size="icon-xs"
							aria-label="Clear search"
							onClick={onClearSearch}
							className="h-8 w-8 text-foreground/58 hover:text-foreground hover:bg-surface-3"
						>
							<X size={14} />
						</Button>
					</div>
				</div>
			)}
		</>
	);
}
