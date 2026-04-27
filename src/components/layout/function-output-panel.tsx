import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Copy, Check, ChevronDown, ChevronRight, Sparkles } from "lucide-react";
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

function isDestructive(sql: string): boolean {
	if (/\b(DELETE|DROP|TRUNCATE)\b/i.test(sql.trim())) return true;
	// UPDATE without WHERE is also destructive
	if (/\bUPDATE\b/i.test(sql) && !/\bWHERE\b/i.test(sql)) return true;
	return false;
}

function buildExplainSql(sql: string): string {
	const trimmed = sql.trim().replace(/;+\s*$/, "");
	return /^EXPLAIN\b/i.test(trimmed) ? trimmed : `EXPLAIN ${trimmed}`;
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
		connectedIds,
		appSettings,
		showConnectionsManager,
		setShowConnectionsManager,
		setActiveView,
	} = useAppStore();
	const activeConnObj = useMemo(() => { const connId = activeFunction?.connectionId; return connId ? connections.find((c) => c.id === connId) ?? null : null; }, [activeFunction, connections]);
	const isProductionConn = useMemo(() => !!(activeConnObj?.group?.toLowerCase().includes("prod")), [activeConnObj]);
	const [page, setPage] = useState(0);
	const [pendingDangerSql, setPendingDangerSql] = useState<string | null>(null);
	const [pendingTabCloseId, setPendingTabCloseId] = useState<string | null>(null);
	const [askAiFixError, setAskAiFixError] = useState<string | null>(null);
	const [errorCopied, setErrorCopied] = useState(false);
	const [errorExpanded, setErrorExpanded] = useState(false);
	useEffect(() => {
		setPage(0);
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
		const isProdWrite = isProductionConn && /\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|REPLACE)\b/i.test(sql);
		if (isDestructive(sql) || isProdWrite) { setPendingDangerSql(sql); return; }
		// Detect multiple statements
		const stmts = sql.split(/;/).map((s) => s.replace(/--[^\n]*/g, "").trim()).filter(Boolean);
		if (stmts.length > 1) {
			await runMultiStatementSql(activeFunction, sql);
		} else {
			await invokeFunction(activeFunction, { sql });
		}
	}, [activeFunction, pendingSqlValue, invokeFunction, runMultiStatementSql, isProductionConn]);
	const confirmDangerSql = useCallback(async () => {
		if (!pendingDangerSql || !activeFunction) return;
		const sql = pendingDangerSql;
		setPendingDangerSql(null);
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
			await invokeFunction(activeFunction, { page: newPage });
		},
		[activeFunction, invokeFunction],
	);
	const handleTableClick = useCallback(
		async (tableName: string) => {
			if (!invocationResult) return;
			const allFns = Object.values(connectionFunctions).flatMap((dbMap) => Object.values(dbMap).flat());
			const tableFn = allFns.find(
				(fn) =>
					fn.type === "table" &&
					fn.connectionId === invocationResult.fn.connectionId &&
					fn.tableName === tableName,
			);
			if (tableFn) await invokeFunction(tableFn);
		},
		[invocationResult, connectionFunctions, invokeFunction],
	);
	const handleCloseTab = useCallback(
		(tabId: string) => {
			const tab = tabs.find((candidate) => candidate.id === tabId);
			if ((tab?.pendingEdits.length ?? 0) > 0) {
				setPendingTabCloseId(tabId);
				return;
			}
			closeTab(tabId);
		},
		[tabs, closeTab],
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
	const activeTableDatabase = useMemo(() => {
		if (!activeFunction?.tableName) return "default";
		const tables = Object.values(connectionTables[activeFunction.connectionId] ?? {}).flat();
		const tableInfo = tables.find((t) => t.name === activeFunction.tableName);
		return (
			tableInfo?.schema ??
			connections.find((c) => c.id === activeFunction.connectionId)
				?.database ??
			"default"
		);
	}, [activeFunction, connectionTables, connections]);
	// ── Content renderer ──
	const renderContent = () => {
		const openNewConnectionPage = () => {
			setShowConnectionsManager(false);
			setActiveView("new-connection");
		};

		const outputType = invocationResult?.outputType ?? "idle";
		if (isLoading || invocationResult?.isLoading) {
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
			const handleCopyError = () => {
				navigator.clipboard.writeText(errorText).then(() => {
					setErrorCopied(true);
					setTimeout(() => setErrorCopied(false), 2000);
				});
			};
			const handleAskAi = () => {
				clearInvocationError();
				setTimeout(() => {
					setAskAiFixError(errorText);
				}, 0);
			};
			return (
				<div className="h-full flex items-center justify-center bg-background p-8">
					<div className="max-w-lg w-full bg-destructive/5 border border-destructive/20 rounded-lg overflow-hidden">
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
									onClick={handleCopyError}
									className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-destructive/70 hover:bg-destructive/10 hover:text-destructive transition-colors"
								>
									{errorCopied ? <Check size={10} /> : <Copy size={10} />}
									{errorCopied ? "Copied" : "Copy"}
								</button>
								{(activeFunction?.type === "query" || activeFunction?.type === "execute") && (
									<button
										onClick={handleAskAi}
										className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-accent-blue/80 hover:bg-accent-blue/10 hover:text-accent-blue transition-colors"
									>
										<Sparkles size={10} />Ask AI to fix
									</button>
								)}
							</div>
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
						onNewConnection={openNewConnectionPage}
						onEdit={(conn) => {
							setEditingConnection(conn);
							setConnectionDialogOpen(true);
						}}
						onConnect={(id) => {
							setShowConnectionsManager(false);
							connectAndInit(id);
						}}
						onDisconnect={(id) => disconnectConnection(id)}
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
						page={page}
						database={activeTableDatabase}
						pageSize={appSettings.tablePageSize}
					/>
				);
			case "sql-editor":
				return (
					<SqlEditorView
						fn={activeFunction}
						queryResult={invocationResult.queryResult}
						isLoading={false}
						pendingSql={pendingSqlValue}
						onSqlChange={setPendingSql}
						onExecute={handleExecuteSql}
						onExplain={handleExplainSql}
						tables={Object.values(connectionTables[activeFunction.connectionId] ?? {}).flat()}
						askAiFixError={askAiFixError}
						onAskAiFixConsumed={() => setAskAiFixError(null)}
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
				onOpenChange={(o) => !o && setPendingDangerSql(null)}
			>
				<AlertDialogContent className="max-w-md">
					<AlertDialogHeader>
						<AlertDialogTitle>{isProductionConn ? "⚠️ Production database — confirm operation" : "Destructive query detected"}</AlertDialogTitle>
						<AlertDialogDescription asChild>
							<div>
								{isProductionConn && (
									<div className="mb-2 flex items-center gap-2 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-red-400 text-xs font-semibold">
										⚠️ You are connected to a PRODUCTION database. This cannot be undone.
									</div>
								)}
								<span className="text-sm text-muted-foreground">{isProductionConn ? "This write operation will affect your production data. Double-check before running." : "This query contains DELETE / DROP / TRUNCATE or an UPDATE without a WHERE clause."}</span>
								<pre className="mt-2 rounded bg-muted p-2 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all max-h-40">{pendingDangerSql}</pre>
							</div>
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={confirmDangerSql}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							Run anyway
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
						<AlertDialogTitle>Discard pending edits?</AlertDialogTitle>
						<AlertDialogDescription>
							{pendingCloseTab
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
