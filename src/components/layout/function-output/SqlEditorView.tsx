import React, {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import CodeMirror from "@uiw/react-codemirror";
import { sql } from "@codemirror/lang-sql";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import { Clock, Bookmark, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useAppStore, EditorThemeOption } from "@/store/useAppStore";
import { cn } from "@/lib/utils";
import { Kbd } from "@/components/ui/kbd";
import { tauriApi } from "@/lib/tauri-api";
import { toast } from "@/components/ui/sonner";
import {
	ConnectionFunction,
	TableInfo,
	QueryHistoryEntry,
	SavedQuery,
} from "@/types";
import { QueryLog } from "@/components/layout/function-output/QueryLog";
import { QueryHistoryPanel } from "@/components/layout/function-output/sql-editor/QueryHistoryPanel";
import { SavedQueriesPanel } from "@/components/layout/function-output/sql-editor/SavedQueriesPanel";
import { SqlEditorToolbar } from "@/components/layout/function-output/sql-editor/SqlEditorToolbar";
import { ResultsGrid } from "@/components/layout/function-output/sql-editor/ResultsGrid";

// Theme imports
import { monokai } from "@fsegurai/codemirror-theme-monokai";
import { palenight } from "@fsegurai/codemirror-theme-palenight";
import { dracula } from "@uiw/codemirror-theme-dracula";
import { githubLight } from "@uiw/codemirror-theme-github";
import { solarizedLight } from "@uiw/codemirror-theme-solarized";

function isDestructive(sql: string): boolean {
	return /\b(DELETE|DROP|TRUNCATE)\b/i.test(sql.trim());
}

// Resolve editor theme to actual CodeMirror theme
function resolveEditorTheme(editorTheme: EditorThemeOption): Extension {
	if (editorTheme === "system") {
		const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
		return isDark ? oneDark : githubLight;
	}

	switch (editorTheme) {
		case "dark-one-dark":
			return oneDark;
		case "dark-monokai":
			return monokai;
		case "dark-palenight":
			return palenight;
		case "dark-dracula":
			return dracula;
		case "light-github":
			return githubLight;
		case "light-solarized":
			return solarizedLight;
		case "light-white-pine":
		case "light-soft-white":
			return createCustomLightTheme(editorTheme);
		default:
			return oneDark;
	}
}

// Create custom light themes using CSS variables
function createCustomLightTheme(variant: string): Extension {
	const isSoftWhite = variant === "light-soft-white";

	const base = {
		"&": {
			backgroundColor: "var(--color-card)",
			color: "var(--color-foreground)",
		},
		".cm-gutters": {
			backgroundColor: "var(--color-card)",
			color: "var(--color-muted-foreground)",
			borderRight: "1px solid var(--color-border)",
		},
		".cm-activeLineGutter": {
			backgroundColor: isSoftWhite ? "oklch(0.97 0 0)" : "var(--color-accent)",
		},
		".cm-activeLine": {
			backgroundColor: isSoftWhite ? "oklch(0.97 0 0)" : "var(--color-accent)",
		},
		".cm-cursor": {
			borderLeftColor: "var(--color-foreground)",
		},
		".cm-selectionBackground": {
			backgroundColor: "var(--color-muted) !important",
		},
		".cm-content": {
			caretColor: "var(--color-foreground)",
		},
		".cm-matchingBracket, .cm-nonmatchingBracket": {
			backgroundColor: "var(--color-accent)",
			outline: "1px solid var(--color-border)",
		},
	};

	return EditorView.theme(base);
}

export function SqlEditorView({
	fn,
	queryResult,
	isLoading,
	pendingSql,
	onSqlChange,
	onExecute,
	onExplain,
	tables,
}: {
	fn: ConnectionFunction;
	queryResult?: { columns: string[]; rows: any[]; executionTimeMs: number };
	isLoading: boolean;
	pendingSql: string;
	onSqlChange: (sql: string) => void;
	onExecute: () => void;
	onExplain: () => void;
	tables: TableInfo[];
}) {
	const {
		theme,
		queryHistory,
		connections,
		savedQueries,
		clearHistory,
		saveQuery,
		deleteSavedQuery,
		appSettings,
	} = useAppStore();
	const editorFontSize = appSettings.editorFontSize;
	// Sub-panel tab: which panel is currently shown
	const [panel, setPanel] = useState<"editor" | "history" | "saved">(
		"editor",
	);
	// Save-query UI state
	const [saveOpen, setSaveOpen] = useState(false);
	const [saveName, setSaveName] = useState("");
	const [previewOpen, setPreviewOpen] = useState(false);
	const [aiOpen, setAiOpen] = useState(false);
	const [aiPrompt, setAiPrompt] = useState("");
	const [aiIncludeSql, setAiIncludeSql] = useState(true);
	const [aiIncludeSchema, setAiIncludeSchema] = useState(true);
	const [aiReplaceEditor, setAiReplaceEditor] = useState(true);
	const [aiLoading, setAiLoading] = useState(false);
	const [aiConfigured, setAiConfigured] = useState(false);
	// Query log state
	const [showQueryLogSyntax, setShowQueryLogSyntax] = useState(true);
	const history: QueryHistoryEntry[] = queryHistory.filter(
		(entry) => entry.connectionId === fn.connectionId,
	);
	const connectionSaved: SavedQuery[] = savedQueries.filter(
		(q) => !q.connectionId || q.connectionId === fn.connectionId,
	);
	const hasSql = !!pendingSql.trim();
	const destructivePreview = isDestructive(pendingSql);
	useEffect(() => {
		const down = (e: KeyboardEvent) => {
			if (
				e.key === "Enter" &&
				(e.metaKey || e.ctrlKey) &&
				panel === "editor"
			) {
				e.preventDefault();
				onExecute();
			}
		};
		document.addEventListener("keydown", down);
		return () => document.removeEventListener("keydown", down);
	}, [onExecute, panel]);
	const fontSizeTheme = EditorView.theme({
		"&": { fontSize: `${editorFontSize}px` },
		".cm-content": { fontSize: `${editorFontSize}px` },
	});
	const activeEditorTheme = theme === "dark" ? appSettings.editorDarkTheme : appSettings.editorLightTheme;
	const editorTheme = useMemo(
		() => resolveEditorTheme(activeEditorTheme),
		[activeEditorTheme],
	);
	const sqlSchema = useMemo(() => {
		const s: Record<string, string[]> = {};
		for (const t of tables)
			s[t.name] = (t.columns ?? []).map((c) => c.name);
		return s;
	}, [tables]);
	// Resizable split
	const [editorHeightPx, setEditorHeightPx] = useState(220);
	const dragState = useRef<{ startY: number; startH: number } | null>(null);
	const currentDragHeight = useRef(220);
	const editorContainerRef = useRef<HTMLDivElement>(null);
	const startDrag = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			dragState.current = { startY: e.clientY, startH: editorHeightPx };
			document.body.style.cursor = "row-resize";
			document.body.style.userSelect = "none";
			const onMove = (ev: MouseEvent) => {
				if (!dragState.current) return;
				const next = Math.max(
					80,
					Math.min(
						600,
						dragState.current.startH +
							(ev.clientY - dragState.current.startY),
					),
				);
				currentDragHeight.current = next;
				// Direct DOM mutation — no React re-render on every pixel
				if (editorContainerRef.current) {
					editorContainerRef.current.style.height = `${next}px`;
				}
			};
			const onUp = () => {
				dragState.current = null;
				document.body.style.cursor = "";
				document.body.style.userSelect = "";
				// Commit final height to React state (single re-render)
				setEditorHeightPx(currentDragHeight.current);
				window.removeEventListener("mousemove", onMove);
				window.removeEventListener("mouseup", onUp);
			};
			window.addEventListener("mousemove", onMove);
			window.addEventListener("mouseup", onUp);
		},
		[editorHeightPx],
	);
	const handleSave = () => {
		const name = saveName.trim();
		if (!name || !pendingSql.trim()) return;
		saveQuery(name, pendingSql, fn.connectionId);
		setSaveName("");
		setSaveOpen(false);
	};
	const handlePreviewRun = async () => {
		setPreviewOpen(false);
		await onExecute();
	};
	const handlePreviewExplain = async () => {
		setPreviewOpen(false);
		await onExplain();
	};
	useEffect(() => {
		let mounted = true;
		tauriApi
			.aiGetCredentialStatus(appSettings.aiProvider)
			.then((status) => {
				if (mounted) setAiConfigured(status.configured);
			})
			.catch(() => {
				if (mounted) setAiConfigured(false);
			});
		return () => {
			mounted = false;
		};
	}, [aiOpen, appSettings.aiProvider]);

	const runAiQuickAction = (mode: "generate" | "explain" | "fix") => {
		if (mode === "explain") {
			setAiPrompt("Explain what this SQL does and potential performance issues.");
			setAiIncludeSql(true);
			setAiIncludeSchema(false);
			setAiReplaceEditor(false);
			return;
		}
		if (mode === "fix") {
			const last = history[0];
			const errorHint = last
				? "Use the last failed query context if relevant and provide a corrected query."
				: "Fix syntax and logical issues in current SQL and return corrected SQL.";
			setAiPrompt(errorHint);
			setAiIncludeSql(true);
			setAiIncludeSchema(true);
			setAiReplaceEditor(true);
			return;
		}
		setAiPrompt("");
		setAiIncludeSql(true);
		setAiIncludeSchema(true);
		setAiReplaceEditor(true);
	};
	const handleAiGenerate = async () => {
		if (!appSettings.aiEnabled) {
			toast.error("AI is disabled. Enable it from Settings > AI.");
			return;
		}
		if (!aiConfigured) {
			toast.error(`${appSettings.aiProvider} is not configured. Setup in Settings > AI.`);
			return;
		}
		const prompt = aiPrompt.trim();
		if (!prompt) {
			toast.error("Enter a prompt for AI generation.");
			return;
		}
		setAiLoading(true);
		try {
			const contextParts: string[] = [];
			contextParts.push("You are an expert SQL assistant. Return only executable SQL. No markdown code fences.");
			contextParts.push(`Database engine: ${connections.find((c) => c.id === fn.connectionId)?.type ?? "unknown"}`);
			if (aiIncludeSchema) {
				const schemaLines = tables.slice(0, 40).map((t) => {
					const cols = (t.columns ?? []).slice(0, 20).map((c) => `${c.name}:${c.dataType}`).join(", ");
					return `${t.name}${cols ? ` (${cols})` : ""}`;
				});
				if (schemaLines.length) {
					contextParts.push(`Schema context:\n${schemaLines.join("\n")}`);
				}
			}
			if (aiIncludeSql && pendingSql.trim()) {
				contextParts.push(`Current SQL:\n${pendingSql.trim()}`);
			}
			contextParts.push(`User request:\n${prompt}`);

			const response = await tauriApi.aiChatCompletion({
				provider: appSettings.aiProvider,
				model: appSettings.aiDefaultModel || "openrouter/free",
				messages: [
					{ role: "system", content: "Generate safe, precise SQL for the user's database context." },
					{ role: "user", content: contextParts.join("\n\n") },
				],
				temperature: 0.2,
				maxTokens: 1200,
			});

			let generated = response.content.trim();
			if (generated.startsWith("```") && generated.endsWith("```")) {
				generated = generated
					.replace(/^```[a-zA-Z]*\n?/, "")
					.replace(/\n?```$/, "")
					.trim();
			}
			if (!generated) {
				throw new Error("AI returned empty SQL");
			}
			const shouldReplace = aiReplaceEditor;
			onSqlChange(shouldReplace ? generated : `${pendingSql.trim()}\n\n${generated}`.trim());
			setAiOpen(false);
			setAiPrompt("");
			toast.success("SQL generated");
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			toast.error(message || "AI generation failed");
		} finally {
			setAiLoading(false);
		}
	};
	const tabBtn = (
		id: typeof panel,
		icon: React.ReactNode,
		label: string,
		count?: number,
	) => (
		<Button
			variant="ghost"
			onClick={() => setPanel(id)}
			className={cn(
				"h-full px-3 rounded-none gap-1.5 text-[11px] font-bold uppercase tracking-widest border-b-2 border-transparent",
				panel === id
					? "text-accent-blue border-blue-500"
					: "text-muted-foreground/50 hover:text-muted-foreground",
			)}
		>
			{icon}
			{label}
			{count !== undefined && count > 0 && (
				<Badge
					variant="secondary"
					className="h-4 px-1 text-[10px] font-mono"
				>
					{count}
				</Badge>
			)}
		</Button>
	);
	return (
		<div className="h-full flex flex-col bg-background overflow-hidden">
			{/* Header */}
			<div className="h-9 flex items-center justify-between bg-background border-b border-border px-4 shrink-0">
				<span className="font-mono text-[11px] text-accent-blue font-bold">
					{fn.callSignature
						.slice(fn.prefix.length + 1)
						.replace(/\(.*$/, "")}
				</span>
				<span className="text-[10px] font-mono text-muted-foreground/30 uppercase tracking-widest">
					{fn.type === "execute" ? "DDL / DML" : "SELECT"}
				</span>
			</div>
			{/* Sub-tab strip */}
			<div className="h-8 bg-background border-b border-border flex items-stretch shrink-0 px-1">
				{tabBtn("editor", <Pencil size={9} />, "Editor")}
				{tabBtn(
					"history",
					<Clock size={9} />,
					"History",
					history.length,
				)}
				{tabBtn(
					"saved",
					<Bookmark size={9} />,
					"Saved",
					connectionSaved.length,
				)}
			</div>
			{/* ── History panel ── */}
			{panel === "history" && (
				<QueryHistoryPanel
					history={history}
					connections={connections}
					onSelectQuery={(sql) => { onSqlChange(sql); setPanel("editor"); }}
					onClearHistory={() => clearHistory(fn.connectionId)}
				/>
			)}
			{/* ── Saved queries panel ── */}
			{panel === "saved" && (
				<SavedQueriesPanel
					savedQueries={connectionSaved}
					onLoadQuery={(sql) => { onSqlChange(sql); setPanel("editor"); }}
					onDeleteQuery={deleteSavedQuery}
				/>
			)}
			{/* ── Editor panel ── */}
			{panel === "editor" && (
				<>
				{/* Editor area — fixed height when results visible, flex-1 otherwise */}
				<div
					ref={editorContainerRef}
					className="relative group min-h-0 overflow-hidden"
					style={
						queryResult
							? { height: editorHeightPx, flexShrink: 0 }
							: { flex: "1 1 0%" }
					}
				>
						<div className="absolute inset-0 scrollbar-thin">
							<CodeMirror
								value={pendingSql}
								height="100%"
								theme={editorTheme}
								extensions={[
									sql({ schema: sqlSchema }),
									fontSizeTheme,
								]}
								onChange={onSqlChange}
								className="text-[13px] h-full selection:bg-primary/30"
								basicSetup={{
									lineNumbers: true,
									foldGutter: false,
									highlightActiveLine: true,
									dropCursor: true,
									allowMultipleSelections: true,
									indentOnInput: true,
									syntaxHighlighting: true,
									bracketMatching: true,
									autocompletion: true,
									rectangularSelection: true,
									crosshairCursor: true,
									highlightSelectionMatches: true,
									closeBrackets: true,
									searchKeymap: true,
								}}
							/>
						</div>
						<div className="absolute top-4 right-6 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
							<Kbd>⌘↵</Kbd>
						</div>
					</div>
					{/* Execute + Format + Save bar */}
					<SqlEditorToolbar
						isLoading={isLoading}
						hasSql={hasSql}
						saveOpen={saveOpen}
						saveName={saveName}
						onPreview={() => setPreviewOpen(true)}
						onExecute={onExecute}
						onExplain={onExplain}
						aiEnabled={appSettings.aiEnabled}
						aiConfigured={aiConfigured}
						onFormat={() => {
							const keywords = [
								"SELECT", "FROM", "WHERE", "JOIN", "LEFT JOIN",
								"RIGHT JOIN", "INNER JOIN", "OUTER JOIN", "GROUP BY",
								"ORDER BY", "HAVING", "LIMIT", "OFFSET", "ON",
								"AND", "OR", "AS", "INSERT INTO", "UPDATE", "SET",
								"DELETE FROM", "CREATE", "DROP", "ALTER", "VALUES",
								"UNION", "WITH",
							];
							let fmt = pendingSql.trim();
							keywords.forEach((kw) => {
								fmt = fmt.replace(new RegExp(`\\b${kw}\\b`, "gi"), `\n${kw}`);
							});
							onSqlChange(fmt.replace(/^\n/, "").replace(/\n{2,}/g, "\n"));
						}}
						onAiOpen={() => setAiOpen(true)}
						onSaveOpen={() => setSaveOpen(true)}
						onSaveNameChange={setSaveName}
						onSaveConfirm={handleSave}
						onSaveCancel={() => { setSaveOpen(false); setSaveName(""); }}
					/>
					{/* Results */}
					{queryResult && (
						<ResultsGrid
							queryResult={queryResult}
							tables={tables}
							connectionId={fn.connectionId}
							onResizeStart={startDrag}
						/>
					)}
					{/* Query Log — always visible */}
					<QueryLog
						entries={history}
						showSyntax={showQueryLogSyntax}
						onSyntaxToggle={setShowQueryLogSyntax}
						onClear={() => clearHistory(fn.connectionId)}
					/>
				</>
			)}
			<Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
				<DialogContent className="max-w-2xl p-0 overflow-hidden">
					<DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
						<div className="flex items-center justify-between gap-3">
							<div className="min-w-0">
								<DialogTitle>Preview SQL</DialogTitle>
								<DialogDescription className="mt-1">
									Review the current query before running it.
								</DialogDescription>
							</div>
							<div className="flex items-center gap-2 shrink-0">
							<Badge
								variant="secondary"
								className="text-[10px] font-mono uppercase tracking-widest"
							>
								{fn.type === "execute" ? "DDL / DML" : "Query"}
							</Badge>
							{destructivePreview && (
								<Badge className="text-[10px] font-mono uppercase tracking-widest bg-destructive/12 text-destructive border border-destructive/20 hover:bg-destructive/12">
									Destructive
								</Badge>
							)}
							</div>
						</div>
					</DialogHeader>
					<div className="px-5 py-4">
						<pre className="max-h-[50vh] overflow-auto rounded-lg border border-border bg-muted/35 px-4 py-3 text-[12px] font-mono whitespace-pre-wrap break-all text-foreground/85">
							{pendingSql.trim() || "No SQL to preview."}
						</pre>
					</div>
					<DialogFooter className="mx-0 mb-0 rounded-none border-t bg-card/60 px-5 py-4">
						<Button variant="outline" onClick={() => setPreviewOpen(false)}>
							Close
						</Button>
						<Button
							variant="ghost"
							onClick={handlePreviewExplain}
							disabled={!hasSql || isLoading}
						>
							Explain
						</Button>
						<Button
							onClick={handlePreviewRun}
							disabled={!hasSql || isLoading}
						>
							Run
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			<Dialog open={aiOpen} onOpenChange={setAiOpen}>
				<DialogContent className="max-w-2xl">
					<DialogHeader>
						<DialogTitle>AI SQL Assistant</DialogTitle>
						<DialogDescription>
							Generate SQL with {appSettings.aiProvider} ({appSettings.aiDefaultModel || "openrouter/free"}).
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-3">
						<div className="flex flex-wrap items-center gap-2">
							<Button
								variant="outline"
								size="xs"
								onClick={() => runAiQuickAction("generate")}
								className="h-7"
							>
								General SQL
							</Button>
							<Button
								variant="outline"
								size="xs"
								onClick={() => runAiQuickAction("explain")}
								className="h-7"
							>
								Explain SQL
							</Button>
							<Button
								variant="outline"
								size="xs"
								onClick={() => runAiQuickAction("fix")}
								className="h-7"
							>
								Fix SQL Error
							</Button>
							<span className={cn(
								"ml-auto text-[10px] font-bold uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-md border",
								aiConfigured
									? "border-emerald-500/35 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300"
									: "border-amber-500/35 bg-amber-500/8 text-amber-700 dark:text-amber-300",
							)}>
								{aiConfigured ? `${appSettings.aiProvider} Ready` : `${appSettings.aiProvider} Setup Needed`}
							</span>
						</div>
						<Input
							value={aiPrompt}
							onChange={(e) => setAiPrompt(e.target.value)}
							placeholder="e.g. find top 10 customers by revenue in last 30 days"
							className="h-9"
						/>
						<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
							<label className="flex items-center gap-2 text-[12px] text-muted-foreground">
								<Switch checked={aiIncludeSql} onCheckedChange={(v) => setAiIncludeSql(!!v)} />
								Include current SQL
							</label>
							<label className="flex items-center gap-2 text-[12px] text-muted-foreground">
								<Switch checked={aiIncludeSchema} onCheckedChange={(v) => setAiIncludeSchema(!!v)} />
								Include schema context
							</label>
							<label className="flex items-center gap-2 text-[12px] text-muted-foreground">
								<Switch checked={aiReplaceEditor} onCheckedChange={(v) => setAiReplaceEditor(!!v)} />
								Replace editor SQL
							</label>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setAiOpen(false)}>
							Cancel
						</Button>
						<Button onClick={handleAiGenerate} disabled={aiLoading || !aiPrompt.trim()}>
							{aiLoading ? "Generating..." : "Generate SQL"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
