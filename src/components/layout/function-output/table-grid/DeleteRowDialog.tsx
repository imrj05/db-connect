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
		<AlertDialog
			open={!!sql}
			onOpenChange={(o) => !o && onCancel()}
		>
			<AlertDialogContent className="max-w-md">
				<AlertDialogHeader>
					<AlertDialogTitle>Delete row?</AlertDialogTitle>
					<AlertDialogDescription>
						This will permanently delete the row. This cannot be
						undone.
						<pre className="mt-2 rounded bg-muted p-2 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
							{sql}
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
						{loading ? "Deleting…" : "Delete"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
