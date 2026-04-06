import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { TableStructure } from "@/types";

export function CreateIndexDialog({
	open,
	tableName,
	structure,
	createIdxDef,
	loading,
	error,
	buildCreateIndexSql,
	onDefChange,
	onCancel,
	onConfirm,
}: {
	open: boolean;
	tableName: string;
	structure: TableStructure | null;
	createIdxDef: { name: string; columns: string[]; unique: boolean };
	loading: boolean;
	error: string | null;
	buildCreateIndexSql: (
		tableName: string,
		idxName: string,
		columns: string[],
		unique: boolean,
	) => string;
	onDefChange: (partial: Partial<{ name: string; columns: string[]; unique: boolean }>) => void;
	onCancel: () => void;
	onConfirm: () => void;
}) {
	return (
		<Dialog
			open={open}
			onOpenChange={(o) => !o && onCancel()}
		>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>Create index</DialogTitle>
					<DialogDescription>
						Add an index to{" "}
						<span className="font-mono">{tableName}</span>.
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-4 py-2">
					{/* Index name */}
					<div className="flex flex-col gap-1.5">
						<Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
							Index name
						</Label>
						<Input
							autoFocus
							value={createIdxDef.name}
							onChange={(e) => onDefChange({ name: e.target.value })}
							placeholder="index_name"
							className="font-mono text-[12px]"
						/>
					</div>
					{/* Columns */}
					<div className="flex flex-col gap-1.5">
						<div className="flex items-center justify-between">
							<Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
								Columns
							</Label>
							{createIdxDef.columns.length > 0 && (
								<Badge
									variant="secondary"
									className="text-[9px] font-mono h-4 px-1.5"
								>
									{createIdxDef.columns.length} selected
								</Badge>
							)}
						</div>
						<div className="flex flex-col gap-0.5 max-h-44 overflow-y-auto rounded-md border border-border bg-muted/20 p-1.5">
							{(structure?.columns ?? []).map((col) => {
								const order = createIdxDef.columns.indexOf(col.name);
								const isSelected = order !== -1;
								return (
									<label
										key={col.name}
										className={cn(
											"flex items-center gap-2.5 cursor-pointer px-2 py-1.5 rounded transition-colors text-[11px] font-mono",
											isSelected ? "bg-primary/10" : "hover:bg-accent/20",
										)}
									>
										<Checkbox
											checked={isSelected}
											onCheckedChange={(checked) =>
												onDefChange({
													columns: checked
														? [...createIdxDef.columns, col.name]
														: createIdxDef.columns.filter((c) => c !== col.name),
												})
											}
										/>
										<span
											className={cn(
												"flex-1",
												isSelected ? "text-foreground font-semibold" : "text-foreground/80",
											)}
										>
											{col.name}
										</span>
										<span className="text-muted-foreground/40 text-[9px]">
											{col.dataType}
										</span>
										{isSelected && (
											<span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[8px] font-black flex items-center justify-center shrink-0">
												{order + 1}
											</span>
										)}
									</label>
								);
							})}
						</div>
					</div>
					{/* Unique toggle */}
					<div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5 bg-muted/20">
						<Label
							htmlFor="create-idx-unique"
							className="flex flex-col gap-0.5 cursor-pointer flex-1"
						>
							<span className="text-[11px] font-semibold">Unique index</span>
							<span className="text-[10px] text-muted-foreground/60 font-normal">
								Enforce unique values on indexed columns
							</span>
						</Label>
						<Checkbox
							id="create-idx-unique"
							checked={createIdxDef.unique}
							onCheckedChange={(checked) =>
								onDefChange({ unique: checked === true })
							}
						/>
					</div>
					{/* SQL preview */}
					<div className="flex flex-col gap-1.5">
						<Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
							Preview
						</Label>
						<pre className="rounded-md bg-muted px-3 py-2 text-xs font-mono whitespace-pre-wrap break-all text-muted-foreground">
							{tableName
								? buildCreateIndexSql(
										tableName,
										createIdxDef.name.trim() || "…",
										createIdxDef.columns.length > 0
											? createIdxDef.columns
											: ["…"],
										createIdxDef.unique,
									)
								: ""}
						</pre>
					</div>
					{error && (
						<div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
							<p className="text-[11px] text-destructive font-mono leading-snug">
								{error}
							</p>
						</div>
					)}
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={onCancel}>
						Cancel
					</Button>
					<Button
						onClick={onConfirm}
						disabled={
							loading ||
							!createIdxDef.name.trim() ||
							createIdxDef.columns.length === 0
						}
					>
						{loading ? "Creating…" : "Create Index"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
