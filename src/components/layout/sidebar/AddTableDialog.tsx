import { useState } from "react";
import { Reorder } from "framer-motion";
import { Plus, GripVertical, X, ChevronsUpDown, Check } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
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

// Inline (no-portal) combobox — avoids all fixed/transform coordinate drift at
// any browser zoom level. The popup is position:absolute relative to the
// nearest positioned ancestor, so it tracks the trigger exactly.
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
					className="h-7 w-36 shrink-0 flex items-center justify-between gap-1 rounded-md border border-input bg-background px-2 text-[11px] font-mono text-left hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
				>
					<span className="truncate">{value}</span>
					<ChevronsUpDown className="size-3 shrink-0 opacity-40" />
				</button>
			</PopoverPrimitive.Trigger>

			{/* No Portal — renders as a sibling of the trigger in the DOM tree.
			    position:absolute inside the nearest `position:relative` ancestor. */}
			<PopoverPrimitive.Content
				side="bottom"
				align="start"
				sideOffset={4}
				avoidCollisions
				collisionPadding={8}
				style={{ zIndex: 200 }}
				className={cn(
					"w-52 p-0 rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none",
					"origin-[--radix-popover-content-transform-origin]",
					"data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
					"data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
				)}
			>
				<Command>
					<CommandInput placeholder="Search type…" className="text-[11px] font-mono" />
					<CommandList className="max-h-52">
						<CommandEmpty className="text-[11px] py-4">No type found.</CommandEmpty>
						{types.map((t) => (
							<CommandItem
								key={t}
								value={t}
								onSelect={() => { onChange(t); setOpen(false); }}
								className="text-[11px] font-mono"
							>
								<Check className={cn("mr-1 size-3 shrink-0", value === t ? "opacity-100" : "opacity-0")} />
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
		{ id: "c0", name: "id",         type: idType, nullable: false, isPrimary: true,  defaultValue: "", comment: "Primary key" },
		{ id: "c1", name: "created_at", type: dtType, nullable: false, isPrimary: false, defaultValue: "CURRENT_TIMESTAMP", comment: "Record creation timestamp" },
		{ id: "c2", name: "updated_at", type: dtType, nullable: false, isPrimary: false, defaultValue: "CURRENT_TIMESTAMP", comment: "Record last update timestamp" },
	];

	const [newTableName, setNewTableName] = useState("");
	const [colDefs, setColDefs] = useState<ColDef[]>(defaultCols);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

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

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			{/*
			  No overflow-hidden on the content itself — that was causing stacking
			  context issues with the inline (no-portal) TypeCombobox popups.
			  Visual corner clipping is handled by the rounded-xl + the fact that
			  child content stays within the defined flex dimensions.
			*/}
			<DialogContent className="sm:max-w-4xl flex flex-col max-h-[88vh] p-0 gap-0">
				{/* Header */}
				<DialogHeader className="shrink-0 px-5 pt-5 pb-3 border-b border-border/50">
					<DialogTitle className="text-base font-semibold">Create Table</DialogTitle>
					<DialogDescription className="text-[11px] font-mono">
						on <span className="text-foreground/70">{selectedDb ?? connectionName}</span>
					</DialogDescription>
				</DialogHeader>

				{/* Body — no overflow-hidden so inline popovers can escape upward/downward */}
				<div className="flex flex-col gap-4 flex-1 min-h-0 px-5 py-4">
					{/* Table name */}
					<div className="flex items-center gap-3 shrink-0">
						<Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground w-24 shrink-0">
							Table Name
						</Label>
						<Input
							value={newTableName}
							onChange={(e) => setNewTableName(e.target.value)}
							placeholder="e.g. users"
							className="h-8 text-[12px] font-mono flex-1"
							autoComplete="off"
						/>
					</div>

					{/* Columns section */}
					<div className="flex flex-col gap-2 flex-1 min-h-0">
						{/* Column section header */}
						<div className="flex items-center justify-between shrink-0">
							<Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
								Columns
							</Label>
							<Button
								variant="ghost"
								size="xs"
								className="h-6 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
								onClick={() =>
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
									])
								}
							>
								<Plus size={10} /> Add column
							</Button>
						</div>

						{/* Column header labels */}
						<div className="flex items-center gap-2 px-4 shrink-0">
							<span className="w-3 shrink-0" />
							<span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 w-28 shrink-0">Name</span>
							<span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 w-36 shrink-0">Type</span>
							<span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 w-9 shrink-0 text-center">NULL</span>
							<span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 w-8 shrink-0 text-center">PK</span>
							<span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 w-28 shrink-0">Default</span>
							<span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 flex-1">Comment</span>
						</div>

						{/*
						  Scrollable column list.
						  overflow-hidden only on the WRAPPER (visual border clipping), but
						  the Reorder.Group itself drives the scroll with an explicit max-h.
						  The inline combobox popup (position:absolute) will escape the
						  Reorder.Group's overflow-y-auto via the z-index stacking context
						  created by PopoverPrimitive.Content.
						*/}
						<div className="flex-1 min-h-0 rounded-lg border border-border/50 bg-muted/20 overflow-hidden">
							<Reorder.Group
								axis="y"
								values={colDefs}
								onReorder={setColDefs}
								className="flex flex-col divide-y divide-border/40 h-full overflow-y-auto"
							>
								{colDefs.map((col) => (
									<Reorder.Item
										key={col.id}
										value={col}
										className="flex items-center gap-2 px-3 py-2 bg-background hover:bg-muted/30 transition-colors shrink-0"
									>
										{/* Drag handle */}
										<span className="cursor-grab active:cursor-grabbing text-muted-foreground/25 hover:text-muted-foreground/50 shrink-0 touch-none">
											<GripVertical size={12} />
										</span>

										{/* Name */}
										<Input
											value={col.name}
											onChange={(e) =>
												setColDefs((prev) =>
													prev.map((c) => c.id === col.id ? { ...c, name: e.target.value } : c),
												)
											}
											placeholder="column_name"
											className="h-7 text-[11px] font-mono w-28 shrink-0"
											autoComplete="off"
										/>

										{/* Type — inline popover, no portal */}
										<TypeCombobox
											value={col.type}
											types={types}
											onChange={(v) =>
												setColDefs((prev) =>
													prev.map((c) => c.id === col.id ? { ...c, type: v } : c)
												)
											}
										/>

										{/* NULL toggle */}
										<Tooltip>
											<TooltipTrigger asChild>
												<button
													onClick={() =>
														setColDefs((prev) =>
															prev.map((c) => c.id === col.id ? { ...c, nullable: !c.nullable } : c),
														)
													}
													className={cn(
														"text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border transition-colors shrink-0 w-9",
														col.nullable
															? "border-border text-muted-foreground"
															: "border-primary/40 text-primary bg-primary/5",
													)}
												>
													NULL
												</button>
											</TooltipTrigger>
											<TooltipContent>Toggle nullable</TooltipContent>
										</Tooltip>

										{/* PK toggle */}
										<Tooltip>
											<TooltipTrigger asChild>
												<button
													onClick={() =>
														setColDefs((prev) =>
															prev.map((c) => c.id === col.id ? { ...c, isPrimary: !c.isPrimary } : c),
														)
													}
													className={cn(
														"text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border transition-colors shrink-0 w-8",
														col.isPrimary
															? "border-primary/40 text-primary bg-primary/5"
															: "border-border text-muted-foreground",
													)}
												>
													PK
												</button>
											</TooltipTrigger>
											<TooltipContent>Toggle primary key</TooltipContent>
										</Tooltip>

										{/* Default value */}
										<Input
											value={col.defaultValue}
											onChange={(e) =>
												setColDefs((prev) =>
													prev.map((c) => c.id === col.id ? { ...c, defaultValue: e.target.value } : c),
												)
											}
											placeholder="default"
											className="h-7 text-[11px] font-mono w-28 shrink-0"
											autoComplete="off"
										/>

										{/* Comment */}
										<Textarea
											value={col.comment}
											onChange={(e) =>
												setColDefs((prev) =>
													prev.map((c) => c.id === col.id ? { ...c, comment: e.target.value } : c),
												)
											}
											placeholder="comment…"
											className="text-[11px] font-mono flex-1 min-h-0 h-7 resize-none py-1"
											autoComplete="off"
										/>

										{/* Remove */}
										{colDefs.length > 1 && (
											<Button
												variant="ghost"
												size="icon-xs"
												className="text-muted-foreground/30 hover:text-destructive shrink-0"
												onClick={() => setColDefs((prev) => prev.filter((c) => c.id !== col.id))}
											>
												<X size={10} />
											</Button>
										)}
									</Reorder.Item>
								))}
							</Reorder.Group>
						</div>

						{error && (
							<p className="text-[11px] text-destructive font-mono shrink-0 bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
								{error}
							</p>
						)}
					</div>
				</div>

				{/* Footer */}
				<div className="shrink-0 flex items-center justify-end gap-2 border-t border-border bg-muted/50 px-5 py-3 rounded-b-xl">
					<Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						size="sm"
						disabled={!newTableName.trim() || colDefs.length === 0 || loading}
						onClick={handleCreate}
					>
						{loading ? "Creating…" : "Create Table"}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
