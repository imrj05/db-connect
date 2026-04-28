import { memo, useCallback, useMemo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Database, GripVertical, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DraftColumn, DraftForeignKey, DraftIndex } from "@/lib/schema-diff/types";
import { ColumnRow } from "./column-row";
import { IndexesSection } from "./indexes-section";

export type TableNodeData = {
	label: string;
	schema?: string;
	columns: DraftColumn[];
	indexes: DraftIndex[];
	degree: number;
	isEditing: boolean;
	isCurrent: boolean;
	fkRelations: DraftForeignKey[];
	fkSourceMap: Map<string, boolean>; // column id → is FK source?
	engine: string;
	onUpdateTable?: (patch: { name?: string; columns?: DraftColumn[]; indexes?: DraftIndex[] }) => void;
	onDeleteTable?: () => void;
	onStartFKDrag?: (tableId: string, columnId: string) => void;
};

type TableNodeType = Node<TableNodeData, "table-node">;

function TableNodeComponent({ data, selected, id }: NodeProps<TableNodeType>) {
	const {
		label,
		schema,
		columns,
		indexes,
		degree,
		isEditing,
		isCurrent,
		fkSourceMap,
		onUpdateTable,
		onDeleteTable,
		onStartFKDrag,
	} = data;

	const columnNames = useMemo(() => columns.map((c) => c.name), [columns]);

	const updateColumn = useCallback(
		(colId: string, patch: Partial<DraftColumn>) => {
			if (!onUpdateTable) return;
			const updated = columns.map((c) =>
				c.id === colId ? { ...c, ...patch } : c,
			);
			// If PK changed to true, ensure NOT NULL
			if (patch.isPrimary) {
				const col = columns.find((c) => c.id === colId);
				if (col && col.nullable) {
					const fixed = updated.map((c) =>
						c.id === colId ? { ...c, ...patch, nullable: false } : c,
					);
					onUpdateTable({ columns: fixed });
					return;
				}
			}
			onUpdateTable({ columns: updated });
		},
		[columns, onUpdateTable],
	);

	const deleteColumn = useCallback(
		(colId: string) => {
			if (!onUpdateTable) return;
			const updated = columns.filter((c) => c.id !== colId);
			onUpdateTable({ columns: updated });
		},
		[columns, onUpdateTable],
	);

	const addColumn = useCallback(() => {
		if (!onUpdateTable) return;
		const newCol: DraftColumn = {
			id: `col-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
			name: `new_column_${columns.length + 1}`,
			dataType: "integer",
			nullable: true,
			isPrimary: false,
			defaultValue: null,
		};
		onUpdateTable({ columns: [...columns, newCol] });
	}, [columns, onUpdateTable]);

	const updateIndexes = useCallback(
		(updated: DraftIndex[]) => {
			if (!onUpdateTable) return;
			onUpdateTable({ indexes: updated });
		},
		[onUpdateTable],
	);

	const borderClass = selected
		? "border-primary/60 ring-2 ring-primary/30 shadow-lg"
		: isCurrent
			? "border-primary/45 bg-card ring-2 ring-primary/20 shadow-lg"
			: "border-border/70 bg-card/95 hover:border-primary/30 hover:shadow-md";

	const headerClass = isCurrent
		? "bg-primary/8 border-primary/15"
		: "bg-muted/35 border-border/70";

	return (
		<div
			className={cn(
				"rounded-xl border text-left overflow-hidden shadow-sm min-w-[260px]",
				borderClass,
			)}
		>
			{/* Card header */}
			<div
				className={cn(
					"px-2 py-2 border-b flex items-center gap-2",
					headerClass,
				)}
			>
				{isEditing && (
					<GripVertical
						size={11}
						className="text-muted-foreground/25 shrink-0 cursor-grab nodrag"
					/>
				)}
				<Database
					size={12}
					className={cn(isCurrent ? "text-primary" : "text-accent-blue/65")}
				/>
				<div className="min-w-0 flex-1">
					{isEditing && onUpdateTable ? (
						<input
							type="text"
							value={label}
							onChange={(e) => onUpdateTable({ name: e.target.value })}
							className="w-full bg-transparent border border-transparent focus:border-primary/40 rounded px-1 py-0 text-[11px] font-bold font-mono text-foreground outline-none nodrag"
							placeholder="table_name"
							onClick={(e) => e.stopPropagation()}
						/>
					) : (
						<div className="text-[11px] font-bold font-mono text-foreground truncate">
							{label}
						</div>
					)}
					<div className="text-[9px] font-mono text-muted-foreground/45 truncate">
						{schema ?? "default"} · {degree} link{degree === 1 ? "" : "s"}
					</div>
				</div>
				{isEditing && onDeleteTable && (
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							onDeleteTable();
						}}
						className="shrink-0 text-muted-foreground/30 hover:text-destructive/70 p-0.5 nodrag"
						title="Delete table"
					>
						<Trash2 size={11} />
					</button>
				)}
			</div>

			{/* Column rows */}
			<div className="divide-y divide-border/40">
				{columns.map((column, colIdx) => {
					const isFK = fkSourceMap?.get(column.id) ?? false;
					return (
						<div key={column.id} className="relative">
							<ColumnRow
								column={column}
								isEditing={isEditing}
								isFK={isFK}
								onUpdate={(patch) => updateColumn(column.id, patch)}
								onDelete={() => deleteColumn(column.id)}
								onStartFKDrag={
									isEditing && onStartFKDrag
										? () => onStartFKDrag(id, column.id)
										: undefined
								}
							/>
							{/* React Flow handles for edge connections */}
							{isEditing && (
								<>
									<Handle
										type="source"
										position={Position.Right}
										id={`col-source-${column.id}`}
										className="!w-2 !h-2 !bg-accent-blue !border-2 !border-background !opacity-0 hover:!opacity-100 transition-opacity"
										style={{ top: colIdx * 22 + 11, right: -4 }}
									/>
									<Handle
										type="target"
										position={Position.Left}
										id={`col-target-${column.id}`}
										className="!w-2 !h-2 !bg-accent-blue !border-2 !border-background !opacity-0 hover:!opacity-100 transition-opacity"
										style={{ top: colIdx * 22 + 11, left: -4 }}
									/>
								</>
							)}
						</div>
					);
				})}

				{/* Add column button (edit mode) */}
				{isEditing && (
					<Button
						variant="ghost"
						size="xs"
						onClick={addColumn}
						className="h-5 w-full text-[9px] text-muted-foreground/40 hover:text-foreground rounded-none nodrag"
					>
						<Plus size={8} className="mr-1" />
						Add column
					</Button>
				)}
			</div>

			{/* Indexes section */}
			<IndexesSection
				indexes={indexes}
				columnNames={columnNames}
				isEditing={isEditing}
				onUpdate={updateIndexes}
			/>

			{/* Read-only handles for showing FK connections */}
			{!isEditing &&
				columns.map((column) => (
					<Handle
						key={`ro-${column.id}`}
						type="source"
						position={Position.Right}
						id={`col-source-${column.id}`}
						className="!w-1 !h-1 !bg-transparent !border-0"
					/>
				))}
		</div>
	);
}

export const TableNode = memo(TableNodeComponent);
