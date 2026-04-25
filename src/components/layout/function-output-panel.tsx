import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
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
	return /\b(DELETE|DROP|TRUNCATE)\b/i.test(sql.trim());
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
		switchToTab,
		clearPendingCellEdits,
		connectedIds,
		appSettings,
		showConnectionsManager,
		setShowConnectionsManager,
		setActiveView,
	} = useAppStore();
	const [page, setPage] = useState(0);
	const [pendingDangerSql, setPendingDangerSql] = useState<string | null>(null);
	const [pendingTabCloseId, setPendingTabCloseId] = useState<string | null>(null);
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
	const handleExecuteSql = useCallback(async () => {
		if (!activeFunction || !pendingSqlValue.trim()) return;
		if (isDestructive(pendingSqlValue)) {
			setPendingDangerSql(pendingSqlValue.trim());
			return;
		}
		await invokeFunction(activeFunction, { sql: pendingSqlValue });
	}, [activeFunction, pendingSqlValue, invokeFunction]);
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
			const allFns = Object.values(connectionFunctions).flat();
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
		const tables = connectionTables[activeFunction.connectionId] ?? [];
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
				<div className="h-full flex items-center justify-center bg-background">
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
		if (invocationResult.error) {
			return (
				<div className="h-full flex items-center justify-center bg-background p-8">
					<div className="max-w-lg w-full bg-destructive/5 border border-destructive/20 rounded-lg p-6">
						<p className="text-[10px] font-bold uppercase tracking-widest text-destructive mb-2">
							Error
						</p>
						<p className="text-xs font-mono text-destructive/80">
							{invocationResult.error}
						</p>
					</div>
				</div>
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
						tables={connectionTables[activeFunction.connectionId] ?? []}
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
			/>
			<div className="flex-1 min-h-0 overflow-hidden bg-surface-2">{renderContent()}</div>
			{/* Destructive query confirmation dialog */}
			<AlertDialog
				open={!!pendingDangerSql}
				onOpenChange={(o) => !o && setPendingDangerSql(null)}
			>
				<AlertDialogContent className="max-w-md">
					<AlertDialogHeader>
						<AlertDialogTitle>Destructive query detected</AlertDialogTitle>
						<AlertDialogDescription>
							This query contains a destructive operation (DELETE / DROP /
							TRUNCATE). Review carefully before running.
							<pre className="mt-2 rounded bg-muted p-2 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all max-h-40">
								{pendingDangerSql}
							</pre>
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
