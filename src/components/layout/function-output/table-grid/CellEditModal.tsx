import { useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { json as jsonLang } from "@codemirror/lang-json";
import { html as htmlLang } from "@codemirror/lang-html";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";
import {
	ChevronDown,
	Settings,
	Check,
	WrapText,
	Minimize2,
	Loader2,
	X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogTitle,
	DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function CellEditModal({
	cellModal,
	initialFormat = "Text",
	loading,
	onClose,
	onValueChange,
	onCopy,
	onApply,
}: {
	cellModal: { rowIdx: number; col: string; value: string } | null;
	initialFormat?: "Text" | "JSON" | "HTML";
	loading: boolean;
	onClose: () => void;
	onValueChange: (value: string) => void;
	onCopy: (value: string) => void;
	onApply: () => void;
}) {
	const [format, setFormat] = useState<"Text" | "JSON" | "HTML">(initialFormat);
	const [wrap, setWrap] = useState(true);
	const [gearOpen, setGearOpen] = useState(false);
	const [formatOpen, setFormatOpen] = useState(false);

	const handleMinify = () => {
		if (format === "JSON" && cellModal) {
			try {
				const parsed = JSON.parse(cellModal.value);
				onValueChange(JSON.stringify(parsed));
			} catch {
				/* not valid JSON, ignore */
			}
		}
		setGearOpen(false);
	};

	return (
		<Dialog
			open={!!cellModal}
			onOpenChange={(o) => {
				if (!o) onClose();
			}}
		>
			<DialogContent
				className="sm:max-w-5xl w-full p-0 gap-0 overflow-hidden rounded-xl border border-border bg-[#1a1a1a]"
				onPointerDownOutside={(e) => e.preventDefault()}
				showCloseButton={false}
			>
				<DialogTitle className="sr-only">Edit cell value</DialogTitle>
				<DialogDescription className="sr-only">
					Edit the cell value with syntax highlighting. Choose format
					and apply to save.
				</DialogDescription>
				{/* Header */}
				<div className="flex items-center gap-3 px-5 py-3 border-b border-border/50">
					<span className="text-sm font-semibold text-foreground">
						Editing as
					</span>
					{/* Format dropdown */}
					<div className="relative">
						<button
							className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-sm text-foreground hover:bg-muted/70 transition-colors min-w-[100px] justify-between"
							onClick={() => {
								setFormatOpen((v) => !v);
								setGearOpen(false);
							}}
						>
							<span>{format}</span>
							<ChevronDown
								size={13}
								className="text-muted-foreground"
							/>
						</button>
						{formatOpen && (
							<div className="absolute left-0 top-full mt-1 z-50 min-w-[120px] rounded-lg border border-border bg-popover shadow-lg p-1 text-sm">
								{(["Text", "JSON", "HTML"] as const).map((fmt) => (
									<button
										key={fmt}
										className={cn(
											"w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-left hover:bg-accent hover:text-accent-foreground transition-colors",
											format === fmt &&
												"text-foreground font-medium",
										)}
										onClick={() => {
											setFormat(fmt);
											setFormatOpen(false);
										}}
									>
										{format === fmt ? (
											<Check size={12} />
										) : (
											<span className="w-3" />
										)}
										{fmt}
									</button>
								))}
							</div>
						)}
					</div>
					<div className="flex-1" />
					{/* Gear / settings dropdown */}
					<div className="relative">
						<button
							className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-sm text-foreground hover:bg-muted/70 transition-colors"
							onClick={() => {
								setGearOpen((v) => !v);
								setFormatOpen(false);
							}}
						>
							<Settings size={14} />
							<ChevronDown
								size={12}
								className="text-muted-foreground"
							/>
						</button>
						{gearOpen && (
							<div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-lg border border-border bg-popover shadow-lg p-1 text-sm">
								<button
									className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-left hover:bg-accent hover:text-accent-foreground transition-colors"
									onClick={handleMinify}
								>
									<Minimize2
										size={13}
										className="text-muted-foreground"
									/>
									Minify text
								</button>
								<button
									className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-left hover:bg-accent hover:text-accent-foreground transition-colors"
									onClick={() => {
										setWrap((v) => !v);
										setGearOpen(false);
									}}
								>
									{wrap ? (
										<Check size={13} className="text-foreground" />
									) : (
										<span className="w-[13px]" />
									)}
									<WrapText
										size={13}
										className="text-muted-foreground"
									/>
									Wrap Text
								</button>
							</div>
						)}
					</div>
					{/* Close button */}
					<button
						className="ml-1 flex items-center justify-center rounded-md w-7 h-7 text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
						onClick={onClose}
					>
						<X size={15} />
					</button>
				</div>
				{/* CodeMirror editor */}
				<div
					className="overflow-hidden"
					style={{ minHeight: 320, maxHeight: 480 }}
					onClick={() => {
						setFormatOpen(false);
						setGearOpen(false);
					}}
				>
					{cellModal && (
						<CodeMirror
							value={cellModal.value}
							onChange={onValueChange}
							theme={oneDark}
							extensions={[
								format === "JSON"
									? jsonLang()
									: format === "HTML"
										? htmlLang()
										: [],
								wrap ? EditorView.lineWrapping : [],
							].flat()}
							style={{
								fontSize: 13,
								height: "100%",
								minHeight: 320,
								maxHeight: 480,
							}}
							height="100%"
							minHeight="320px"
							maxHeight="480px"
							basicSetup={{
								lineNumbers: true,
								foldGutter: false,
								highlightActiveLine: true,
								autocompletion: true,
							}}
						/>
					)}
				</div>
				{/* Footer */}
				<div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border/50 bg-[#1a1a1a]">
					<Button
						variant="ghost"
						size="sm"
						className="px-5"
						onClick={onClose}
					>
						Cancel
					</Button>
					<Button
						variant="outline"
						size="sm"
						className="px-5"
						onClick={() =>
							cellModal && onCopy(cellModal.value)
						}
					>
						Copy
					</Button>
					<Button
						size="sm"
						className="px-6"
						disabled={loading}
						onClick={onApply}
					>
						{loading ? (
							<Loader2 size={13} className="animate-spin mr-1" />
						) : null}
						Apply
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
