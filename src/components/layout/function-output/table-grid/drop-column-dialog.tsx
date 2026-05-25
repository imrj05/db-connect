import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TriangleAlert } from "lucide-react";

export function DropColumnDialog({
	columnName,
	tableName,
	loading,
	qi,
	onCancel,
	onConfirm,
}: {
	columnName: string | null;
	tableName: string;
	loading: boolean;
	qi: (n: string) => string;
	onCancel: () => void;
	onConfirm: () => void;
}) {
	return (
		<Dialog
			open={columnName !== null}
			onOpenChange={(o) => !o && onCancel()}
		>
			<DialogContent size="sm" showCloseButton={false}>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<TriangleAlert size={15} className="text-destructive shrink-0" />
						Drop column?
					</DialogTitle>
					<DialogDescription className="text-left">
						This will permanently remove the column and all its
						data.
					</DialogDescription>
				</DialogHeader>
				<pre className="rounded bg-muted p-2 text-xs font-mono whitespace-pre-wrap break-all text-muted-foreground">
					{`ALTER TABLE ${qi(tableName)} DROP COLUMN ${qi(columnName ?? "")}`}
				</pre>
				<DialogFooter>
					<Button variant="outline" size="sm" onClick={onCancel}>
						Cancel
					</Button>
					<Button
						variant="destructive"
						size="sm"
						onClick={onConfirm}
						disabled={loading}
					>
						{loading ? "Dropping…" : "Drop Column"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}