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
		<AlertDialog
			open={open}
			onOpenChange={(o) => !o && onCancel()}
		>
			<AlertDialogContent className="max-w-md">
				<AlertDialogHeader>
					<AlertDialogTitle>Drop table?</AlertDialogTitle>
					<AlertDialogDescription>
						This will permanently delete the table and all its
						data. This cannot be undone.
						<pre className="mt-2 rounded bg-muted p-2 text-xs font-mono whitespace-pre-wrap break-all">
							{`DROP TABLE ${qi(tableName)}`}
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
						{loading ? "Dropping…" : "Drop Table"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
