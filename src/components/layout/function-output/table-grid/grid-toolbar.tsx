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
} from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
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
					{viewMode === "data" && columnIds && columnIds.length > 0 && onToggleColumn && (
						<DropdownMenu>
							<Tooltip>
								<TooltipTrigger asChild>
									<DropdownMenuTrigger asChild>
										<Button
											variant="outline"
											size="sm"
											className="h-7 rounded-md border-border-subtle bg-surface-elevated px-2 text-[11px] font-medium text-foreground/68 shadow-xs hover:bg-surface-2"
										>
											<Columns3 size={11} />
										</Button>
									</DropdownMenuTrigger>
								</TooltipTrigger>
								<TooltipContent>Toggle columns</TooltipContent>
							</Tooltip>
							<DropdownMenuContent align="end" className="min-w-[180px] max-h-72 overflow-y-auto">
								{columnIds.map((colId) => {
									const visible = hiddenColumns?.[colId] !== false;
									return (
										<DropdownMenuItem
											key={colId}
											onSelect={(e) => e.preventDefault()}
											onClick={() => onToggleColumn(colId, !visible)}
											className="flex items-center gap-2"
										>
											<span className={cn("w-3.5 h-3.5 flex items-center justify-center rounded border border-border-subtle shrink-0", visible ? "bg-primary border-primary" : "bg-transparent")}>
												{visible && <Check size={9} className="text-primary-foreground" />}
											</span>
											<span className="font-mono text-[11px] truncate">{colId}</span>
										</DropdownMenuItem>
									);
								})}
							</DropdownMenuContent>
						</DropdownMenu>
					)}
					{/* Aggregation footer toggle */}
					{viewMode === "data" && onToggleAggFooter && (
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="outline"
									size="sm"
									onClick={onToggleAggFooter}
									className={cn(
										"h-7 rounded-md border-border-subtle px-2 text-[11px] font-medium shadow-xs",
										showAggFooter
											? "bg-accent-blue/12 text-accent-blue border-accent-blue/22 hover:bg-accent-blue/16"
											: "bg-surface-elevated text-foreground/68 hover:bg-surface-2",
									)}
								>
									<Sigma size={11} />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Aggregation footer (Σ)</TooltipContent>
						</Tooltip>
					)}
					{/* Color rules toggle */}
					{viewMode === "data" && onToggleColorRules && (
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="outline"
									size="sm"
									onClick={onToggleColorRules}
									className={cn(
										"h-7 rounded-md border-border-subtle px-2 text-[11px] font-medium shadow-xs",
										showColorRules
											? "bg-accent-purple/12 text-accent-purple border-accent-purple/22 hover:bg-accent-purple/16"
											: "bg-surface-elevated text-foreground/68 hover:bg-surface-2",
									)}
								>
									<Paintbrush size={11} />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Conditional cell color rules</TooltipContent>
						</Tooltip>
					)}
					{fn.tableName && (
						<>
						{/* Info panel toggle */}
						{onToggleInfo && (
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="icon-xs"
										aria-label="Table info"
										onClick={onToggleInfo}
										className={cn(
											"text-foreground/48 hover:bg-surface-3",
											showInfo && "bg-accent-blue/10 text-accent-blue",
										)}
									>
										<Info size={11} />
									</Button>
								</TooltipTrigger>
								<TooltipContent>Table info</TooltipContent>
							</Tooltip>
						)}
						{/* Row detail panel toggle */}
						{onToggleRowDetail && (
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="icon-xs"
										aria-label="Row detail"
										onClick={onToggleRowDetail}
										className={cn(
											"text-foreground/48 hover:bg-surface-3",
											showRowDetail && "bg-accent-blue/10 text-accent-blue",
										)}
									>
										{showRowDetail ? <PanelRightClose size={11} /> : <PanelRightOpen size={11} />}
									</Button>
								</TooltipTrigger>
								<TooltipContent>Row detail (double-click row)</TooltipContent>
							</Tooltip>
						)}
							{/* Rename table */}
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
								variant="ghost"
								size="icon-xs"
								aria-label="Rename table"
								onClick={onRenameTable}
								className="text-foreground/48 hover:bg-surface-3"
							>
										<Pencil size={11} />
									</Button>
								</TooltipTrigger>
								<TooltipContent>Rename table</TooltipContent>
							</Tooltip>
							{/* Drop table */}
							<Tooltip>
								<TooltipTrigger asChild>
								<Button
								variant="ghost"
								size="icon-xs"
								aria-label="Drop table"
								onClick={onDropTable}
								className="text-destructive/60 hover:text-destructive hover:bg-destructive/10"
							>
									<Trash2 size={11} />
								</Button>
								</TooltipTrigger>
								<TooltipContent>Drop table</TooltipContent>
							</Tooltip>
						</>
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
