import { useRef } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function ImportPanel({
	show,
	viewMode,
	tableName,
	importText,
	importFormat,
	importPreview,
	importError,
	importing,
	importDone,
	onTextChange,
	onFormatChange,
	onFileSelect,
	onImport,
	onClose,
}: {
	show: boolean;
	viewMode: "data" | "form" | "structure" | "er";
	tableName: string | undefined;
	importText: string;
	importFormat: "csv" | "json";
	importPreview: { headers: string[]; rows: string[][] } | null;
	importError: string | null;
	importing: boolean;
	importDone: number | null;
	onTextChange: (text: string, fmt: "csv" | "json") => void;
	onFormatChange: (fmt: "csv" | "json") => void;
	onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
	onImport: () => void;
	onClose: () => void;
}) {
	const fileRef = useRef<HTMLInputElement>(null);

	if (!show || viewMode !== "data" || !tableName) return null;
	return (
		<div className="shrink-0 border-b border-border bg-card px-3 py-3 flex flex-col gap-2">
			<div className="flex items-center justify-between">
				<span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
					Import data into {tableName}
				</span>
				<Button
					variant="ghost"
					size="icon-xs"
					onClick={onClose}
					className="text-muted-foreground/40 hover:text-foreground"
				>
					<X size={10} />
				</Button>
			</div>
			<div className="flex items-center gap-2">
				<span className="text-[10px] font-mono text-muted-foreground/60">
					Format:
				</span>
				{(["csv", "json"] as const).map((fmt) => (
					<Button
						key={fmt}
						variant={importFormat === fmt ? "secondary" : "outline"}
						size="xs"
						onClick={() => onFormatChange(fmt)}
						className="h-6 text-[10px] font-bold uppercase tracking-widest"
					>
						{fmt.toUpperCase()}
					</Button>
				))}
				<Button
					variant="outline"
					size="xs"
					onClick={() => fileRef.current?.click()}
					className="h-6 text-[10px] font-bold uppercase tracking-widest"
				>
					Open file…
				</Button>
				<input
					ref={fileRef}
					type="file"
					accept=".csv,.json"
					className="hidden"
					onChange={onFileSelect}
				/>
			</div>
			<textarea
				value={importText}
				onChange={(e) => onTextChange(e.target.value, importFormat)}
				placeholder={
					importFormat === "csv"
						? "Paste CSV (first row = headers)…"
						: "Paste JSON array of objects…"
				}
				rows={4}
				className="w-full bg-background border border-border rounded px-2 py-1.5 text-[11px] font-mono text-foreground outline-none resize-none"
			/>
			{importError && (
				<span className="text-[10px] font-mono text-destructive">
					{importError}
				</span>
			)}
			{importPreview && (
				<div className="text-[10px] font-mono text-muted-foreground/60">
					Preview: {importPreview.rows.length} row(s), columns:{" "}
					{importPreview.headers.join(", ")}
				</div>
			)}
			<div className="flex items-center gap-2">
				<Button
					size="xs"
					onClick={onImport}
					disabled={importing || !importPreview}
					className="h-6 text-[10px] font-bold uppercase tracking-widest gap-1"
				>
					{importing && <Loader2 size={9} className="animate-spin" />}
					Import
					{importPreview ? ` ${importPreview.rows.length} rows` : ""}
				</Button>
				{importDone !== null && (
					<Badge
						variant="secondary"
						className="text-[10px] font-mono h-5 text-accent-green"
					>
						✓ {importDone} rows imported
					</Badge>
				)}
			</div>
		</div>
	);
}
