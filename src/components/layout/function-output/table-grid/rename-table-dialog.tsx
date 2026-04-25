import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

export function RenameTableDialog({
	open,
	currentName,
	newName,
	loading,
	qi,
	onNameChange,
	onCancel,
	onConfirm,
}: {
	open: boolean;
	currentName: string;
	newName: string;
	loading: boolean;
	qi: (n: string) => string;
	onNameChange: (name: string) => void;
	onCancel: () => void;
	onConfirm: () => void;
}) {
	return (
		<Dialog
			open={open}
			onOpenChange={(o) => !o && onCancel()}
		>
			<DialogContent className="max-w-sm">
				<DialogHeader>
					<DialogTitle>Rename table</DialogTitle>
					<DialogDescription>
						Enter a new name for{" "}
						<span className="font-mono">{currentName}</span>.
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-3 py-2">
					<Input
						autoFocus
						value={newName}
						onChange={(e) => onNameChange(e.target.value)}
						onKeyDown={(e) => e.key === "Enter" && onConfirm()}
						placeholder="new_table_name"
						className="font-mono text-[12px]"
					/>
					<pre className="rounded bg-muted px-3 py-2 text-xs font-mono whitespace-pre-wrap break-all text-muted-foreground">
						{`ALTER TABLE ${qi(currentName)} RENAME TO ${qi(newName.trim() || "…")}`}
					</pre>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={onCancel}>
						Cancel
					</Button>
					<Button
						onClick={onConfirm}
						disabled={
							loading ||
							!newName.trim() ||
							newName.trim() === currentName
						}
					>
						{loading ? "Renaming…" : "Rename"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
