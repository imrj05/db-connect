import { useRef, useEffect } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { sql } from "@codemirror/lang-sql";
import { EditorView } from "@codemirror/view";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export function QueryLog({
	entries,
	showSyntax,
	onSyntaxToggle,
	onClear,
}: {
	entries: Array<{ sql: string; executedAt: number }>;
	showSyntax: boolean;
	onSyntaxToggle: (show: boolean) => void;
	onClear: () => void;
}) {
	const scrollRef = useRef<HTMLDivElement>(null);
	// Auto-scroll to bottom after render (double-rAF to let CodeMirror finish layout)
	useEffect(() => {
		const id = requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				if (scrollRef.current) {
					scrollRef.current.scrollTop =
						scrollRef.current.scrollHeight;
				}
			});
		});
		return () => cancelAnimationFrame(id);
	}, [entries.length, showSyntax]);
	const formatTimestamp = (ts: number) => {
		const d = new Date(ts);
		const pad = (n: number, len = 2) => String(n).padStart(len, "0");
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
	};
	// entries are newest-first; reverse so oldest is at top (terminal-style)
	const ordered = [...entries].reverse();
	const fullText = ordered
		.map((e) => `-- ${formatTimestamp(e.executedAt)}\n${e.sql}`)
		.join("\n\n");
	return (
		<div className="h-[168px] w-full border-t border-border/80 flex flex-col bg-background shrink-0 overflow-hidden">
			{/* Query display */}
			<div
				ref={scrollRef}
				className="flex-1 overflow-auto scrollbar-thin px-3.5 py-2.5"
			>
				{entries.length === 0 ? (
					<p className="text-[11px] font-mono text-foreground/42 py-1">
						No queries executed yet
					</p>
				) : showSyntax ? (
					<CodeMirror
						value={fullText}
						extensions={[sql()]}
						basicSetup={{ lineNumbers: false, foldGutter: false }}
						theme={EditorView.theme({
							"&": {
								fontSize: "12px",
								backgroundColor: "transparent",
								color: "var(--color-foreground)",
							},
							".cm-gutters": { display: "none" },
							".cm-content": { padding: "0" },
						})}
						readOnly
						height="auto"
					/>
				) : (
					<pre className="text-[12px] leading-5 font-mono text-foreground whitespace-pre-wrap break-words select-text">
						{fullText}
					</pre>
				)}
			</div>
			{/* Bottom toolbar */}
			<div className="h-8 flex items-center justify-start px-3.5 py-1 border-t border-border/80 shrink-0 bg-card gap-3.5">
				<Button
					variant="ghost"
					size="icon-xs"
					className="size-6 text-foreground/46 hover:text-foreground"
					title="Clear logs"
					onClick={onClear}
				>
					<Trash2 size={11} />
				</Button>
				<span className="text-[11px] font-mono text-foreground/44">
					{entries.length}{" "}
					{entries.length === 1 ? "query" : "queries"}
				</span>
				<label className="flex items-center gap-1.5 cursor-pointer shrink-0">
					<Checkbox
						checked={showSyntax}
						onCheckedChange={(checked) => onSyntaxToggle(checked === true)}
						className="size-3.5"
					/>
					<span className="text-[11px] font-label text-foreground/62">
						Enable Syntax highlighting
					</span>
				</label>
			</div>
		</div>
	);
}
