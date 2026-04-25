import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from "@/components/ui/combobox";

export function AddColumnDialog({
	open,
	tableName,
	colTypes,
	addCol,
	loading,
	error,
	qi,
	onColChange,
	onCancel,
	onConfirm,
}: {
	open: boolean;
	tableName: string;
	colTypes: string[];
	addCol: { name: string; type: string; nullable: boolean };
	loading: boolean;
	error: string | null;
	qi: (n: string) => string;
	onColChange: (partial: Partial<{ name: string; type: string; nullable: boolean }>) => void;
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
					<DialogTitle>Add column</DialogTitle>
					<DialogDescription>
						Add a new column to{" "}
						<span className="font-mono">{tableName}</span>.
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-4 py-2">
					{/* Column name */}
					<div className="flex flex-col gap-1.5">
						<Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
							Column name
						</Label>
						<Input
							autoFocus
							value={addCol.name}
							onChange={(e) => onColChange({ name: e.target.value })}
							onKeyDown={(e) => e.key === "Enter" && onConfirm()}
							placeholder="column_name"
							className="font-mono text-[12px]"
						/>
					</div>
					{/* Data type */}
					<div className="flex flex-col gap-1.5">
						<Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
							Data type
						</Label>
						<Combobox
							value={addCol.type}
							onValueChange={(value) => onColChange({ type: value as string })}
						>
							<ComboboxInput
								placeholder="Select type…"
								className="h-9 text-[12px] font-mono"
							/>
							<ComboboxContent>
								<ComboboxList>
									{(colTypes.length > 0 ? colTypes : ["TEXT"]).map((t) => (
										<ComboboxItem key={t} value={t}>
											{t}
										</ComboboxItem>
									))}
									<ComboboxEmpty>No type found.</ComboboxEmpty>
								</ComboboxList>
							</ComboboxContent>
						</Combobox>
					</div>
					{/* Nullable toggle */}
					<div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5 bg-muted/20">
						<Label
							htmlFor="add-col-nullable"
							className="flex flex-col gap-0.5 cursor-pointer flex-1"
						>
							<span className="text-[11px] font-semibold">Allow null</span>
							<span className="text-[10px] text-muted-foreground/60 font-normal">
								Column accepts NULL values
							</span>
						</Label>
						<Checkbox
							id="add-col-nullable"
							checked={addCol.nullable}
							onCheckedChange={(checked) =>
								onColChange({ nullable: checked === true })
							}
						/>
					</div>
					{/* SQL preview */}
					<div className="flex flex-col gap-1.5">
						<Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
							Preview
						</Label>
						<pre className="rounded-md bg-muted px-3 py-2 text-xs font-mono whitespace-pre-wrap break-all text-muted-foreground">
							{`ALTER TABLE ${qi(tableName)} ADD COLUMN ${qi(addCol.name.trim() || "…")} ${addCol.type}${addCol.nullable ? "" : " NOT NULL"}`}
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
						disabled={loading || !addCol.name.trim()}
					>
						{loading ? "Adding…" : "Add Column"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
