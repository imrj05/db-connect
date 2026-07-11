import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Copy, Check, ChevronDown, ChevronRight, RefreshCw, FileCode2 } from "lucide-react";
import { toast } from "sonner";
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
import { useAppStore } from "@/store/useAppStore";
import { IdleView } from "@/components/layout/function-output/idle-view";
import { ConnectionsHome } from "@/components/layout/function-output/connections-home";
import { TableListView } from "@/components/layout/function-output/table-list-view";
import { ConnectionSrcView } from "@/components/layout/function-output/connection-src-view";
import { TabBar } from "@/components/layout/function-output/tab-bar";
import { TableGridView } from "@/components/layout/function-output/table-grid-view";
import { SqlEditorView } from "@/components/layout/function-output/sql-editor-view";

function isWriteSql(sql: string): boolean {
	return /^\s*(insert|update|delete|drop|truncate|alter|create|replace|merge)\b/i.test(sql);
}

function isDestructive(sql: string): boolean {
	if (/\b(DELETE|DROP|TRUNCATE)\b/i.test(sql.trim())) return true;
	// UPDATE without WHERE is also destructive
	if (/\bUPDATE\b/i.test(sql) && !/\bWHERE\b/i.test(sql)) return true;
	return false;
}

function getProductionConfirmationPhrase(sql: string): string {
	const trimmed = sql.trim();
	const dropOrTruncate = trimmed.match(/^\s*(?:DROP|TRUNCATE)\s+(?:TABLE\s+)?["`]?([\w.-]+)["`]?/i);
	if (dropOrTruncate?.[1]) return dropOrTruncate[1].split(".").pop() ?? dropOrTruncate[1];
	if (/^\s*DELETE\b/i.test(trimmed) && !/\bWHERE\b/i.test(trimmed)) return "DELETE";
	if (/^\s*UPDATE\b/i.test(trimmed) && !/\bWHERE\b/i.test(trimmed)) return "UPDATE";
	return "RUN";
}

function buildExplainSql(sql: string): string {
	const trimmed = sql.trim().replace(/;+\s*$/, "");
	return /^EXPLAIN\b/i.test(trimmed) ? trimmed : `EXPLAIN ${trimmed}`;
}

function getErrorHint(error: string): string | null {
	const lower = error.toLowerCase();
	if (lower.includes("does not exist") || lower.includes("no such table") || lower.includes("unknown column")) {
		return "Check the table, column, schema, or selected database name.";
	}
	if (lower.includes("permission denied") || lower.includes("access denied") || lower.includes("not authorized")) {
		return "Check this database user's grants and role permissions.";
	}
	if (lower.includes("timed out") || lower.includes("timeout")) {
		return "Try increasing the query timeout, narrowing the result set, or checking indexes.";
	}
	if (lower.includes("syntax error") || lower.includes("parse error")) {
		return "Check SQL syntax near the reported token or line.";
	}
	if (lower.includes("connection refused") || lower.includes("could not connect") || lower.includes("network")) {
		return "Check host, port, tunnel, VPN, firewall, and database availability.";
	}
	return null;
}

function getErrorSummary(error: string): string {
	return error.split("\n").map((line) => line.trim()).find(Boolean) ?? "Something went wrong";
}

function isEditableElement(target: EventTarget | null): boolean {
	const el = target as HTMLElement | null;
	if (!el) return false;
	return !!el.closest(
		'input, textarea, select, [contenteditable="true"], [role="textbox"], .cm-content',
	);
}

// ─── Main Function Output Panel ───────────────────────────────────────────────
const FunctionOutput = () => {
	const {
		invocationResult,
		activeFunction,
		pendingSqlValue,
		setPendingSql,
		invokeFunction,
		runMultiStatementSql,
		connectionFunctions,
		connectionTables,
		connections,
		setConnectionDialogOpen,
		setEditingConnection,
		connectAndInit,
		disconnectConnection,
		isLoading,
		tabs,
		activeTabId,
		openNewTab,
		closeTab,
		closeOtherTabs,
		closeTabsToRight,
		duplicateTab,
		reorderTabs,
		switchToTab,
		clearPendingCellEdits,
		clearInvocationError,
		cancelActiveQuery,
		runningQueryIds,
		connectedIds,
		appSettings,
		showConnectionsManager,
		setShowConnectionsManager,
		setActiveView,
	} = useAppStore();
	const activeConnObj = useMemo(() => { const connId = activeFunction?.connectionId; return connId ? connections.find((c) => c.id === connId) ?? null : null; }, [activeFunction, connections]);
	const isProductionConn = useMemo(() => !!(activeConnObj?.group?.toLowerCase().includes("prod")), [activeConnObj]);
	const [page, setPage] = useState(0);
	const [localPageSize, setLocalPageSize] = useState<number | null>(null);
	const [pendingDangerSql, setPendingDangerSql] = useState<string | null>(null);
	const [dangerConfirmInput, setDangerConfirmInput] = useState("");
	const [pendingTabCloseId, setPendingTabCloseId] = useState<string | null>(null);
	const [connectingHomeIds, setConnectingHomeIds] = useState<Set<string>>(new Set());
	const [cancellingHomeIds, setCancellingHomeIds] = useState<Set<string>>(new Set());
	const homeConnectCancelRef = useRef<Set<string>>(new Set());
	const [errorCopied, setErrorCopied] = useState(false);
	const [errorExpanded, setErrorExpanded] = useState(false);
	// NOTE: errorSqlCopied MUST be declared at the top level of the component,
	// not inside renderContent(). It was previously declared inside the
	// `if (invocationResult?.error)` conditional block within renderContent(),
	// which is a Rules of Hooks violation — the hook was conditionally called,
	// changing the hook count between renders and causing
	// "Maximum update depth exceeded" when the error state changed.
	const [errorSqlCopied, setErrorSqlCopied] = useState(false);
	// Reset both page and per-tab page size when switching to a different function/table
	useEffect(() => {
		setPage(0);
		setLocalPageSize(null);
	}, [activeFunction?.id]);
	useEffect(() => {
		const handleTabShortcut = (event: KeyboardEvent) => {
			if ((!event.metaKey && !event.ctrlKey) || event.altKey || event.shiftKey) {
				return;
			}
			if (!/^[1-9]$/.test(event.key)) return;
			if (isEditableElement(event.target)) return;

			const tabIndex = Number(event.key) - 1;
			const targetTab = tabs[tabIndex];
			if (!targetTab) return;

			event.preventDefault();
			switchToTab(targetTab.id);
		};

		window.addEventListener("keydown", handleTabShortcut);
		return () => window.removeEventListener("keydown", handleTabShortcut);
	}, [switchToTab, tabs]);
	const handleExecuteSql = useCallback(async (sqlOverride?: string) => {
		if (!activeFunction) return;
		const sql = (sqlOverride ?? pendingSqlValue).trim();
		if (!sql) return;
		const writeSql = isWriteSql(sql);
		if (activeConnObj?.safetyMode === "read-only" && writeSql) {
			toast.error("Read-only connection — write queries are blocked.");
			return;
		}
		const isProdWrite = isProductionConn && writeSql;
		if (isDestructive(sql) || isProdWrite) { setDangerConfirmInput(""); setPendingDangerSql(sql); return; }
		// Detect multiple statements
		const stmts = sql.split(/;/).map((s) => s.replace(/--[^\n]*/g, "").trim()).filter(Boolean);
		if (stmts.length > 1) {
			await runMultiStatementSql(activeFunction, sql);
		} else {
			await invokeFunction(activeFunction, { sql });
		}
	}, [activeFunction, pendingSqlValue, invokeFunction, runMultiStatementSql, isProductionConn, activeConnObj?.safetyMode]);
	const confirmDangerSql = useCallback(async () => {
		if (!pendingDangerSql || !activeFunction) return;
		const sql = pendingDangerSql;
		setPendingDangerSql(null);
		setDangerConfirmInput("");
		await invokeFunction(activeFunction, { sql });
	}, [pendingDangerSql, activeFunction, invokeFunction]);
	const handleExplainSql = useCallback(async () => {
		if (!activeFunction || !pendingSqlValue.trim()) return;
		await invokeFunction(activeFunction, {
			sql: buildExplainSql(pendingSqlValue),
		});
	}, [activeFunction, pendingSqlValue, invokeFunction]);
	const handlePageChange = useCallback(
		async (newPage: number) => {
		if (!activeFunction) return;
		setPage(newPage);
		await invokeFunction(activeFunction, { page: newPage, pageSize: localPageSize ?? appSettings.tablePageSize });
	},
	[activeFunction, invokeFunction, localPageSize, appSettings.tablePageSize],
	);
	const handleTableClick = useCallback(
		async (tableName: string, schema?: string) => {
			if (!invocationResult) return;
			const allFns = Object.values(connectionFunctions).flatMap((dbMap) => Object.values(dbMap).flat());
			const tableFn = allFns.find(
				(fn) =>
					fn.type === "table" &&
					fn.connectionId === invocationResult.fn.connectionId &&
					fn.tableName === tableName &&
					(schema === undefined || fn.schema === schema),
			);
			if (tableFn) await invokeFunction(tableFn);
		},
		[invocationResult, connectionFunctions, invokeFunction],
	);
	const handleHomeConnect = useCallback(
		async (id: string) => {
			homeConnectCancelRef.current.delete(id);
			setConnectingHomeIds((prev) => new Set(prev).add(id));
			setCancellingHomeIds((prev) => {
				const next = new Set(prev);
				next.delete(id);
				return next;
			});
			try {
				const connected = await connectAndInit(id, {
					isCancelled: () => homeConnectCancelRef.current.has(id),
				});
				if (connected) {
					setShowConnectionsManager(false);
				}
			} finally {
				homeConnectCancelRef.current.delete(id);
				setConnectingHomeIds((prev) => {
					const next = new Set(prev);
					next.delete(id);
					return next;
				});
				setCancellingHomeIds((prev) => {
					const next = new Set(prev);
					next.delete(id);
					return next;
				});
			}
		},
		[connectAndInit, setShowConnectionsManager],
	);
	const handleHomeCancelConnect = useCallback((id: string) => {
		homeConnectCancelRef.current.add(id);
		setCancellingHomeIds((prev) => new Set(prev).add(id));
	}, []);
	const handleCloseTab = useCallback(
		(tabId: string) => {
			const tab = tabs.find((candidate) => candidate.id === tabId);
			if ((tab?.pendingEdits.length ?? 0) > 0) {
				setPendingTabCloseId(tabId);
				return;
			}
			// Guard against discarding unsaved SQL in a SQL-editor tab.
			const isSqlEditor = tab?.result?.outputType === "sql-editor";
			const liveSql = tab?.id === activeTabId ? pendingSqlValue : tab?.pendingSql ?? "";
			if (isSqlEditor && liveSql.trim().length > 0) {
				setPendingTabCloseId(tabId);
				return;
			}
			closeTab(tabId);
		},
		[tabs, closeTab, activeTabId, pendingSqlValue],
	);
	const confirmDiscardTab = useCallback(() => {
		if (!pendingTabCloseId) return;
		clearPendingCellEdits(pendingTabCloseId);
		closeTab(pendingTabCloseId);
		setPendingTabCloseId(null);
	}, [clearPendingCellEdits, closeTab, pendingTabCloseId]);
	const pendingCloseTab = useMemo(
		() => tabs.find((tab) => tab.id === pendingTabCloseId) ?? null,
		[pendingTabCloseId, tabs],
	);
	const pendingCloseReason = useMemo<"pending-edits" | "unsaved-sql" | null>(() => {
		if (!pendingCloseTab) return null;
		if (pendingCloseTab.pendingEdits.length > 0) return "pending-edits";
		return "unsaved-sql";
	}, [pendingCloseTab]);
	const activeTableDatabase = useMemo(() => {
		if (!activeFunction?.tableName) return "default";
		const conn = connections.find((c) => c.id === activeFunction.connectionId);
		// fn.schema means different things per driver:
		//   - MySQL: schema IS the database name → safe to use as the DB arg.
		//   - Postgres: schema is a namespace (e.g. "public") INSIDE a database →
		//     must NOT be passed as the DB arg, or the backend will try to
		//     switch to a database that doesn't exist.
		//   - SQLite: no schema/db concept.
		if (conn?.type === "mysql") {
			return activeFunction.schema ?? conn?.database ?? "default";
		}
		return conn?.database ?? "default";
	}, [activeFunction, connections]);
	// ── Content renderer ──
	const renderContent = () => {
		const openNewConnectionPage = () => {
			setShowConnectionsManager(false);
			setActiveView("new-connection");
		};

		const outputType = invocationResult?.outputType ?? "idle";
		if (isLoading || (invocationResult?.isLoading && outputType !== "sql-editor")) {
			const label = activeFunction
				? activeFunction.callSignature
						.slice(activeFunction.prefix.length + 1)
						.replace(/\(.*$/, "")
				: "";
			return (
				<div className="h-full flex items-center justify-center bg-surface-2">
					<div className="text-center space-y-3">
						<Loader2 size={24} className="animate-spin text-primary mx-auto" />
						{label && (
							<p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest">
								{label}
							</p>
						)}
					</div>
				</div>
			);
		}
		if (invocationResult?.error && activeFunction) {
			const errorText = invocationResult.error;
			const lines = errorText.split("\n");
			const isMultiLine = lines.length > 3;
			const preview = lines.slice(0, 3).join("\n");
			const errorSummary = getErrorSummary(errorText);
			const errorHint = getErrorHint(errorText);
			const handleCopyError = () => {
				navigator.clipboard.writeText(errorText).then(() => {
					setErrorCopied(true);
					setTimeout(() => setErrorCopied(false), 2000);
				});
			};
			const handleCopySql = () => {
				if (!pendingSqlValue) return;
				navigator.clipboard.writeText(pendingSqlValue).then(() => {
					setErrorSqlCopied(true);
					setTimeout(() => setErrorSqlCopied(false), 2000);
				});
			};
			const handleRetry = () => {
				clearInvocationError();
				const sql = pendingSqlValue.trim();
				if (!sql) return;
				if (activeFunction.type === "query" || activeFunction.type === "execute") {
					void invokeFunction(activeFunction, { sql });
				} else {
					void invokeFunction(activeFunction);
				}
			};
			return (
				<div className="h-full flex items-center justify-center bg-background p-8">
					<div className="max-w-2xl w-full bg-destructive/5 border border-destructive/20 rounded-lg overflow-hidden">
						<div className="flex items-center justify-between px-4 pt-4 pb-2">
							<p className="text-[10px] font-bold uppercase tracking-widest text-destructive">Error</p>
							<div className="flex items-center gap-1.5">
								<button
									onClick={() => clearInvocationError()}
									className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-foreground/50 hover:bg-muted hover:text-foreground transition-colors"
								>
									← Back to Editor
								</button>
								<button
									onClick={handleRetry}
									className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-foreground/50 hover:bg-muted hover:text-foreground transition-colors"
								>
									<RefreshCw size={10} />
									Retry
								</button>
								{pendingSqlValue && (
									<button
										onClick={handleCopySql}
										className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-foreground/50 hover:bg-muted hover:text-foreground transition-colors"
									>
										{errorSqlCopied ? <Check size={10} /> : <FileCode2 size={10} />}
										{errorSqlCopied ? "SQL copied" : "Copy SQL"}
									</button>
								)}
								<button
									onClick={handleCopyError}
									className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-destructive/70 hover:bg-destructive/10 hover:text-destructive transition-colors"
								>
									{errorCopied ? <Check size={10} /> : <Copy size={10} />}
									{errorCopied ? "Copied" : "Copy error"}
								</button>
							</div>
						</div>
						<div className="px-4 pb-2">
							<p className="text-[14px] font-semibold text-foreground">{errorSummary}</p>
							<p className="mt-1 text-[11px] text-muted-foreground">
								{activeConnObj?.name ?? activeFunction.connectionId}
								{activeTableDatabase ? <> · <span className="font-mono">{activeTableDatabase}</span></> : null}
								{" · "}
								<span className="font-mono">{activeFunction.callSignature}</span>
							</p>
							{errorHint && (
								<div className="mt-3 rounded border border-warning/30 bg-warning/8 px-3 py-2 text-[12px] text-foreground/80">
									<span className="font-semibold text-warning">Hint:</span> {errorHint}
								</div>
							)}
						</div>
						<div className="px-4 pb-4">
							<pre className="whitespace-pre-wrap text-xs font-mono text-destructive/80 leading-relaxed">
								{isMultiLine && !errorExpanded ? preview + "\n…" : errorText}
							</pre>
							{isMultiLine && (
								<button
									onClick={() => setErrorExpanded((v) => !v)}
									className="mt-2 flex items-center gap-1 text-[10px] text-foreground/40 hover:text-foreground/70 transition-colors"
								>
									{errorExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
									{errorExpanded ? "Show less" : `Show ${lines.length - 3} more lines`}
								</button>
							)}
						</div>
					</div>
				</div>
			);
		}
		if (
			showConnectionsManager ||
			outputType === "idle" ||
			!invocationResult ||
			!activeFunction
		) {
			if (showConnectionsManager || connectedIds.length === 0) {
				return (
					<ConnectionsHome
						connections={connections}
						connectedIds={connectedIds}
						connectingIds={[...connectingHomeIds]}
						cancellingIds={[...cancellingHomeIds]}
						onNewConnection={openNewConnectionPage}
						onEdit={(conn) => {
							setEditingConnection(conn);
							setConnectionDialogOpen(true);
						}}
						onConnect={handleHomeConnect}
						onCancelConnect={handleHomeCancelConnect}
						onDisconnect={(id) => disconnectConnection(id)}
						onOpenTable={(connectionId, tableName, schema) => {
							const fns = Object.values(connectionFunctions[connectionId] ?? {}).flat();
							const tableFn = fns.find(
                                (f) => f.type === "table" && f.tableName === tableName && f.schema === schema,
                            );
                            if (tableFn) {
                                void invokeFunction(tableFn);
                            }
                        }}
					/>
				);
			}
			return (
				<IdleView onNewConnection={openNewConnectionPage} />
			);
		}
		switch (outputType) {
			case "table-grid":
				return (
					<TableGridView
						fn={activeFunction}
						queryResult={invocationResult.queryResult}
						isLoading={false}
						onPageChange={handlePageChange}
						onPageSizeChange={async (newSize) => {
							setLocalPageSize(newSize);
							setPage(0);
							await invokeFunction(activeFunction, { page: 0, pageSize: newSize });
						}}
						page={page}
						database={activeTableDatabase}
						pageSize={localPageSize ?? appSettings.tablePageSize}
					/>
				);
			case "sql-editor":
				return (
					<SqlEditorView
						fn={activeFunction}
						queryResult={invocationResult.queryResult}
						isLoading={!!invocationResult.isLoading}
						pendingSql={pendingSqlValue}
						onSqlChange={setPendingSql}
						onExecute={handleExecuteSql}
						onExplain={handleExplainSql}
						onCancel={cancelActiveQuery}
						canCancel={!!(activeTabId && runningQueryIds[activeTabId])}
						tables={Object.values(connectionTables[activeFunction.connectionId] ?? {}).flat()}
					/>
				);
			case "table-list":
				return (
					<TableListView
						fn={activeFunction}
						tables={invocationResult.tables ?? []}
						onTableClick={handleTableClick}
					/>
				);
			case "connection-src":
				return (
					<ConnectionSrcView
						fn={activeFunction}
						info={invocationResult.connectionInfo!}
					/>
				);
			default:
				return (
					<IdleView onNewConnection={openNewConnectionPage} />
				);
		}
	};
	const pendingDangerIsWrite = pendingDangerSql ? isWriteSql(pendingDangerSql) : false;
	const pendingDangerRequiresPhrase = !!(pendingDangerSql && isProductionConn && pendingDangerIsWrite);
	const pendingDangerPhrase = pendingDangerSql ? getProductionConfirmationPhrase(pendingDangerSql) : "";
	const pendingDangerCanRun = !pendingDangerRequiresPhrase || dangerConfirmInput.trim() === pendingDangerPhrase;
	return (
		<div className="flex h-full w-full flex-col overflow-hidden bg-surface-1">
			<TabBar
				tabs={tabs}
				activeTabId={activeTabId}
				connectedIds={connectedIds}
				onSwitchTab={switchToTab}
				onCloseTab={handleCloseTab}
				onNewTab={openNewTab}
				onCloseOthers={closeOtherTabs}
				onCloseRight={closeTabsToRight}
				onDuplicateTab={duplicateTab}
				onReorderTabs={reorderTabs}
			/>
			<div className="flex-1 min-h-0 overflow-hidden bg-surface-2">{renderContent()}</div>
			{/* Destructive query confirmation dialog */}
			<AlertDialog
				open={!!pendingDangerSql}
				onOpenChange={(o) => {
					if (!o) {
						setPendingDangerSql(null);
						setDangerConfirmInput("");
					}
				}}
			>
				<AlertDialogContent className="max-w-lg">
					<AlertDialogHeader>
						<AlertDialogTitle>{isProductionConn ? "⚠️ Production database — confirm operation" : "Destructive query detected"}</AlertDialogTitle>
						<AlertDialogDescription asChild>
							<div>
								{isProductionConn && (
									<div className="mb-3 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-red-300">
										<div className="text-xs font-bold uppercase tracking-wider">Production write protection</div>
										<div className="mt-1 text-xs text-red-200/80">
											Connection: <span className="font-semibold text-red-100">{activeConnObj?.name ?? activeConnObj?.id ?? "Production"}</span>
											{activeTableDatabase ? <> · Database: <span className="font-mono text-red-100">{activeTableDatabase}</span></> : null}
										</div>
									</div>
								)}
								<span className="text-sm text-muted-foreground">
									{isProductionConn
										? "You are about to run a write operation on production. Review the SQL carefully before continuing."
										: "This query contains DELETE / DROP / TRUNCATE or an UPDATE without a WHERE clause."}
								</span>
								<pre className="mt-3 max-h-44 overflow-x-auto whitespace-pre-wrap break-all rounded bg-muted p-2 text-xs font-mono">{pendingDangerSql}</pre>
								{pendingDangerRequiresPhrase && (
									<div className="mt-3 space-y-1.5">
										<label className="text-xs font-medium text-foreground/80">
											Type <span className="font-mono font-bold text-foreground">{pendingDangerPhrase}</span> to confirm
										</label>
										<input
											value={dangerConfirmInput}
											onChange={(event) => setDangerConfirmInput(event.target.value)}
											className="h-8 w-full rounded border border-border bg-background px-2 font-mono text-xs text-foreground outline-none focus:ring-2 focus:ring-ring/50"
											placeholder={pendingDangerPhrase}
											autoFocus
										/>
									</div>
								)}
							</div>
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							disabled={!pendingDangerCanRun}
							onClick={(event) => {
								if (!pendingDangerCanRun) {
									event.preventDefault();
									return;
								}
								void confirmDangerSql();
							}}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{isProductionConn ? "Run on production" : "Run anyway"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
			<AlertDialog
				open={!!pendingTabCloseId}
				onOpenChange={(open) => !open && setPendingTabCloseId(null)}
			>
				<AlertDialogContent className="max-w-md">
					<AlertDialogHeader>
						<AlertDialogTitle>
							{pendingCloseReason === "unsaved-sql"
								? "Discard unsaved SQL?"
								: "Discard pending edits?"}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{pendingCloseReason === "unsaved-sql"
								? pendingCloseTab
									? `Closing "${pendingCloseTab.label}" will discard your unsaved SQL. Save it as a query first if you want to keep it.`
									: "Closing this tab will discard unsaved SQL."
								: pendingCloseTab
									? `Closing "${pendingCloseTab.label}" will discard ${pendingCloseTab.pendingEdits.length} queued change${pendingCloseTab.pendingEdits.length === 1 ? "" : "s"} that have not been applied.`
									: "Closing this tab will discard queued changes that have not been applied."}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={confirmDiscardTab}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							Discard and close
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
};
export default FunctionOutput;
