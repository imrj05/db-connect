import { useState, useMemo } from "react";
import {
	ChevronDown,
	ChevronRight,
	Plus,
	Loader2,
	Plug,
	RefreshCw,
	TableProperties,
	ChevronsDown,
	ChevronsUp,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { DB_LOGO, DB_COLOR } from "@/lib/db-ui";
import { GROUP_PRESETS } from "@/components/layout/connection-dialog-modal";
import { ConnectionConfig, ConnectionFunction, ColumnInfo } from "@/types";
import { SchemaGroup } from "@/components/layout/sidebar/schema-group";
import { AddTableDialog } from "@/components/layout/sidebar/add-table-dialog";

export function DatabaseNode({
	connection,
	isConnected,
	isLoading,
	tableFns,
	tableInfoMap,
	activeFunctionId,
	filter,
	selectedDb,
	onConnect,
	onInvoke,
	onRefreshTables,
	onAddTable,
	onLoadColumns,
}: {
	connection: ConnectionConfig;
	isConnected: boolean;
	isLoading: boolean;
	tableFns: ConnectionFunction[];
	tableInfoMap: Record<string, ColumnInfo[]>;
	activeFunctionId?: string;
	filter: string;
	selectedDb?: string;
	onConnect: () => void;
	onInvoke: (fn: ConnectionFunction) => void;
	onRefreshTables: () => Promise<void>;
	onAddTable: (sql: string) => Promise<void>;
	onLoadColumns: (tableName: string) => Promise<void>;
}) {
	const [open, setOpen] = useState(true);
	const [expandAll, setExpandAll] = useState<boolean | null>(null);
	const [isRefreshingTables, setIsRefreshingTables] = useState(false);
	const [addTableOpen, setAddTableOpen] = useState(false);

	const Logo = DB_LOGO[connection.type] ?? DB_LOGO.postgresql;
	const logoColor = DB_COLOR[connection.type] ?? "text-muted-foreground";

	const handleRefreshTables = async () => {
		setIsRefreshingTables(true);
		try {
			await Promise.all([onRefreshTables(), new Promise((r) => setTimeout(r, 800))]);
		} finally {
			setIsRefreshingTables(false);
		}
	};

	const filtered = useMemo(() => {
		const q = filter.trim().toLowerCase();
		if (!q) return tableFns;
		return tableFns.filter((f) => (f.tableName ?? "").toLowerCase().includes(q));
	}, [tableFns, filter]);

	const bySchema = useMemo(() => {
		const groups: Record<string, ConnectionFunction[]> = {};
		for (const fn of filtered) {
			const schema = tableInfoMap[fn.tableName ?? ""]
				? Object.keys(tableInfoMap).length > 0
					? (fn as any).schema ?? "public"
					: "public"
				: "public";
			(groups[schema] ??= []).push(fn);
		}
		return groups;
	}, [filtered, tableInfoMap]);

	const schemaKeys = Object.keys(bySchema);
	const showSchemaLabels = schemaKeys.length > 1 || (schemaKeys.length === 1 && schemaKeys[0] !== "public");

	return (
		<div className="border-b border-border/50">
			{/* DB name row */}
			<button
				onClick={() => isConnected ? setOpen((v) => !v) : onConnect()}
				className={cn(
					"group w-full flex items-center gap-2 h-8 px-2 transition-colors select-none",
					"hover:bg-muted/40 text-foreground",
				)}
			>
				<span className="text-muted-foreground/40 shrink-0 w-3">
					{isConnected
						? open ? <ChevronDown size={11} /> : <ChevronRight size={11} />
						: <ChevronRight size={11} />}
				</span>
				<Logo className={cn("text-[14px] shrink-0", logoColor)} />
				<span className="text-[12px] font-mono font-semibold flex-1 text-left truncate min-w-0">
					{connection.name}
				</span>
				{connection.group && (() => {
					const preset = GROUP_PRESETS.find(p => p.id === connection.group);
					return (
						<span className={cn(
							"shrink-0 px-1.5 h-[14px] flex items-center rounded text-[8px] font-bold uppercase tracking-wide border",
							preset ? preset.activeClass : "bg-muted/50 border-border/50 text-muted-foreground/60"
						)}>
							{connection.group}
						</span>
					);
				})()}
				{isLoading && <Loader2 size={10} className="animate-spin text-muted-foreground/40 shrink-0" />}
				{!isConnected && !isLoading && (
					<Plug size={10} className="text-muted-foreground/70 shrink-0 group-hover:text-primary/60 transition-colors" />
				)}
			</button>

			{/* Tables header */}
			{isConnected && open && (
				<div className="flex items-center gap-1 h-7 px-2 border-b border-border/30 shrink-0">
					<TableProperties size={11} className="shrink-0 text-muted-foreground/30" />
					<span className="text-[9px] font-mono font-bold uppercase tracking-[0.18em] text-muted-foreground/35 flex-1">
						Tables
					</span>
					{!isLoading && tableFns.length > 0 && (
						<span className="text-[9px] font-mono text-muted-foreground/40 tabular-nums mr-0.5">
							{filter.trim() ? `${filtered.length}/` : ""}{tableFns.length}
						</span>
					)}
					<Tooltip>
						<TooltipTrigger asChild>
							<button
								onClick={() => setAddTableOpen(true)}
								className="flex items-center justify-center w-5 h-5 text-muted-foreground/35 hover:text-foreground transition-colors"
							>
								<Plus size={11} />
							</button>
						</TooltipTrigger>
						<TooltipContent side="right" sideOffset={4}>Add table</TooltipContent>
					</Tooltip>
					<Tooltip>
						<TooltipTrigger asChild>
							<button
								onClick={handleRefreshTables}
								disabled={isRefreshingTables}
								className="flex items-center justify-center w-5 h-5 text-muted-foreground/35 hover:text-foreground transition-colors disabled:opacity-40"
							>
								<RefreshCw size={11} className={isRefreshingTables ? "animate-spin" : ""} />
							</button>
						</TooltipTrigger>
						<TooltipContent side="right" sideOffset={4}>Refresh tables</TooltipContent>
					</Tooltip>
					{tableFns.length > 0 && (
						<Tooltip>
							<TooltipTrigger asChild>
								<button
									onClick={() => setExpandAll((v) => v === true ? false : true)}
									className="flex items-center justify-center w-5 h-5 text-muted-foreground/35 hover:text-foreground transition-colors"
								>
									{expandAll === true ? <ChevronsUp size={11} /> : <ChevronsDown size={11} />}
								</button>
							</TooltipTrigger>
							<TooltipContent side="right" sideOffset={4}>
								{expandAll === true ? "Collapse all" : "Expand all"}
							</TooltipContent>
						</Tooltip>
					)}
				</div>
			)}

			{/* Add Table dialog */}
			<AddTableDialog
				open={addTableOpen}
				onOpenChange={setAddTableOpen}
				connectionType={connection.type}
				connectionName={connection.name}
				selectedDb={selectedDb}
				onAddTable={onAddTable}
			/>

			{/* Tree */}
			{isConnected && open && (
				<div className="pb-1">
					{isLoading ? (
						<div className="flex items-center gap-2 px-4 py-2">
							<Loader2 size={10} className="animate-spin text-muted-foreground/30" />
							<span className="text-[10px] font-mono text-muted-foreground/30">Loading…</span>
						</div>
					) : tableFns.length === 0 ? (
						<p className="px-4 py-2 text-[10px] font-mono text-muted-foreground/30">
							No tables
						</p>
					) : filtered.length === 0 ? (
						<p className="px-4 py-2 text-[10px] font-mono text-muted-foreground/30">
							No match
						</p>
					) : (
						<div className="pl-2 w-full min-w-0 overflow-hidden">
							{schemaKeys.map((schema) => (
								<SchemaGroup
									key={schema}
									schema={schema}
									fns={bySchema[schema]}
									tableInfoMap={tableInfoMap}
									activeFunctionId={activeFunctionId}
									onInvoke={onInvoke}
									showLabel={showSchemaLabels}
									forceOpen={expandAll}
									onLoadColumns={onLoadColumns}
								/>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
