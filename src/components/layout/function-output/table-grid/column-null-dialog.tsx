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

export function ColumnNullDialog({
	columnName,
	tableName,
	qi,
	onCancel,
	onConfirm,
}: {
	columnName: string | null;
	tableName: string;
	qi: (n: string) => string;
	onCancel: () => void;
	onConfirm: () => void;
}) {
	return (
		<Dialog open={!!columnName} onOpenChange={(o) => !o && onCancel()}>
			<DialogContent size="sm" showCloseButton={false}>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<TriangleAlert size={15} className="text-destructive shrink-0" />
						Set entire column to NULL?
					</DialogTitle>
					<DialogDescription className="text-left">
						This will set <strong>all</strong> values in column{" "}
						<strong>"{columnName}"</strong> to NULL
						for every row in the table. This cannot be undone.
					</DialogDescription>
				</DialogHeader>
				<pre className="rounded bg-muted p-2 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all text-muted-foreground">
					{`UPDATE ${qi(tableName)} SET ${qi(columnName ?? "")} = NULL`}
				</pre>
				<DialogFooter>
					<Button variant="outline" size="sm" onClick={onCancel}>
						Cancel
					</Button>
					<Button
						variant="destructive"
						size="sm"
						onClick={onConfirm}
					>
						Set NULL
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}