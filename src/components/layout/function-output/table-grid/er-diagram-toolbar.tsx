import {
	Check,
	Download,
	Edit3,
	Filter,
	Image as ImageIcon,
	Link2,
	LocateFixed,
	Plus,
	RefreshCcw,
	Save,
	X,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type ERDiagramToolbarProps = {
	totalTables: number;
	filteredTables: number;
	totalRelations: number;
	allSchemas: string[];
	selectedSchemas: Set<string> | null;
	isFiltered: boolean;
	activeSchemaCount: number;
	isEditing: boolean;
	experimentalEnabled: boolean;
	isRefreshing: boolean;
	hasChanges: boolean;
	onToggleEdit: () => void;
	onAddTable: () => void;
	onSave: () => void;
	onDiscard: () => void;
	onSchemaToggle: (schema: string) => void;
	onSelectAllSchemas: () => void;
	onExportPng: () => void;
	onExportSvg: () => void;
	onZoomIn: () => void;
	onZoomOut: () => void;
	onFit: () => void;
	onRetry: () => void;
	isSchemaSelected: (schema: string) => boolean;
};

export function ERDiagramToolbar({
	totalTables,
	filteredTables,
	totalRelations,
	allSchemas,
	isFiltered,
	activeSchemaCount,
	isEditing,
	experimentalEnabled,
	isRefreshing,
	hasChanges,
	onToggleEdit,
	onAddTable,
	onSave,
	onDiscard,
	onSchemaToggle,
	onSelectAllSchemas,
	onExportPng,
	onExportSvg,
	onZoomIn,
	onZoomOut,
	onFit,
	onRetry,
	isSchemaSelected,
}: ERDiagramToolbarProps) {
	return (
		<div className="h-10 shrink-0 border-b border-border px-3 flex items-center justify-between bg-card/80 backdrop-blur-sm">
			<div className="flex items-center gap-3 min-w-0">
				<div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/55">
					<Link2 size={11} className="text-accent-blue/60" />
					ER Diagram
					{isEditing && (
						<span className="text-accent-orange/70 font-normal tracking-normal ml-1">
							· EDITING
						</span>
					)}
				</div>
				<span className="text-[10px] font-mono text-muted-foreground/40">
					{filteredTables}
					{isFiltered ? `/${totalTables}` : ""} tables
				</span>
				<span className="text-[10px] font-mono text-muted-foreground/30">
					{totalRelations} relations
				</span>
				{totalRelations === 0 && (
					<span className="text-[10px] font-mono text-muted-foreground/45 truncate hidden sm:inline">
						No foreign keys found. Showing schema map only.
					</span>
				)}
			</div>
			<div className="flex items-center gap-1 shrink-0">
				{/* Edit mode toggle (only if experimental flag is on) */}
				{experimentalEnabled && (
					<>
						{isEditing ? (
							<>
								<Button
									variant="ghost"
									size="xs"
									onClick={onAddTable}
									className="h-6 px-2 gap-1 text-[10px] font-mono text-muted-foreground/60 hover:text-accent-blue"
									title="Add table"
								>
									<Plus size={11} />
									Table
								</Button>
								<Button
									variant="ghost"
									size="xs"
									onClick={onSave}
									className={cn(
										"h-6 px-2 gap-1 text-[10px] font-mono",
										hasChanges
											? "text-accent-green hover:text-accent-green"
											: "text-muted-foreground/40",
									)}
									title="Review & save changes (Cmd/Ctrl+S)"
									disabled={!hasChanges}
								>
									<Save size={11} />
									Save
								</Button>
								<Button
									variant="ghost"
									size="xs"
									onClick={onDiscard}
									className="h-6 px-2 gap-1 text-[10px] font-mono text-muted-foreground/50 hover:text-destructive"
									title="Discard all changes"
								>
									<X size={11} />
									Discard
								</Button>
								<div className="w-px h-4 bg-border mx-0.5" />
							</>
						) : null}
						<Button
							variant={isEditing ? "default" : "ghost"}
							size="xs"
							onClick={onToggleEdit}
							className={cn(
								"h-6 px-2 gap-1 text-[10px] font-mono",
								isEditing
									? ""
									: "text-muted-foreground/50 hover:text-foreground",
							)}
							title="Toggle schema editor"
						>
							{isEditing ? (
								<>
									<Check size={11} />
									Editing
								</>
							) : (
								<>
									<Edit3 size={11} />
									Edit
								</>
							)}
						</Button>
						<div className="w-px h-4 bg-border mx-0.5" />
					</>
				)}

				{/* Schema filter */}
				{allSchemas.length > 1 && (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="xs"
								className={cn(
									"h-6 px-2 gap-1.5 text-[10px] font-mono",
									isFiltered
										? "text-primary hover:text-primary"
										: "text-muted-foreground/60 hover:text-foreground",
								)}
							>
								<Filter size={11} />
								<span>
									{isFiltered
										? `${activeSchemaCount}/${allSchemas.length} schemas`
										: "All schemas"}
								</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="min-w-[200px]">
							<DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
								Filter by schema
							</DropdownMenuLabel>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onSelect={(e) => {
									e.preventDefault();
									onSelectAllSchemas();
								}}
								className="text-[11px] font-mono"
							>
								<Check
									size={12}
									className={cn(
										"mr-2",
										!isFiltered ? "opacity-100 text-primary" : "opacity-0",
									)}
								/>
								All schemas
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							{allSchemas.map((schema) => {
								const checked = isSchemaSelected(schema);
								return (
									<DropdownMenuItem
										key={schema}
										onSelect={(e) => {
											e.preventDefault();
											onSchemaToggle(schema);
										}}
										className="text-[11px] font-mono"
									>
										<Check
											size={12}
											className={cn(
												"mr-2",
												checked ? "opacity-100 text-primary" : "opacity-0",
											)}
										/>
										{schema}
									</DropdownMenuItem>
								);
							})}
						</DropdownMenuContent>
					</DropdownMenu>
				)}

				{/* Export */}
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="icon-xs"
							className="text-muted-foreground/50 hover:text-foreground"
							title="Export diagram"
						>
							<Download size={11} />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="min-w-[180px]">
						<DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
							Export diagram
						</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onSelect={(e) => {
								e.preventDefault();
								onExportPng();
							}}
							className="text-[11px] font-mono"
						>
							<ImageIcon size={12} className="mr-2 text-accent-blue/70" />
							PNG image
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={(e) => {
								e.preventDefault();
								onExportSvg();
							}}
							className="text-[11px] font-mono"
						>
							<Download size={12} className="mr-2 text-accent-blue/70" />
							SVG vector
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>

				{/* Zoom controls */}
				<Button
					variant="ghost"
					size="icon-xs"
					onClick={onZoomIn}
					className="text-muted-foreground/50 hover:text-foreground"
				>
					<ZoomIn size={11} />
				</Button>
				<Button
					variant="ghost"
					size="icon-xs"
					onClick={onZoomOut}
					className="text-muted-foreground/50 hover:text-foreground"
				>
					<ZoomOut size={11} />
				</Button>
				<Button
					variant="ghost"
					size="icon-xs"
					onClick={onFit}
					className="text-muted-foreground/50 hover:text-foreground"
				>
					<LocateFixed size={11} />
				</Button>
				<Button
					variant="ghost"
					size="icon-xs"
					onClick={onRetry}
					disabled={isRefreshing}
					className="text-muted-foreground/50 hover:text-foreground"
				>
					<RefreshCcw size={11} className={cn(isRefreshing && "animate-spin")} />
				</Button>
			</div>
		</div>
	);
}
