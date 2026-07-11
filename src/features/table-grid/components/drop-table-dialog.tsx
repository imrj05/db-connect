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
export function DropTableDialog({
	open,
	tableName,
	loading,
	qi,
	onCancel,
	onConfirm,
}: {
	open: boolean;
	tableName: string;
	loading: boolean;
	qi: (n: string) => string;
	onCancel: () => void;
	onConfirm: () => void;
}) {
	return (
		<Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
			<DialogContent className="max-w-sm" size="sm" showCloseButton={false}>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<TriangleAlert size={15} className="text-destructive shrink-0" />
						Drop table?
					</DialogTitle>
					<DialogDescription className="text-left">
						This will permanently delete the table and all its
						data. This cannot be undone.
					</DialogDescription>
				</DialogHeader>
				<pre className="rounded bg-muted p-2 text-xs font-mono whitespace-pre-wrap break-all text-muted-foreground">
					{`DROP TABLE ${qi(tableName)}`}
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
						{loading ? "Dropping…" : "Drop Table"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
