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

export function DeleteRowDialog({
	sql,
	loading,
	onCancel,
	onConfirm,
}: {
	sql: string | null;
	loading: boolean;
	onCancel: () => void;
	onConfirm: () => void;
}) {
	return (
		<Dialog open={!!sql} onOpenChange={(o) => !o && onCancel()}>
			<DialogContent size="sm" showCloseButton={false}>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<TriangleAlert size={15} className="text-destructive shrink-0" />
						Delete row?
					</DialogTitle>
					<DialogDescription className="text-left">
						This will permanently delete the row. This cannot be
						undone.
					</DialogDescription>
				</DialogHeader>
				<pre className="rounded bg-muted p-2 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all text-muted-foreground">
					{sql}
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
						{loading ? "Deleting…" : "Delete"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}