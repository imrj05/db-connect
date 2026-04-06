import {
	Filter,
	FilterX,
	RefreshCw,
	Search,
	Upload,
	Pencil,
	TableProperties,
	X,
} from "lucide-react";
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
	showFilterBar,
	filtersActive,
	filterCount,
	showSearchBar,
	cellSearch,
	searchedRowCount,
	totalRowCount,
	viewMode,
	onToggleFilter,
	onClearFilters,
	onAddFilter,
	onRefresh,
	onToggleSearch,
	onSearchChange,
	onClearSearch,
	onToggleImport,
	onRenameTable,
	onDropTable,
}: {
	fn: ConnectionFunction;
	executionTimeMs: number;
	showFilterBar: boolean;
	filtersActive: boolean;
	filterCount: number;
	showSearchBar: boolean;
	cellSearch: string;
	searchedRowCount: number;
	totalRowCount: number;
	viewMode: "data" | "form" | "structure" | "er";
	onToggleFilter: () => void;
	onClearFilters: () => void;
	onAddFilter: () => void;
	onRefresh: () => Promise<void>;
	onToggleSearch: () => void;
	onSearchChange: (value: string) => void;
	onClearSearch: () => void;
	onToggleImport: () => void;
	onRenameTable: () => void;
	onDropTable: () => void;
}) {
	return (
		<>
			{/* Header */}
			<div className="h-9 px-4 flex items-center justify-between border-b border-border bg-background shrink-0">
				<span className="font-mono text-[11px] text-accent-blue font-bold">
					{fn.type === "table"
						? fn.tableName
						: fn.callSignature
								.slice(fn.prefix.length + 1)
								.replace(/\(.*$/, "")}
				</span>
				<div className="flex items-center gap-1">
					<span className="text-[10px] font-mono text-muted-foreground/40 mr-2">
						{executionTimeMs}ms
					</span>
					{viewMode === "data" && (
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="icon-xs"
									onClick={() => {
										if (filtersActive) {
											onClearFilters();
										} else {
											onToggleFilter();
											if (!showFilterBar && filterCount === 0)
												onAddFilter();
										}
									}}
									className={
										filtersActive
											? "text-accent-blue"
											: showFilterBar
												? "text-foreground"
												: "text-muted-foreground"
									}
								>
									<span className="relative">
										{filtersActive ? (
											<FilterX size={11} />
										) : (
											<Filter size={11} />
										)}
										{filtersActive && (
											<span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] rounded-full bg-accent-blue text-[8px] font-black text-white flex items-center justify-center px-0.5 leading-none">
												{filterCount}
											</span>
										)}
										{showFilterBar && !filtersActive && (
											<span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-accent-blue" />
										)}
									</span>
								</Button>
							</TooltipTrigger>
							<TooltipContent>Toggle filters</TooltipContent>
						</Tooltip>
					)}
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon-xs"
								onClick={onRefresh}
								className="text-muted-foreground"
							>
								<RefreshCw size={11} />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Refresh table</TooltipContent>
					</Tooltip>
					{viewMode === "data" && (
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="icon-xs"
									onClick={onToggleSearch}
									className={cn(
										cellSearch
											? "text-accent-blue"
											: showSearchBar
												? "text-foreground"
												: "text-muted-foreground",
									)}
								>
									<span className="relative">
										<Search size={11} />
										{cellSearch && (
											<span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] rounded-full bg-accent-blue text-[8px] font-black text-white flex items-center justify-center px-0.5 leading-none">
												{searchedRowCount}
											</span>
										)}
									</span>
								</Button>
							</TooltipTrigger>
							<TooltipContent>Search cells (⌘F)</TooltipContent>
						</Tooltip>
					)}
					{viewMode === "data" && (
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="icon-xs"
									onClick={onToggleImport}
									className="text-muted-foreground"
								>
									<Upload size={11} />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Import data</TooltipContent>
						</Tooltip>
					)}
					{fn.tableName && (
						<>
							{/* Rename table */}
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="icon-xs"
										onClick={onRenameTable}
										className="text-muted-foreground"
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
										onClick={onDropTable}
										className="text-destructive/50 hover:text-destructive"
									>
										<TableProperties size={11} />
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
				<div className="shrink-0 border-b border-border bg-card px-3 py-1.5 flex items-center gap-2">
					<Search
						size={11}
						className="text-muted-foreground/40 shrink-0"
					/>
					<Input
						autoFocus
						value={cellSearch}
						onChange={(e) => onSearchChange(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Escape") {
								onClearSearch();
							}
						}}
						placeholder="Search cells…"
						className="h-6 flex-1 text-[11px] font-mono border-0 bg-transparent shadow-none focus-visible:ring-0 px-0"
					/>
					{cellSearch && (
						<span className="text-[9px] font-mono text-muted-foreground/50 shrink-0">
							{searchedRowCount} of {totalRowCount}
						</span>
					)}
					<Button
						variant="ghost"
						size="icon-xs"
						onClick={onClearSearch}
						className="h-5 w-5 text-muted-foreground/40 hover:text-foreground"
					>
						<X size={10} />
					</Button>
				</div>
			)}
		</>
	);
}
