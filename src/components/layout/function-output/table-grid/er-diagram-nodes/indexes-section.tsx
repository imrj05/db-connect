import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { DraftIndex } from "@/lib/schema-diff/types";

type IndexesSectionProps = {
	indexes: DraftIndex[];
	columnNames: string[];
	isEditing: boolean;
	onUpdate: (indexes: DraftIndex[]) => void;
};

let _idxCounter = 0;
function idxId(): string {
	return `idx-${Date.now()}-${++_idxCounter}`;
}

export function IndexesSection({ indexes, columnNames, isEditing, onUpdate }: IndexesSectionProps) {
	const [expanded, setExpanded] = useState(false);

	const addIndex = () => {
		const name = `idx_${columnNames[0] ?? "col"}`;
		const idx: DraftIndex = {
			id: idxId(),
			name,
			columns: columnNames.length > 0 ? [columnNames[0]] : [],
			unique: false,
		};
		onUpdate([...indexes, idx]);
	};

	const updateIndex = (id: string, patch: Partial<DraftIndex>) => {
		onUpdate(indexes.map((i) => (i.id === id ? { ...i, ...patch } : i)));
	};

	const deleteIndex = (id: string) => {
		onUpdate(indexes.filter((i) => i.id !== id));
	};

	if (!isEditing && indexes.length === 0) return null;

	return (
		<div className="border-t border-border/50">
			<button
				type="button"
				onClick={() => setExpanded(!expanded)}
				className="flex items-center gap-1 w-full px-2 py-1 text-[9px] font-mono text-muted-foreground/50 hover:text-muted-foreground/80 transition-colors"
			>
				{expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
				<span>Indexes ({indexes.length})</span>
			</button>

			{expanded && (
				<div className="px-2 pb-1 space-y-1">
					{!isEditing ? (
						indexes.map((idx) => (
							<div key={idx.id} className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground/60 pl-4">
								<span className={cn(idx.unique ? "text-accent-orange" : "text-muted-foreground/45")}>
									{idx.unique ? "UNIQUE " : ""}
								</span>
								<span className="font-semibold">{idx.name}</span>
								<span>({idx.columns.join(", ")})</span>
							</div>
						))
					) : (
						<div className="space-y-1">
							{indexes.map((idx) => (
								<div key={idx.id} className="flex items-center gap-1 pl-2 group">
									<input
										type="text"
										value={idx.name}
										onChange={(e) => updateIndex(idx.id, { name: e.target.value })}
										className="w-20 bg-transparent border border-transparent focus:border-primary/40 rounded px-1 py-0.5 text-[9px] text-foreground outline-none"
										placeholder="idx_name"
									/>
									<select
										multiple
										value={idx.columns}
										onChange={(e) => {
											const selected = Array.from(e.target.selectedOptions, (o) => o.value);
											updateIndex(idx.id, { columns: selected });
										}}
										className="flex-1 bg-transparent border border-transparent focus:border-primary/40 rounded px-1 py-0.5 text-[9px] text-muted-foreground/70 outline-none"
										size={1}
									>
										{columnNames.map((cn) => (
											<option key={cn} value={cn}>
												{cn}
											</option>
										))}
									</select>
									<label className="flex items-center gap-0.5 text-[8px] text-muted-foreground/40 shrink-0">
										U
										<Switch
											checked={idx.unique}
											onCheckedChange={(v) => updateIndex(idx.id, { unique: v })}
											className="scale-50"
										/>
									</label>
									<button
										type="button"
										onClick={() => deleteIndex(idx.id)}
										className="shrink-0 text-muted-foreground/20 hover:text-destructive/70 opacity-0 group-hover:opacity-100 transition-opacity"
									>
										<Trash2 size={8} />
									</button>
								</div>
							))}
							<Button
								variant="ghost"
								size="xs"
								onClick={addIndex}
								className="h-5 w-full text-[9px] text-muted-foreground/40 hover:text-foreground"
							>
								<Plus size={8} className="mr-1" />
								Add index
							</Button>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
