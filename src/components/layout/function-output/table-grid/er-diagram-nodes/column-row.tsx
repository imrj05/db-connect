import { GripVertical, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { DraftColumn } from "@/lib/schema-diff/types";

type ColumnRowProps = {
	column: DraftColumn;
	isEditing: boolean;
	isFK: boolean;
	onUpdate: (patch: Partial<DraftColumn>) => void;
	onDelete: () => void;
	onStartFKDrag?: (columnId: string) => void;
};

const DATA_TYPES = [
	"integer", "bigint", "smallint", "serial", "bigserial",
	"varchar", "char", "text", "uuid",
	"boolean", "bool",
	"real", "double precision", "numeric", "decimal",
	"date", "time", "timestamp", "timestamptz",
	"json", "jsonb", "bytea", "blob",
	"int", "tinyint", "mediumint", "float",
];

const MYSQL_TYPES = [
	"int", "bigint", "smallint", "tinyint", "mediumint",
	"varchar", "char", "text", "longtext", "mediumtext",
	"boolean", "bool",
	"float", "double", "decimal",
	"date", "datetime", "timestamp", "time", "year",
	"json", "blob", "longblob", "mediumblob",
];

const SQLITE_TYPES = [
	"integer", "real", "text", "blob", "numeric",
];

export function getTypeOptions(engine: string): string[] {
	switch (engine) {
		case "postgres":
			return DATA_TYPES;
		case "mysql":
			return MYSQL_TYPES;
		case "sqlite":
			return SQLITE_TYPES;
		default:
			return DATA_TYPES;
	}
}

export function ColumnRow({ column, isEditing, isFK, onUpdate, onDelete, onStartFKDrag }: ColumnRowProps) {
	if (!isEditing) {
		return (
			<div className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono transition-colors hover:bg-row-hover">
				<span
					className={cn(
						"w-1.5 h-1.5 rounded-full shrink-0",
						column.isPrimary
							? "bg-accent-orange"
							: isFK
								? "bg-accent-blue"
								: "bg-border",
					)}
				/>
				<span className="flex-1 min-w-0 truncate text-foreground/88">
					{column.name}
				</span>
				<div className="flex items-center gap-1 shrink-0">
					{column.isPrimary && (
						<span className="px-1 py-0.5 rounded bg-accent-orange/10 border border-accent-orange/20 text-[8px] font-black uppercase tracking-wider text-accent-orange">
							PK
						</span>
					)}
					{isFK && (
						<span className="px-1 py-0.5 rounded bg-accent-blue/10 border border-accent-blue/20 text-[8px] font-black uppercase tracking-wider text-accent-blue">
							FK
						</span>
					)}
					<span className="text-[9px] text-muted-foreground/40">
						{column.dataType}
					</span>
				</div>
			</div>
		);
	}

	return (
		<div className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono group hover:bg-primary/5">
			{/* Drag handle for reordering */}
			<div
				className="shrink-0 cursor-grab text-muted-foreground/20 hover:text-muted-foreground/60"
				title="Drag to reorder"
			>
				<GripVertical size={10} />
			</div>

			{/* PK toggle dot */}
			<button
				type="button"
				onClick={() => onUpdate({ isPrimary: !column.isPrimary })}
				className={cn(
					"w-1.5 h-1.5 rounded-full shrink-0 transition-colors cursor-pointer",
					column.isPrimary
						? "bg-accent-orange ring-1 ring-accent-orange/40"
						: isFK
							? "bg-accent-blue ring-1 ring-accent-blue/40"
							: "bg-border hover:bg-muted-foreground/40",
				)}
				title={column.isPrimary ? "Primary Key (click to remove)" : "Click to set as Primary Key"}
			/>

			{/* Column name input */}
			<input
				type="text"
				value={column.name}
				onChange={(e) => onUpdate({ name: e.target.value })}
				className="flex-1 min-w-0 bg-transparent border border-transparent focus:border-primary/40 rounded px-1 py-0.5 text-[10px] text-foreground outline-none"
				placeholder="column_name"
			/>

			{/* Data type input */}
			<input
				type="text"
				value={column.dataType}
				onChange={(e) => onUpdate({ dataType: e.target.value })}
				className="w-16 bg-transparent border border-transparent focus:border-primary/40 rounded px-1 py-0.5 text-[9px] text-muted-foreground/70 outline-none text-right"
				placeholder="type"
				list="col-types"
			/>
			<datalist id="col-types">
				{DATA_TYPES.map((t) => (
					<option key={t} value={t} />
				))}
			</datalist>

			{/* Nullable toggle */}
			<div className="flex items-center gap-0.5 shrink-0">
				<label className="text-[8px] text-muted-foreground/40 cursor-pointer select-none" title="Nullable">
					<Switch
						checked={column.nullable}
						onCheckedChange={(v) => onUpdate({ nullable: v })}
						className="scale-75 origin-right"
					/>
				</label>
			</div>

			{/* FK drag handle */}
			{onStartFKDrag && (
				<button
					type="button"
					className="shrink-0 text-muted-foreground/20 hover:text-accent-blue cursor-crosshair p-0.5"
					onMouseDown={(e) => {
						e.stopPropagation();
						onStartFKDrag(column.id);
					}}
					title="Drag to create foreign key"
				>
					<svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
						<circle cx="5" cy="5" r="2" />
						<circle cx="2" cy="5" r="2" fill="none" stroke="currentColor" strokeWidth="1" />
						<circle cx="8" cy="5" r="2" fill="none" stroke="currentColor" strokeWidth="1" />
					</svg>
				</button>
			)}

			{/* Delete column */}
			<button
				type="button"
				onClick={(e) => {
					e.stopPropagation();
					onDelete();
				}}
				className="shrink-0 text-muted-foreground/20 hover:text-destructive/70 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
				title="Delete column"
			>
				<Trash2 size={10} />
			</button>
		</div>
	);
}
