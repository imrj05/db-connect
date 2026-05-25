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

export function DropIndexDialog({
	indexName,
	tableName,
	loading,
	buildDropSql,
	onCancel,
	onConfirm,
}: {
	indexName: string | null;
	tableName: string;
	loading: boolean;
	buildDropSql: (tableName: string, indexName: string) => string;
	onCancel: () => void;
	onConfirm: () => void;
}) {
	return (
		<Dialog
			open={indexName !== null}
			onOpenChange={(o) => !o && onCancel()}
		>
			<DialogContent size="sm" showCloseButton={false}>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<TriangleAlert size={15} className="text-destructive shrink-0" />
						Drop index?
					</DialogTitle>
					<DialogDescription className="text-left">
						This will permanently remove the index.
					</DialogDescription>
				</DialogHeader>
				<pre className="rounded bg-muted p-2 text-xs font-mono whitespace-pre-wrap break-all text-muted-foreground">
					{tableName && indexName
						? buildDropSql(tableName, indexName)
						: ""}
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
						{loading ? "Dropping…" : "Drop Index"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}