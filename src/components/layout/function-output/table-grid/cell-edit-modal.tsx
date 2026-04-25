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
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuCheckboxItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppStore } from "@/store/useAppStore";

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
	const theme = useAppStore((s) => s.theme);

	const handleMinify = () => {
		if (format === "JSON" && cellModal) {
			try {
				const parsed = JSON.parse(cellModal.value);
				onValueChange(JSON.stringify(parsed));
			} catch {
				/* not valid JSON, ignore */
			}
		}
	};

	return (
		<Dialog
			open={!!cellModal}
			onOpenChange={(o) => {
				if (!o) onClose();
			}}
		>
			<DialogContent
				className="sm:max-w-5xl w-full p-0 gap-0 overflow-hidden rounded-xl border border-border"
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
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								className="gap-2 min-w-[100px] justify-between font-normal"
							>
								{format}
								<ChevronDown size={13} className="text-muted-foreground" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start">
							{(["Text", "JSON", "HTML"] as const).map((fmt) => (
								<DropdownMenuItem
									key={fmt}
									onClick={() => setFormat(fmt)}
									className="gap-2"
								>
									{format === fmt ? (
										<Check size={12} />
									) : (
										<span className="w-3" />
									)}
									{fmt}
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
					<div className="flex-1" />
					{/* Settings dropdown */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="sm" className="gap-1.5">
								<Settings size={14} />
								<ChevronDown size={12} className="text-muted-foreground" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onClick={handleMinify} className="gap-2">
								<Minimize2 size={13} className="text-muted-foreground" />
								Minify text
							</DropdownMenuItem>
							<DropdownMenuCheckboxItem
								checked={wrap}
								onCheckedChange={(checked) => setWrap(checked)}
							>
								<WrapText size={13} className="text-muted-foreground" />
								Wrap Text
							</DropdownMenuCheckboxItem>
						</DropdownMenuContent>
					</DropdownMenu>
					{/* Close button */}
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={onClose}
						className="ml-1 text-muted-foreground hover:text-foreground"
					>
						<X size={15} />
					</Button>
				</div>
				{/* CodeMirror editor */}
				<div
					className="overflow-hidden"
					style={{ minHeight: 320, maxHeight: 480 }}
				>
					{cellModal && (
						<CodeMirror
							value={cellModal.value}
							onChange={onValueChange}
							theme={theme === "dark" ? oneDark : undefined}
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
				<div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border/50 bg-popover">
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
