import { useRef, useEffect } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { sql } from "@codemirror/lang-sql";
import { EditorView } from "@codemirror/view";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

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
		<div className="h-[140px] w-full border-t border-border flex flex-col bg-background shrink-0 overflow-hidden">
			{/* Query display */}
			<div
				ref={scrollRef}
				className="flex-1 overflow-auto scrollbar-thin px-3 py-2"
			>
				{entries.length === 0 ? (
					<p className="text-[10px] font-mono text-muted-foreground/30 py-1">
						No queries executed yet
					</p>
				) : showSyntax ? (
					<CodeMirror
						value={fullText}
						extensions={[sql()]}
						basicSetup={{ lineNumbers: false, foldGutter: false }}
						theme={EditorView.theme({
							"&": {
								fontSize: "11px",
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
					<pre className="text-[11px] font-mono text-foreground whitespace-pre-wrap break-words">
						{fullText}
					</pre>
				)}
			</div>
			{/* Bottom toolbar */}
			<div className="h-7 flex items-center justify-start px-3 py-1 border-t border-border shrink-0 bg-card gap-3">
				<Button
					variant="ghost"
					size="icon-xs"
					className="size-5 text-muted-foreground/40 hover:text-muted-foreground"
					title="Clear logs"
					onClick={onClear}
				>
					<Trash2 size={10} />
				</Button>
				<span className="text-[9px] font-mono text-muted-foreground/30">
					{entries.length}{" "}
					{entries.length === 1 ? "query" : "queries"}
				</span>
				<label className="flex items-center gap-1.5 cursor-pointer shrink-0">
					<input
						type="checkbox"
						checked={showSyntax}
						onChange={(e) => onSyntaxToggle(e.target.checked)}
						className="w-3 h-3 accent-primary"
					/>
					<span className="text-[9px] font-label text-muted-foreground/70">
						Enable Syntax highlighting
					</span>
				</label>
			</div>
		</div>
	);
}
