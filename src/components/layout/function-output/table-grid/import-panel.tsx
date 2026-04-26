import { useRef, useState, useCallback } from "react";
import { Loader2, X, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

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
	const [isDragging, setIsDragging] = useState(false);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(true);
	}, []);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(false);
	}, []);

	const handleDrop = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(false);
		const file = e.dataTransfer.files?.[0];
		if (!file) return;
		// Detect format from extension
		const ext = file.name.split(".").pop()?.toLowerCase();
		const fmt: "csv" | "json" = ext === "json" ? "json" : "csv";
		if (fmt !== importFormat) onFormatChange(fmt);
		const reader = new FileReader();
		reader.onload = (ev) => {
			const text = ev.target?.result as string ?? "";
			onTextChange(text, fmt);
		};
		reader.readAsText(file);
	}, [importFormat, onFormatChange, onTextChange]);

	if (!show || viewMode !== "data" || !tableName) return null;
	return (
		<div
			className={cn(
				"shrink-0 border-b border-border bg-card px-3 py-3 flex flex-col gap-2 transition-colors",
				isDragging && "bg-primary/5 border-primary/40",
			)}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
		>
			<div className="flex items-center justify-between">
				<span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
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

			{/* Drag-and-drop zone */}
			{!importText && (
				<div
					className={cn(
						"flex flex-col items-center justify-center gap-1.5 rounded-md border-2 border-dashed py-4 transition-colors cursor-pointer",
						isDragging
							? "border-primary/50 bg-primary/5 text-primary"
							: "border-border/60 text-muted-foreground/40 hover:border-border hover:text-muted-foreground/60",
					)}
					onClick={() => fileRef.current?.click()}
				>
					<Upload size={14} />
					<span className="text-[10px] font-medium">
						Drop CSV / JSON here or <span className="underline underline-offset-2">browse</span>
					</span>
					<span className="text-[9px] opacity-70">
						.csv or .json
					</span>
				</div>
			)}

			<div className="flex items-center gap-2">
				<span className="text-[10px] font-mono text-muted-foreground/60">
					Format:
				</span>
				<ToggleGroup
					type="single"
					value={importFormat}
					onValueChange={(value) => {
						if (value === "csv" || value === "json") {
							onFormatChange(value);
						}
					}}
					variant="outline"
					size="sm"
				>
					{(["csv", "json"] as const).map((fmt) => (
						<ToggleGroupItem
							key={fmt}
							value={fmt}
							className="text-[10px] font-bold uppercase tracking-widest"
						>
							{fmt.toUpperCase()}
						</ToggleGroupItem>
					))}
				</ToggleGroup>
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
			<Textarea
				value={importText}
				onChange={(e) => onTextChange(e.target.value, importFormat)}
				placeholder={
					importFormat === "csv"
						? "Paste CSV (first row = headers)…"
						: "Paste JSON array of objects…"
				}
				rows={4}
				className="min-h-0 resize-none bg-background px-2 py-1.5 text-[11px] font-mono"
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
						className="h-5 text-[10px] font-mono text-success"
					>
						✓ {importDone} rows imported
					</Badge>
				)}
			</div>
		</div>
	);
}
