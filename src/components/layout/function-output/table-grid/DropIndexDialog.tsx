import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
		<AlertDialog
			open={indexName !== null}
			onOpenChange={(o) => !o && onCancel()}
		>
			<AlertDialogContent className="max-w-md">
				<AlertDialogHeader>
					<AlertDialogTitle>Drop index?</AlertDialogTitle>
					<AlertDialogDescription>
						This will permanently remove the index.
						<pre className="mt-2 rounded bg-muted p-2 text-xs font-mono whitespace-pre-wrap break-all">
							{tableName && indexName
								? buildDropSql(tableName, indexName)
								: ""}
						</pre>
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						onClick={onConfirm}
						disabled={loading}
						className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
					>
						{loading ? "Dropping…" : "Drop Index"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
