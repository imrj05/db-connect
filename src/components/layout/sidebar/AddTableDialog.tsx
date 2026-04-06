import { useState } from "react";
import { Reorder } from "framer-motion";
import { Plus, GripVertical, X } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { DatabaseType } from "@/types";

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
	postgresql: ["TEXT","INTEGER","BIGINT","BOOLEAN","TIMESTAMP","FLOAT","DECIMAL","JSON","UUID","SERIAL","VARCHAR(255)"],
	mysql:      ["VARCHAR(255)","INT","BIGINT","TEXT","BOOLEAN","DATETIME","FLOAT","DOUBLE","DECIMAL","JSON"],
	sqlite:     ["TEXT","INTEGER","REAL","BLOB","NUMERIC"],
	mongodb:    [],
	redis:      [],
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
			<DialogContent className="!max-w-4xl !flex !flex-col !h-[90vh]">
				<DialogHeader className="shrink-0">
					<DialogTitle>Add Table</DialogTitle>
					<DialogDescription className="font-mono">
						on <span className="text-foreground/70">{selectedDb ?? connectionName}</span>
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-3 flex-1 min-h-0">
					{/* Table name */}
					<div className="flex items-center gap-3 shrink-0">
						<Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground shrink-0">
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

					{/* Columns */}
					<div className="flex flex-col gap-1.5 flex-1 min-h-0">
						<div className="flex items-center justify-between shrink-0">
							<Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
								Columns
							</Label>
							<Button
								variant="ghost"
								size="xs"
								className="h-6 text-[10px] gap-1 text-muted-foreground"
								onClick={() =>
									setColDefs((prev) => [
										...prev,
										{
											id: `c${Date.now()}`,
											name: "",
											type: COL_TYPES[connectionType]?.[0] ?? "TEXT",
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

						<Reorder.Group
							axis="y"
							values={colDefs}
							onReorder={setColDefs}
							className="flex flex-col gap-1 flex-1 overflow-y-auto"
						>
							{colDefs.map((col) => (
								<Reorder.Item key={col.id} value={col} className="flex items-center gap-2 bg-background">
									<span className="cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground/60 shrink-0 touch-none">
										<GripVertical size={12} />
									</span>
									<Input
										value={col.name}
										onChange={(e) =>
											setColDefs((prev) =>
												prev.map((c) => c.id === col.id ? { ...c, name: e.target.value } : c),
											)
										}
										placeholder="name"
										className="h-7 text-[11px] font-mono w-28 shrink-0"
										autoComplete="off"
									/>
									<Select
										value={col.type}
										onValueChange={(v) =>
											setColDefs((prev) =>
												prev.map((c) => c.id === col.id ? { ...c, type: v } : c),
											)
										}
									>
										<SelectTrigger className="h-7 text-[11px] font-mono w-32 shrink-0">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{(COL_TYPES[connectionType] ?? ["TEXT"]).map((t) => (
												<SelectItem key={t} value={t} className="text-[11px] font-mono">
													{t}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<Tooltip>
										<TooltipTrigger asChild>
											<button
												onClick={() =>
													setColDefs((prev) =>
														prev.map((c) => c.id === col.id ? { ...c, nullable: !c.nullable } : c),
													)
												}
												className={cn(
													"text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border transition-colors shrink-0",
													col.nullable
														? "border-border text-muted-foreground"
														: "border-primary/40 text-primary",
												)}
											>
												NULL
											</button>
										</TooltipTrigger>
										<TooltipContent>Toggle nullable</TooltipContent>
									</Tooltip>
									<Tooltip>
										<TooltipTrigger asChild>
											<button
												onClick={() =>
													setColDefs((prev) =>
														prev.map((c) => c.id === col.id ? { ...c, isPrimary: !c.isPrimary } : c),
													)
												}
												className={cn(
													"text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border transition-colors shrink-0",
													col.isPrimary
														? "border-primary/40 text-primary"
														: "border-border text-muted-foreground",
												)}
											>
												PK
											</button>
										</TooltipTrigger>
										<TooltipContent>Toggle primary key</TooltipContent>
									</Tooltip>
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
									<Textarea
										value={col.comment}
										onChange={(e) =>
											setColDefs((prev) =>
												prev.map((c) => c.id === col.id ? { ...c, comment: e.target.value } : c),
											)
										}
										placeholder="comment"
										className="text-[11px] font-mono flex-1 min-h-0 h-7 resize-none py-1"
										autoComplete="off"
									/>
									{colDefs.length > 1 && (
										<Button
											variant="ghost"
											size="icon-xs"
											className="text-muted-foreground/40 hover:text-destructive shrink-0"
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
						<p className="text-[11px] text-destructive font-mono shrink-0">{error}</p>
					)}
				</div>

				<DialogFooter className="shrink-0">
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
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
