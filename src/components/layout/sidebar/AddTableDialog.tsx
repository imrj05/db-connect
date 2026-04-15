import { useState } from "react";
import { Plus, GripVertical, X, ChevronsUpDown, Check, Eye, EyeOff, Table2, ToggleLeft, ToggleRight } from "lucide-react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Command,
	CommandEmpty,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { DatabaseType } from "@/types";

function TypeCombobox({
	value,
	types,
	onChange,
}: {
	value: string;
	types: string[];
	onChange: (v: string) => void;
}) {
	const [open, setOpen] = useState(false);
	return (
		<PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
			<PopoverPrimitive.Trigger asChild>
				<button
					role="combobox"
					aria-expanded={open}
					className={cn(
						"h-8 px-2.5 shrink-0 flex items-center justify-between gap-1.5 rounded-md border transition-all text-[11px] font-mono",
						"hover:bg-accent hover:text-accent-foreground",
						"focus:outline-none focus:ring-2 focus:ring-ring/50",
						open
							? "border-primary/50 bg-primary/5 text-foreground"
							: "border-border/60 bg-background text-foreground/80"
					)}
				>
					<span className="truncate max-w-[100px]">{value}</span>
					<ChevronsUpDown className="size-3 shrink-0 opacity-50" />
				</button>
			</PopoverPrimitive.Trigger>

			<PopoverPrimitive.Content
				side="bottom"
				align="start"
				sideOffset={4}
				avoidCollisions
				collisionPadding={8}
				style={{ zIndex: 200 }}
				className={cn(
					"w-56 p-0 rounded-lg bg-popover text-popover-foreground shadow-lg border border-border/50",
					"origin-[--radix-popover-content-transform-origin]",
					"data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
					"data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
				)}
			>
				<Command>
					<CommandInput placeholder="Search type..." className="text-[11px] font-mono h-8" />
					<CommandList className="max-h-56">
						<CommandEmpty className="text-[11px] py-6 text-center text-muted-foreground">No type found.</CommandEmpty>
						{types.map((t) => (
							<CommandItem
								key={t}
								value={t}
								onSelect={() => { onChange(t); setOpen(false); }}
								className="text-[11px] font-mono py-2"
							>
								<Check className={cn("mr-2 size-3 shrink-0", value === t ? "opacity-100 text-primary" : "opacity-0")} />
								{t}
							</CommandItem>
						))}
					</CommandList>
				</Command>
			</PopoverPrimitive.Content>
		</PopoverPrimitive.Root>
	);
}

type ColDef = {
	id: string;
	name: string;
	type: string;
	nullable: boolean;
	isPrimary: boolean;
	defaultValue: string;
	comment: string;
};

const COL_TYPES: Record<DatabaseType, string[]> = {
	postgresql: [
		"TEXT", "VARCHAR(255)", "CHAR(1)",
		"INTEGER", "SMALLINT", "BIGINT", "SERIAL", "BIGSERIAL",
		"BOOLEAN",
		"FLOAT", "REAL", "DOUBLE PRECISION", "DECIMAL", "NUMERIC", "MONEY",
		"TIMESTAMP", "TIMESTAMPTZ", "DATE", "TIME", "TIMETZ", "INTERVAL",
		"JSON", "JSONB",
		"UUID",
		"BYTEA",
		"INET", "CIDR", "MACADDR",
		"TSVECTOR", "TSQUERY",
		"OID",
	],
	mysql: [
		"VARCHAR(255)", "CHAR(1)", "TINYTEXT", "TEXT", "MEDIUMTEXT", "LONGTEXT",
		"TINYINT", "SMALLINT", "MEDIUMINT", "INT", "BIGINT",
		"BOOLEAN",
		"FLOAT", "DOUBLE", "DECIMAL",
		"DATE", "DATETIME", "TIMESTAMP", "TIME", "YEAR",
		"JSON",
		"BINARY", "VARBINARY(255)", "TINYBLOB", "BLOB", "MEDIUMBLOB", "LONGBLOB",
		"ENUM", "SET",
	],
	sqlite: [
		"TEXT", "VARCHAR(255)", "CHAR(1)",
		"INTEGER",
		"REAL",
		"BLOB",
		"NUMERIC", "BOOLEAN",
		"DATE", "DATETIME",
		"JSON",
	],
	mongodb: [],
	redis: [],
};

function qi(n: string, dbType: string): string {
	return dbType === "mysql" ? `\`${n}\`` : `"${n}"`;
}

function buildCreateTableSql(tableName: string, cols: ColDef[], dbType: string): string {
	const pkCols = cols.filter((c) => c.isPrimary);
	const colLines = cols.map((c) => {
		const parts = [qi(c.name, dbType), c.type];
		if (!c.nullable && !c.isPrimary) parts.push("NOT NULL");
		if (c.isPrimary && pkCols.length === 1) parts.push("PRIMARY KEY");
		if (c.defaultValue.trim()) parts.push(`DEFAULT ${c.defaultValue.trim()}`);
		if (c.comment.trim() && dbType === "mysql") parts.push(`COMMENT '${c.comment.trim().replace(/'/g, "''")}'`);
		return "  " + parts.join(" ");
	});
	if (pkCols.length > 1)
		colLines.push(`  PRIMARY KEY (${pkCols.map((c) => qi(c.name, dbType)).join(", ")})`);
	const create = `CREATE TABLE ${qi(tableName, dbType)} (\n${colLines.join(",\n")}\n)`;
	if (dbType !== "mysql") {
		const comments = cols
			.filter((c) => c.comment.trim())
			.map((c) => `COMMENT ON COLUMN ${qi(tableName, dbType)}.${qi(c.name, dbType)} IS '${c.comment.trim().replace(/'/g, "''")}';`);
		if (comments.length) return create + ";\n\n" + comments.join("\n");
	}
	return create;
}

export function AddTableDialog({
	open,
	onOpenChange,
	connectionType,
	connectionName,
	selectedDb,
	onAddTable,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	connectionType: DatabaseType;
	connectionName: string;
	selectedDb?: string;
	onAddTable: (sql: string) => Promise<void>;
}) {
	const dtType = connectionType === "postgresql" ? "TIMESTAMPTZ" : connectionType === "sqlite" ? "TEXT" : "DATETIME";
	const idType = connectionType === "mysql" ? "INT" : "INTEGER";

	const defaultCols = (): ColDef[] => [
		{ id: "c0", name: "id",         type: idType, nullable: false, isPrimary: true,  defaultValue: "AUTO_INCREMENT" in {} ? "" : "", comment: "Primary key" },
		{ id: "c1", name: "created_at", type: dtType, nullable: false, isPrimary: false, defaultValue: "CURRENT_TIMESTAMP", comment: "Record creation timestamp" },
		{ id: "c2", name: "updated_at", type: dtType, nullable: false, isPrimary: false, defaultValue: "CURRENT_TIMESTAMP", comment: "Record last update timestamp" },
	];

	const [newTableName, setNewTableName] = useState("");
	const [colDefs, setColDefs] = useState<ColDef[]>(defaultCols());
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [showPreview, setShowPreview] = useState(true);

	const types = COL_TYPES[connectionType] ?? ["TEXT"];

	const reset = () => {
		setNewTableName("");
		setColDefs(defaultCols());
		setError(null);
	};

	const handleOpenChange = (v: boolean) => {
		onOpenChange(v);
		if (!v) setError(null);
	};

	const handleCreate = async () => {
		if (!newTableName.trim() || colDefs.length === 0) return;
		setLoading(true);
		setError(null);
		try {
			const sql = buildCreateTableSql(newTableName.trim(), colDefs, connectionType);
			await onAddTable(sql);
			onOpenChange(false);
			reset();
		} catch (e) {
			setError(String(e));
		} finally {
			setLoading(false);
		}
	};

	const addColumn = () => {
		setColDefs((prev) => [
			...prev,
			{
				id: `c${Date.now()}`,
				name: "",
				type: types[0] ?? "TEXT",
				nullable: true,
				isPrimary: false,
				defaultValue: "",
				comment: "",
			},
		]);
	};

	const removeColumn = (id: string) => {
		if (colDefs.length > 1) {
			setColDefs((prev) => prev.filter((c) => c.id !== id));
		}
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-5xl flex flex-col max-h-[85vh] p-0 gap-0 overflow-hidden">
				{/* Header */}
				<DialogHeader className="shrink-0 px-6 pt-5 pb-4 border-b border-border/50 bg-muted/20">
					<div className="flex items-center gap-3">
						<div className="size-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
							<Table2 size={20} className="text-primary" />
						</div>
						<div>
							<DialogTitle className="text-base font-semibold">Create New Table</DialogTitle>
							<DialogDescription className="text-[11px] font-mono mt-0.5">
								in <span className="text-foreground/70">{selectedDb ?? connectionName}</span>
							</DialogDescription>
						</div>
					</div>
				</DialogHeader>

				{/* Body */}
				<div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0 overflow-hidden p-6">
					{/* Left Panel - Column Config */}
					<div className="flex flex-col gap-4 flex-1 min-h-0 lg:w-1/2">
						{/* Table Name */}
						<div className="shrink-0">
							<Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 block">
								Table Name
							</Label>
							<div className="relative">
								<span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 text-[12px] font-mono">tb_</span>
								<Input
									value={newTableName}
									onChange={(e) => setNewTableName(e.target.value)}
									placeholder="users"
									className="h-10 pl-7 text-[13px] font-mono pl-8"
									autoComplete="off"
								/>
							</div>
						</div>

						{/* Column List */}
						<div className="flex flex-col gap-2 flex-1 min-h-0">
							<div className="flex items-center justify-between shrink-0">
								<Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
									Columns ({colDefs.length})
								</Label>
								<Button
									variant="ghost"
									size="sm"
									className="h-7 text-[11px] gap-1.5 text-muted-foreground hover:text-foreground hover:bg-accent"
									onClick={addColumn}
								>
									<Plus size={12} /> Add Column
								</Button>
							</div>

							{/* Column Cards */}
							<div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
								{colDefs.map((col, index) => (
									<div
										key={col.id}
										className={cn(
											"rounded-lg border bg-card transition-all",
											col.isPrimary
												? "border-primary/30 bg-primary/5"
												: "border-border/60 bg-background hover:border-border"
										)}
									>
										{/* Column Header */}
										<div className="flex items-center gap-2 px-3 py-2 border-b border-border/40">
											<span className="cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground/50 shrink-0">
												<GripVertical size={14} />
											</span>
											<span className={cn(
												"text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0",
												index === 0 ? "bg-accent-blue/10 text-accent-blue" : "bg-muted text-muted-foreground"
											)}>
												#{index + 1}
											</span>
											<Input
												value={col.name}
												onChange={(e) =>
													setColDefs((prev) =>
														prev.map((c) => c.id === col.id ? { ...c, name: e.target.value } : c),
													)
												}
												placeholder="column_name"
												className="h-6 text-[11px] font-mono flex-1 bg-transparent border-0 p-0 shadow-none focus-visible:ring-0"
												autoComplete="off"
											/>
											{colDefs.length > 1 && (
												<Button
													variant="ghost"
													size="icon-xs"
													className="size-5 text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 shrink-0"
													onClick={() => removeColumn(col.id)}
												>
													<X size={12} />
												</Button>
											)}
										</div>

										{/* Column Body */}
										<div className="px-3 py-2.5 space-y-2.5">
											{/* Type */}
											<div className="flex items-center gap-2">
												<span className="text-[10px] text-muted-foreground/60 w-12 shrink-0">Type</span>
												<TypeCombobox
													value={col.type}
													types={types}
													onChange={(v) =>
														setColDefs((prev) =>
															prev.map((c) => c.id === col.id ? { ...c, type: v } : c)
														)
													}
												/>
											</div>

											{/* Properties */}
											<div className="flex items-center gap-3">
												<span className="text-[10px] text-muted-foreground/60 w-12 shrink-0">Props</span>
												<div className="flex items-center gap-2">
													{/* Nullable Toggle */}
													<Tooltip>
														<TooltipTrigger asChild>
															<button
																onClick={() =>
																	setColDefs((prev) =>
																		prev.map((c) => c.id === col.id ? { ...c, nullable: !c.nullable } : c),
																	)
																}
																className={cn(
																	"flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all",
																	col.nullable
																		? "bg-accent-green/10 text-accent-green border border-accent-green/20"
																		: "bg-muted text-muted-foreground/60 border border-transparent hover:border-border"
																)}
															>
																{col.nullable ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
																NULL
															</button>
														</TooltipTrigger>
														<TooltipContent>Allow NULL values</TooltipContent>
													</Tooltip>

													{/* PK Toggle */}
													<Tooltip>
														<TooltipTrigger asChild>
															<button
																onClick={() =>
																	setColDefs((prev) =>
																		prev.map((c) => c.id === col.id ? { ...c, isPrimary: !c.isPrimary } : c),
																	)
																}
																className={cn(
																	"flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all",
																	col.isPrimary
																		? "bg-primary/10 text-primary border border-primary/20"
																		: "bg-muted text-muted-foreground/60 border border-transparent hover:border-border"
																)}
															>
																<KeyIcon className={col.isPrimary ? "text-primary" : "text-muted-foreground/40"} />
																PK
															</button>
														</TooltipTrigger>
														<TooltipContent>Primary Key</TooltipContent>
													</Tooltip>
												</div>
											</div>

											{/* Default Value */}
											<div className="flex items-center gap-2">
												<span className="text-[10px] text-muted-foreground/60 w-12 shrink-0">Default</span>
												<Input
													value={col.defaultValue}
													onChange={(e) =>
														setColDefs((prev) =>
															prev.map((c) => c.id === col.id ? { ...c, defaultValue: e.target.value } : c),
														)
													}
													placeholder="CURRENT_TIMESTAMP"
													className="h-6 text-[11px] font-mono flex-1 bg-muted/30"
													autoComplete="off"
												/>
											</div>

											{/* Comment */}
											<div className="flex items-center gap-2">
												<span className="text-[10px] text-muted-foreground/60 w-12 shrink-0">Comment</span>
												<Input
													value={col.comment}
													onChange={(e) =>
														setColDefs((prev) =>
															prev.map((c) => c.id === col.id ? { ...c, comment: e.target.value } : c),
														)
													}
													placeholder="Column description..."
													className="h-6 text-[11px] font-mono flex-1 bg-muted/30"
													autoComplete="off"
												/>
											</div>
										</div>
									</div>
								))}
							</div>

							{error && (
								<div className="shrink-0 bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2.5">
									<p className="text-[11px] text-destructive font-mono">{error}</p>
								</div>
							)}
						</div>
					</div>

					{/* Right Panel - SQL Preview */}
					<div className="flex flex-col gap-3 flex-1 min-h-0 lg:w-1/2">
						<div className="flex items-center justify-between shrink-0">
							<Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
								SQL Preview
							</Label>
							<Button
								variant="ghost"
								size="sm"
								className="h-6 text-[10px] gap-1.5 text-muted-foreground hover:text-foreground"
								onClick={() => setShowPreview(!showPreview)}
							>
								{showPreview ? <EyeOff size={12} /> : <Eye size={12} />}
								{showPreview ? "Hide" : "Show"}
							</Button>
						</div>

						{showPreview && (
							<div className="flex-1 min-h-0 rounded-lg border border-border/60 bg-[#1e1e1e] overflow-hidden">
								<div className="h-full overflow-auto p-4">
									<pre className="text-[11px] font-mono leading-relaxed whitespace-pre-wrap">
										<code className="text-[#9cdcfe]">CREATE TABLE</code>
										<code className="text-[#ce9178]"> {qi(newTableName || "table_name", connectionType)} </code>
										<code className="text-[#d4d4d4]">{"("}</code>
										{"\n"}
										{colDefs.map((col, i) => (
											<span key={col.id} className="block ml-4">
												<code className="text-[#9cdcfe]">{qi(col.name || "column_name", connectionType)}</code>
												<code className="text-[#4ec9b0]"> {col.type}</code>
												{!col.nullable && !col.isPrimary && <code className="text-[#569cd6]"> NOT NULL</code>}
												{col.isPrimary && colDefs.filter(c => c.isPrimary).length === 1 && <code className="text-[#569cd6]"> PRIMARY KEY</code>}
												{col.defaultValue.trim() && (
													<>
														<code className="text-[#d4d4d4]"> DEFAULT </code>
														<code className="text-[#b5cea8]">{col.defaultValue.trim()}</code>
													</>
												)}
												{col.comment.trim() && connectionType !== "mysql" && (
													<>
														{","}
														{"\n"}
														<span className="inline-block ml-4">
															<code className="text-[#6a9955]">-- {col.comment.trim()}</code>
														</span>
													</>
												)}
												{i < colDefs.length - 1 && <code className="text-[#d4d4d4]">,</code>}
											</span>
										))}
										{colDefs.filter(c => c.isPrimary).length > 1 && (
											<span className="block ml-4">
												<code className="text-[#d4d4d4]">PRIMARY KEY (</code>
												<code className="text-[#9cdcfe]">
													{colDefs.filter(c => c.isPrimary).map(c => qi(c.name, connectionType)).join(", ")}
												</code>
												<code className="text-[#d4d4d4]">)</code>
											</span>
										)}
										{"\n"}
										<code className="text-[#d4d4d4]">)</code>
									</pre>
								</div>
							</div>
						)}
					</div>
				</div>

				{/* Footer */}
				<div className="shrink-0 flex items-center justify-between gap-4 border-t border-border bg-muted/30 px-6 py-4 rounded-b-xl">
					<div className="text-[10px] text-muted-foreground/50">
						Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-[9px] font-mono">Enter</kbd> to create
					</div>
					<div className="flex items-center gap-2">
						<Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button
							size="sm"
							disabled={!newTableName.trim() || colDefs.length === 0 || loading}
							onClick={handleCreate}
							className="gap-1.5"
						>
							{loading ? (
								<>
									<div className="size-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
									Creating...
								</>
							) : (
								<>
									<Plus size={14} />
									Create Table
								</>
							)}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function KeyIcon({ className }: { className?: string }) {
	return (
		<svg
			width="12"
			height="12"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
		>
			<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
		</svg>
	);
}
