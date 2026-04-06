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
		<AlertDialog
			open={columnName !== null}
			onOpenChange={(o) => !o && onCancel()}
		>
			<AlertDialogContent className="max-w-md">
				<AlertDialogHeader>
					<AlertDialogTitle>Drop column?</AlertDialogTitle>
					<AlertDialogDescription>
						This will permanently remove the column and all its
						data.
						<pre className="mt-2 rounded bg-muted p-2 text-xs font-mono whitespace-pre-wrap break-all">
							{`ALTER TABLE ${qi(tableName)} DROP COLUMN ${qi(columnName ?? "")}`}
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
						{loading ? "Dropping…" : "Drop Column"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
