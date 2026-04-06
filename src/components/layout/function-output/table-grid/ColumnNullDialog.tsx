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
		<AlertDialog
			open={!!columnName}
			onOpenChange={(o) => !o && onCancel()}
		>
			<AlertDialogContent className="max-w-md">
				<AlertDialogHeader>
					<AlertDialogTitle>
						Set entire column to NULL?
					</AlertDialogTitle>
					<AlertDialogDescription>
						This will set <strong>all</strong> values in column{" "}
						<strong>"{columnName}"</strong> to NULL
						for every row in the table. This cannot be undone.
						<pre className="mt-2 rounded bg-muted p-2 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
							{`UPDATE ${qi(tableName)} SET ${qi(columnName ?? "")} = NULL`}
						</pre>
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						onClick={onConfirm}
						className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
					>
						Set NULL
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
