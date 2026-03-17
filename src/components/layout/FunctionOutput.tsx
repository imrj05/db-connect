import { useCallback, useEffect, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { sql } from "@codemirror/lang-sql";
import { oneDark } from "@codemirror/theme-one-dark";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
} from "@tanstack/react-table";
import {
  Play,
  Loader2,
  Search,
  Sparkles,
  Download,
  Database,
  Server,
  Lock,
  Hash,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableInfo, ConnectionFunction } from "@/types";

// ─── Idle state ────────────────────────────────────────────────────────────────
function IdleView({ onNewConnection }: { onNewConnection: () => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center bg-[#0c0c0c] text-text-muted gap-4">
      <div className="w-16 h-16 opacity-10 bg-blue-500/10 rounded-2xl flex items-center justify-center">
        <Search size={32} className="text-blue-500/20" />
      </div>
      <div className="text-center space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest text-text-muted">
          No function selected
        </p>
        <p className="text-[10px] text-text-muted/60">
          Click a function in the sidebar or press ⌘K to search
        </p>
      </div>
      <button
        onClick={onNewConnection}
        className="mt-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs transition-all active:scale-95"
      >
        Add Connection
      </button>
    </div>
  );
}

// ─── Table grid (for _tbl / per-table functions) ────────────────────────────────
function TableGridView({
  fn,
  queryResult,
  isLoading,
  onPageChange,
  page,
}: {
  fn: ConnectionFunction;
  queryResult?: { columns: string[]; rows: any[]; executionTimeMs: number };
  isLoading: boolean;
  onPageChange: (page: number) => void;
  page: number;
}) {
  const [viewMode, setViewMode] = useState<"data" | "structure">("data");
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data: queryResult?.rows ?? [],
    columns: (
      queryResult?.columns && queryResult.columns.length > 0
        ? queryResult.columns
        : queryResult?.rows && queryResult.rows.length > 0
          ? Object.keys(queryResult.rows[0])
          : []
    ).map((col: string) => ({
      accessorKey: col,
      header: col,
      cell: (info: any) => (
        <span
          className={`${info.getValue() === null ? "text-text-null italic" : ""} font-medium`}
        >
          {info.getValue() === null ? "null" : String(info.getValue())}
        </span>
      ),
    })),
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0c0c0c]">
        <Loader2 size={20} className="animate-spin text-blue-500" />
      </div>
    );
  }

  if (!queryResult) return null;

  if (queryResult.rows.length === 0 && queryResult.columns.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-emerald-500 bg-table-bg p-8 text-center">
        <div className="w-16 h-16 mb-6 bg-emerald-500/10 rounded-full flex items-center justify-center ring-1 ring-emerald-500/20">
          <Sparkles size={32} className="text-emerald-500/40" />
        </div>
        <h3 className="text-sm font-bold uppercase tracking-[0.2em] mb-2">
          Empty result
        </h3>
        <p className="text-[10px] text-text-muted uppercase tracking-widest opacity-60">
          0 rows · {queryResult.executionTimeMs}ms
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#111111] overflow-hidden">
      {/* Header */}
      <div className="h-9 px-4 flex items-center justify-between border-b border-white/5 bg-[#111111] shrink-0">
        <span className="font-mono text-[11px] text-blue-400 font-bold">
          &gt; {fn.callSignature}
        </span>
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-mono text-text-muted/40 mr-2">
            {queryResult.executionTimeMs}ms
          </span>
          <button className="size-6 flex items-center justify-center text-text-muted hover:text-white transition-colors">
            <Download size={12} />
          </button>
        </div>
      </div>
      {/* Table */}
      <div className="flex-1 overflow-auto scrollbar-thin">
        <div className="min-w-full inline-block align-middle">
          <Table className="w-full border-collapse text-[11px] font-mono border-separate border-spacing-0">
            <TableHeader className="sticky top-0 z-10 bg-[#111111] shadow-[0_1px_0_rgba(255,255,255,0.05)]">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow
                  key={headerGroup.id}
                  className="hover:bg-transparent border-none"
                >
                  <TableHead className="w-10 h-8 px-2 text-center font-bold text-text-muted/30 border-r border-white/5 bg-[#181818]">
                    #
                  </TableHead>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="h-8 px-4 text-left font-bold text-text-muted border-r border-white/5 last:border-r-0 hover:bg-white/5 cursor-pointer transition-colors"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row, idx) => (
                <TableRow
                  key={row.id}
                  className="hover:bg-blue-500/5 transition-colors group"
                >
                  <TableCell className="w-10 h-8 px-2 text-center text-text-muted/30 border-r border-white/5 bg-[#181818]/30">
                    {page * 50 + idx + 1}
                  </TableCell>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className="h-8 px-4 border-r border-white/5 last:border-r-0 text-text-primary/90 whitespace-nowrap overflow-hidden text-ellipsis max-w-75"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      {/* Footer toolbar */}
      <div className="h-9 bg-[#181818] border-t border-white/5 flex items-center justify-between px-2 shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode("data")}
            className={cn(
              "px-3 h-6 rounded text-[10px] font-bold uppercase tracking-widest transition-all",
              viewMode === "data"
                ? "bg-white/10 text-white"
                : "text-text-muted hover:text-white",
            )}
          >
            Data
          </button>
          <button
            onClick={() => setViewMode("structure")}
            className={cn(
              "px-3 h-6 rounded text-[10px] font-bold uppercase tracking-widest transition-all",
              viewMode === "structure"
                ? "bg-white/10 text-white"
                : "text-text-muted hover:text-white",
            )}
          >
            Structure
          </button>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-mono text-text-muted/60">
          <button
            disabled={page === 0}
            onClick={() => onPageChange(page - 1)}
            className="px-2 h-6 rounded text-text-muted hover:text-white disabled:opacity-30 text-[10px] font-bold uppercase tracking-widest"
          >
            ← Prev
          </button>
          <span className="tabular-nums">
            {page * 50 + 1}–{page * 50 + queryResult.rows.length}
          </span>
          <button
            disabled={queryResult.rows.length < 50}
            onClick={() => onPageChange(page + 1)}
            className="px-2 h-6 rounded text-text-muted hover:text-white disabled:opacity-30 text-[10px] font-bold uppercase tracking-widest"
          >
            Next →
          </button>
        </div>
        <button className="px-3 h-6 rounded bg-white/5 text-text-muted hover:text-white text-[10px] font-bold uppercase tracking-widest">
          <Download size={10} className="inline mr-1" />
          Export
        </button>
      </div>
    </div>
  );
}

// ─── SQL editor (for _query / _execute functions) ─────────────────────────────
function SqlEditorView({
  fn,
  queryResult,
  isLoading,
  pendingSql,
  onSqlChange,
  onExecute,
}: {
  fn: ConnectionFunction;
  queryResult?: { columns: string[]; rows: any[]; executionTimeMs: number };
  isLoading: boolean;
  pendingSql: string;
  onSqlChange: (sql: string) => void;
  onExecute: () => void;
}) {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onExecute();
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [onExecute]);

  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useReactTable({
    data: queryResult?.rows ?? [],
    columns: (
      queryResult?.columns && queryResult.columns.length > 0
        ? queryResult.columns
        : queryResult?.rows && queryResult.rows.length > 0
          ? Object.keys(queryResult.rows[0])
          : []
    ).map((col: string) => ({
      accessorKey: col,
      header: col,
      cell: (info: any) => (
        <span className={info.getValue() === null ? "text-text-null italic" : ""}>
          {info.getValue() === null ? "null" : String(info.getValue())}
        </span>
      ),
    })),
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="h-full flex flex-col bg-[#0A0A0A] overflow-hidden">
      {/* Header */}
      <div className="h-9 flex items-center justify-between bg-[#111111] border-b border-white/5 px-4 shrink-0">
        <span className="font-mono text-[11px] text-blue-400 font-bold">
          &gt; {fn.callSignature}
        </span>
        <span className="text-[9px] font-mono text-text-muted/30 uppercase tracking-widest">
          {fn.type === "execute" ? "DDL / DML" : "SELECT"}
        </span>
      </div>

      {/* Editor area */}
      <div className="flex-1 relative group min-h-0" style={{ maxHeight: queryResult ? "40%" : "100%" }}>
        <div className="absolute inset-0 scrollbar-thin">
          <CodeMirror
            value={pendingSql}
            height="100%"
            theme={oneDark}
            extensions={[sql()]}
            onChange={onSqlChange}
            className="text-[13px] h-full selection:bg-blue-500/30"
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
          <kbd className="px-1.5 h-5 rounded border border-white/10 bg-[#111111]/80 backdrop-blur-sm text-[9px] font-mono text-text-muted/60 flex items-center gap-1">
            ⌘<span>↵</span>
          </kbd>
        </div>
      </div>

      {/* Execute bar */}
      <div className="h-10 bg-[#0F0F0F] border-t border-white/5 flex items-center justify-between px-3 shrink-0 select-none">
        <button
          onClick={onExecute}
          disabled={isLoading || !pendingSql.trim()}
          className={cn(
            "group h-7 px-4 rounded flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] transition-all",
            isLoading || !pendingSql.trim()
              ? "bg-white/5 text-text-muted cursor-not-allowed"
              : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 active:scale-95",
          )}
        >
          {isLoading ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Play size={11} className="fill-current" />
          )}
          Execute
        </button>
      </div>

      {/* Results (shown below editor if present) */}
      {queryResult && (
        <div
          className="border-t border-white/5 overflow-auto scrollbar-thin"
          style={{ flex: "1 1 60%" }}
        >
          {queryResult.rows.length === 0 && queryResult.columns.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-emerald-500 p-8 text-center">
              <Sparkles size={24} className="mb-3 text-emerald-500/40" />
              <p className="text-xs font-bold uppercase tracking-widest">
                Executed successfully · {queryResult.executionTimeMs}ms
              </p>
            </div>
          ) : (
            <Table className="w-full text-[11px] font-mono border-collapse">
              <TableHeader className="sticky top-0 z-10 bg-[#111111]">
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id} className="hover:bg-transparent border-none">
                    {hg.headers.map((h) => (
                      <TableHead
                        key={h.id}
                        className="h-8 px-4 text-left font-bold text-text-muted border-r border-white/5 last:border-r-0"
                        onClick={h.column.getToggleSortingHandler()}
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} className="hover:bg-blue-500/5 transition-colors">
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className="h-8 px-4 border-r border-white/5 last:border-r-0 text-text-primary/90 whitespace-nowrap overflow-hidden text-ellipsis max-w-75"
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="h-8 bg-[#181818] border-t border-white/5 flex items-center px-4 shrink-0">
            <span className="text-[10px] font-mono text-text-muted/40">
              {queryResult.rows.length} rows · {queryResult.executionTimeMs}ms
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Table list (for _list function) ──────────────────────────────────────────
function TableListView({
  fn,
  tables,
  onTableClick,
}: {
  fn: ConnectionFunction;
  tables: TableInfo[];
  onTableClick: (tableName: string) => void;
}) {
  return (
    <div className="h-full flex flex-col bg-[#111111] overflow-hidden">
      <div className="h-9 px-4 flex items-center border-b border-white/5 shrink-0">
        <span className="font-mono text-[11px] text-blue-400 font-bold">
          &gt; {fn.callSignature}
        </span>
        <span className="ml-auto text-[10px] font-mono text-text-muted/40">
          {tables.length} tables
        </span>
      </div>
      <div className="flex-1 overflow-auto scrollbar-thin">
        <table className="w-full text-[11px] font-mono">
          <thead className="sticky top-0 bg-[#181818]">
            <tr>
              <th className="h-8 px-4 text-left font-bold text-text-muted border-b border-white/5">Table</th>
              <th className="h-8 px-4 text-left font-bold text-text-muted border-b border-white/5">Schema / DB</th>
            </tr>
          </thead>
          <tbody>
            {tables.map((t) => (
              <tr
                key={`${t.schema}-${t.name}`}
                onClick={() => onTableClick(t.name)}
                className="hover:bg-blue-500/10 cursor-pointer transition-colors border-b border-white/5 group"
              >
                <td className="h-8 px-4 text-text-primary/90">
                  <div className="flex items-center gap-2">
                    <Database size={11} className="text-blue-400/50 shrink-0" />
                    <span className="group-hover:text-blue-400 transition-colors">{t.name}</span>
                  </div>
                </td>
                <td className="h-8 px-4 text-text-muted/50">{t.schema ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Connection source info (for _src function) ────────────────────────────────
function ConnectionSrcView({
  fn,
  info,
}: {
  fn: ConnectionFunction;
  info: { connectionId: string; name: string; prefix: string; type: string; host?: string; port?: number; database?: string; ssl?: boolean; tableCount: number };
}) {
  return (
    <div className="h-full flex flex-col bg-[#0c0c0c] overflow-hidden">
      <div className="h-9 px-4 flex items-center border-b border-white/5 shrink-0">
        <span className="font-mono text-[11px] text-blue-400 font-bold">
          &gt; {fn.callSignature}
        </span>
      </div>
      <div className="flex-1 p-8 flex items-start justify-center">
        <div className="w-full max-w-lg space-y-4">
          {/* Connection name + type badge */}
          <div className="flex items-center gap-3">
            <div className="size-10 bg-blue-600 rounded-xl flex items-center justify-center font-bold text-white text-[11px] shrink-0">
              {info.type.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary tracking-tight">{info.name}</h2>
              <p className="text-[10px] font-mono text-text-muted/60 uppercase tracking-widest">{info.type}</p>
            </div>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <InfoCard icon={<Hash size={14} />} label="Prefix" value={`${info.prefix}_`} mono />
            <InfoCard icon={<Database size={14} />} label="Tables" value={String(info.tableCount)} />
            {info.host && <InfoCard icon={<Server size={14} />} label="Host" value={`${info.host}:${info.port ?? ''}`} mono />}
            {info.database && <InfoCard icon={<Database size={14} />} label="Database" value={info.database} mono />}
            <InfoCard
              icon={<Lock size={14} />}
              label="SSL"
              value={info.ssl ? "Enabled" : "Disabled"}
              accent={info.ssl ? "emerald" : "zinc"}
            />
          </div>

          {/* Generated functions preview */}
          <div className="pt-2">
            <p className="text-[9px] font-bold uppercase tracking-widest text-text-muted/40 mb-2">Generated Functions</p>
            <div className="bg-[#111111] rounded-xl p-4 border border-white/5">
              <div className="flex flex-col gap-1">
                {[
                  `${info.prefix}_list()`,
                  `${info.prefix}_src()`,
                  `${info.prefix}_query(sql)`,
                  `${info.prefix}_execute(sql)`,
                  `${info.prefix}_tbl(table)`,
                  `${info.prefix}_tableName() × ${info.tableCount}`,
                ].map((fn) => (
                  <span key={fn} className="text-[11px] font-mono text-text-muted/60">{fn}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoCard({
  icon,
  label,
  value,
  mono = false,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
  accent?: "emerald" | "zinc";
}) {
  return (
    <div className="bg-[#181818] rounded-xl p-3 border border-white/5 flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-text-muted/50">
        {icon}
        <span className="text-[9px] font-bold uppercase tracking-widest">{label}</span>
      </div>
      <span
        className={cn(
          "text-[12px] font-semibold",
          mono ? "font-mono" : "",
          accent === "emerald" ? "text-emerald-400" : accent === "zinc" ? "text-zinc-500" : "text-text-primary",
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Main FunctionOutput component ────────────────────────────────────────────
const FunctionOutput = () => {
  const {
    invocationResult,
    activeFunction,
    pendingSqlValue,
    setPendingSql,
    invokeFunction,
    connectionFunctions,
    setConnectionDialogOpen,
    isLoading,
  } = useAppStore();

  const [page, setPage] = useState(0);

  // Reset page when active function changes
  useEffect(() => {
    setPage(0);
  }, [activeFunction?.id]);

  const handleExecuteSql = useCallback(async () => {
    if (!activeFunction || !pendingSqlValue.trim()) return;
    await invokeFunction(activeFunction, { sql: pendingSqlValue });
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
      // Find the per-table function for this table
      const allFns = Object.values(connectionFunctions).flat();
      const tableFn = allFns.find(
        (fn) =>
          fn.type === "table" &&
          fn.connectionId === invocationResult.fn.connectionId &&
          fn.tableName === tableName,
      );
      if (tableFn) {
        await invokeFunction(tableFn);
      }
    },
    [invocationResult, connectionFunctions, invokeFunction],
  );

  const outputType = invocationResult?.outputType ?? "idle";

  if (outputType === "idle" || !invocationResult || !activeFunction) {
    return <IdleView onNewConnection={() => setConnectionDialogOpen(true)} />;
  }

  if (invocationResult.isLoading || isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0c0c0c]">
        <div className="text-center space-y-3">
          <Loader2 size={24} className="animate-spin text-blue-500 mx-auto" />
          <p className="text-[10px] font-mono text-text-muted/60 uppercase tracking-widest">
            {activeFunction.callSignature}
          </p>
        </div>
      </div>
    );
  }

  if (invocationResult.error) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0c0c0c] p-8">
        <div className="max-w-lg w-full bg-red-500/5 border border-red-500/20 rounded-xl p-6">
          <p className="text-[10px] font-bold uppercase tracking-widest text-red-400 mb-2">Error</p>
          <p className="text-xs font-mono text-red-300/80">{invocationResult.error}</p>
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
      return <IdleView onNewConnection={() => setConnectionDialogOpen(true)} />;
  }
};

export default FunctionOutput;
