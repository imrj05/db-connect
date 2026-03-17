import { useCallback, useEffect, useMemo, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { sql } from "@codemirror/lang-sql";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";
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
  Key,
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
import { TableInfo, ConnectionFunction, TableStructure } from "@/types";
import { tauriApi } from "@/lib/tauri-api";

// ─── Idle state ────────────────────────────────────────────────────────────────
function IdleView({ onNewConnection }: { onNewConnection: () => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center bg-app-bg text-text-muted gap-4">
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
  database,
}: {
  fn: ConnectionFunction;
  queryResult?: { columns: string[]; rows: any[]; executionTimeMs: number };
  isLoading: boolean;
  onPageChange: (page: number) => void;
  page: number;
  database: string;
}) {
  const [viewMode, setViewMode] = useState<"data" | "structure">("data");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [structure, setStructure] = useState<TableStructure | null>(null);
  const [structureLoading, setStructureLoading] = useState(false);

  const loadStructure = useCallback(async () => {
    if (structure || !fn.tableName) return;
    setStructureLoading(true);
    try {
      const s = await tauriApi.getTableStructure(fn.connectionId, database, fn.tableName);
      setStructure(s);
    } catch {
      // ignore
    } finally {
      setStructureLoading(false);
    }
  }, [fn, database, structure]);

  const handleViewMode = (mode: "data" | "structure") => {
    setViewMode(mode);
    if (mode === "structure") loadStructure();
  };

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
        <span className={`${info.getValue() === null ? "text-text-null italic" : ""} font-medium`}>
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
      <div className="h-full flex items-center justify-center bg-app-bg">
        <Loader2 size={20} className="animate-spin text-blue-500" />
      </div>
    );
  }

  if (!queryResult) return null;

  // No columns at all means a DDL/non-SELECT result — show simple card
  if (queryResult.columns.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-emerald-500 bg-app-bg p-8 text-center">
        <div className="w-16 h-16 mb-6 bg-emerald-500/10 rounded-full flex items-center justify-center ring-1 ring-emerald-500/20">
          <Sparkles size={32} className="text-emerald-500/40" />
        </div>
        <h3 className="text-sm font-bold uppercase tracking-[0.2em] mb-2">Empty table</h3>
        <p className="text-[10px] text-text-muted uppercase tracking-widest opacity-60">
          0 rows · {queryResult.executionTimeMs}ms
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-tab-active-bg overflow-hidden">
      {/* Header */}
      <div className="h-9 px-4 flex items-center justify-between border-b border-border-table bg-tab-active-bg shrink-0">
        <span className="font-mono text-[11px] text-blue-400 font-bold">
          &gt; {fn.callSignature.slice(fn.prefix.length + 1)}
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

      {/* Content: Data view */}
      {viewMode === "data" && (
        <div className="flex-1 overflow-auto scrollbar-thin">
          <div className="min-w-full inline-block align-middle">
            <Table className="w-full border-collapse text-[11px] font-mono border-separate border-spacing-0">
              <TableHeader className="sticky top-0 z-10 bg-tab-active-bg shadow-[0_1px_0_var(--color-border-table)]">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="hover:bg-transparent border-none">
                    <TableHead className="w-10 h-8 px-2 text-center font-bold text-text-muted/30 border-r border-border-table bg-toolbar-bg">
                      #
                    </TableHead>
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className="h-8 px-4 text-left font-bold text-text-muted border-r border-border-table last:border-r-0 hover:bg-row-hover cursor-pointer transition-colors"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      colSpan={table.getAllColumns().length + 1}
                      className="h-24 text-center text-text-muted/40 text-[11px] font-mono"
                    >
                      0 rows
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map((row, idx) => (
                    <TableRow key={row.id} className="hover:bg-row-hover transition-colors group">
                      <TableCell className="w-10 h-8 px-2 text-center text-text-muted/30 border-r border-border-table bg-toolbar-bg/30">
                        {page * 50 + idx + 1}
                      </TableCell>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className="h-8 px-4 border-r border-border-table last:border-r-0 text-text-primary/90 whitespace-nowrap overflow-hidden text-ellipsis max-w-75"
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Content: Structure view */}
      {viewMode === "structure" && (
        <div className="flex-1 overflow-auto scrollbar-thin bg-app-bg">
          {structureLoading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 size={18} className="animate-spin text-blue-500" />
            </div>
          ) : structure ? (
            <div className="p-0">
              {/* Columns */}
              <div className="border-b border-border-table">
                <div className="px-4 py-2 bg-toolbar-bg flex items-center gap-2 border-b border-border-table">
                  <Key size={11} className="text-text-muted/50" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-text-muted/50">
                    Columns ({structure.columns.length})
                  </span>
                </div>
                <table className="w-full text-[11px] font-mono">
                  <thead className="sticky top-0 bg-tabbar-bg z-10">
                    <tr>
                      <th className="h-7 px-3 text-left text-[9px] font-bold uppercase tracking-widest text-text-muted/40 border-b border-border-table w-6">#</th>
                      <th className="h-7 px-3 text-left text-[9px] font-bold uppercase tracking-widest text-text-muted/40 border-b border-border-table">Name</th>
                      <th className="h-7 px-3 text-left text-[9px] font-bold uppercase tracking-widest text-text-muted/40 border-b border-border-table">Type</th>
                      <th className="h-7 px-3 text-left text-[9px] font-bold uppercase tracking-widest text-text-muted/40 border-b border-border-table">Null</th>
                      <th className="h-7 px-3 text-left text-[9px] font-bold uppercase tracking-widest text-text-muted/40 border-b border-border-table">Default</th>
                      <th className="h-7 px-3 text-left text-[9px] font-bold uppercase tracking-widest text-text-muted/40 border-b border-border-table">Key</th>
                      <th className="h-7 px-3 text-left text-[9px] font-bold uppercase tracking-widest text-text-muted/40 border-b border-border-table">Extra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {structure.columns.map((col, idx) => (
                      <tr key={col.name} className="hover:bg-row-alt transition-colors border-b border-border-table">
                        <td className="h-8 px-3 text-text-muted/30">{idx + 1}</td>
                        <td className="h-8 px-3 text-text-primary font-semibold">{col.name}</td>
                        <td className="h-8 px-3 text-amber-400/80">{col.dataType}</td>
                        <td className="h-8 px-3">
                          <span className={cn("text-[9px] font-bold uppercase", col.nullable ? "text-text-muted/40" : "text-red-400/70")}>
                            {col.nullable ? "YES" : "NO"}
                          </span>
                        </td>
                        <td className="h-8 px-3 text-text-muted/50 italic">
                          {col.defaultValue ?? <span className="text-text-muted/25 not-italic">—</span>}
                        </td>
                        <td className="h-8 px-3">
                          <div className="flex items-center gap-1">
                            {col.isPrimary && (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/20">
                                PK
                              </span>
                            )}
                            {col.isUnique && !col.isPrimary && (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-violet-500/15 text-violet-400 border border-violet-500/20">
                                UNI
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="h-8 px-3 text-text-muted/40 italic text-[10px]">
                          {col.extra ?? <span className="text-text-muted/20 not-italic">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Indexes */}
              {structure.indexes.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-toolbar-bg flex items-center gap-2 border-b border-border-table">
                    <Hash size={11} className="text-text-muted/50" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-text-muted/50">
                      Indexes ({structure.indexes.length})
                    </span>
                  </div>
                  <table className="w-full text-[11px] font-mono">
                    <thead className="sticky top-0 bg-tabbar-bg">
                      <tr>
                        <th className="h-7 px-3 text-left text-[9px] font-bold uppercase tracking-widest text-text-muted/40 border-b border-border-table">Name</th>
                        <th className="h-7 px-3 text-left text-[9px] font-bold uppercase tracking-widest text-text-muted/40 border-b border-border-table">Columns</th>
                        <th className="h-7 px-3 text-left text-[9px] font-bold uppercase tracking-widest text-text-muted/40 border-b border-border-table">Type</th>
                        <th className="h-7 px-3 text-left text-[9px] font-bold uppercase tracking-widest text-text-muted/40 border-b border-border-table">Unique</th>
                      </tr>
                    </thead>
                    <tbody>
                      {structure.indexes.map((idx) => (
                        <tr key={idx.name} className="hover:bg-row-alt transition-colors border-b border-border-table">
                          <td className="h-8 px-3 text-blue-400/80">{idx.name}</td>
                          <td className="h-8 px-3 text-text-primary/80">
                            <div className="flex flex-wrap gap-1">
                              {idx.columns.map((c) => (
                                <span key={c} className="px-1.5 py-0.5 bg-toolbar-bg rounded text-[9px]">{c}</span>
                              ))}
                            </div>
                          </td>
                          <td className="h-8 px-3 text-text-muted/50 uppercase text-[9px]">{idx.indexType ?? "—"}</td>
                          <td className="h-8 px-3">
                            {idx.unique ? (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">YES</span>
                            ) : (
                              <span className="text-text-muted/30 text-[9px]">NO</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-text-muted/30 text-[11px] font-mono">
              No structure data
            </div>
          )}
        </div>
      )}

      {/* Footer toolbar */}
      <div className="h-9 bg-toolbar-bg border-t border-border-table flex items-center justify-between px-2 shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleViewMode("data")}
            className={cn(
              "px-3 h-6 rounded text-[10px] font-bold uppercase tracking-widest transition-all",
              viewMode === "data" ? "bg-sidebar-item-hover text-white" : "text-text-muted hover:text-white",
            )}
          >
            Data
          </button>
          <button
            onClick={() => handleViewMode("structure")}
            className={cn(
              "px-3 h-6 rounded text-[10px] font-bold uppercase tracking-widest transition-all",
              viewMode === "structure" ? "bg-sidebar-item-hover text-white" : "text-text-muted hover:text-white",
            )}
          >
            Structure
          </button>
        </div>
        {viewMode === "data" && (
          <>
            <div className="flex items-center gap-4 text-[10px] font-mono text-text-muted/60">
              <button
                disabled={page === 0}
                onClick={() => onPageChange(page - 1)}
                className="px-2 h-6 rounded text-text-muted hover:text-white disabled:opacity-30 text-[10px] font-bold uppercase tracking-widest"
              >
                ← Prev
              </button>
              <span className="tabular-nums">
                {queryResult.rows.length === 0 ? "0 rows" : `${page * 50 + 1}–${page * 50 + queryResult.rows.length}`}
              </span>
              <button
                disabled={queryResult.rows.length < 50}
                onClick={() => onPageChange(page + 1)}
                className="px-2 h-6 rounded text-text-muted hover:text-white disabled:opacity-30 text-[10px] font-bold uppercase tracking-widest"
              >
                Next →
              </button>
            </div>
            <button className="px-3 h-6 rounded bg-toolbar-bg text-text-muted hover:text-white text-[10px] font-bold uppercase tracking-widest">
              <Download size={10} className="inline mr-1" />
              Export
            </button>
          </>
        )}
        {viewMode === "structure" && (
          <span className="text-[9px] font-mono text-text-muted/30">
            {structure ? `${structure.columns.length} columns · ${structure.indexes.length} indexes` : ""}
          </span>
        )}
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

  const { theme } = useAppStore();
  const editorTheme = theme === "dark" ? oneDark : EditorView.theme({
    "&": { backgroundColor: "var(--color-table-bg)", color: "var(--color-text-primary)" },
    ".cm-gutters": { backgroundColor: "var(--color-toolbar-bg)", color: "var(--color-text-muted)", borderRight: "1px solid var(--color-border-table)" },
    ".cm-activeLineGutter": { backgroundColor: "var(--color-row-hover)" },
    ".cm-activeLine": { backgroundColor: "var(--color-row-hover)" },
    ".cm-cursor": { borderLeftColor: "var(--color-text-primary)" },
    ".cm-selectionBackground": { backgroundColor: "var(--color-row-selected) !important" },
  });

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
    <div className="h-full flex flex-col bg-app-bg overflow-hidden">
      {/* Header */}
      <div className="h-9 flex items-center justify-between bg-tab-active-bg border-b border-border-table px-4 shrink-0">
        <span className="font-mono text-[11px] text-blue-400 font-bold">
          &gt; {fn.callSignature.slice(fn.prefix.length + 1)}
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
            theme={editorTheme}
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
          <kbd className="px-1.5 h-5 rounded border border-white/10 bg-tab-active-bg/80 backdrop-blur-sm text-[9px] font-mono text-text-muted/60 flex items-center gap-1">
            ⌘<span>↵</span>
          </kbd>
        </div>
      </div>

      {/* Execute bar */}
      <div className="h-10 bg-app-bg border-t border-border-table flex items-center justify-between px-3 shrink-0 select-none">
        <button
          onClick={onExecute}
          disabled={isLoading || !pendingSql.trim()}
          className={cn(
            "group h-7 px-4 rounded flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] transition-all",
            isLoading || !pendingSql.trim()
              ? "bg-toolbar-bg text-text-muted cursor-not-allowed"
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
          className="border-t border-border-table overflow-auto scrollbar-thin"
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
              <TableHeader className="sticky top-0 z-10 bg-tab-active-bg">
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id} className="hover:bg-transparent border-none">
                    {hg.headers.map((h) => (
                      <TableHead
                        key={h.id}
                        className="h-8 px-4 text-left font-bold text-text-muted border-r border-border-table last:border-r-0"
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
                        className="h-8 px-4 border-r border-border-table last:border-r-0 text-text-primary/90 whitespace-nowrap overflow-hidden text-ellipsis max-w-75"
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="h-8 bg-toolbar-bg border-t border-border-table flex items-center px-4 shrink-0">
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
    <div className="h-full flex flex-col bg-tab-active-bg overflow-hidden">
      <div className="h-9 px-4 flex items-center border-b border-border-table shrink-0">
        <span className="font-mono text-[11px] text-blue-400 font-bold">
          &gt; {fn.callSignature.slice(fn.prefix.length + 1)}
        </span>
        <span className="ml-auto text-[10px] font-mono text-text-muted/40">
          {tables.length} tables
        </span>
      </div>
      <div className="flex-1 overflow-auto scrollbar-thin">
        <table className="w-full text-[11px] font-mono">
          <thead className="sticky top-0 bg-toolbar-bg">
            <tr>
              <th className="h-8 px-4 text-left font-bold text-text-muted border-b border-border-table">Table</th>
              <th className="h-8 px-4 text-left font-bold text-text-muted border-b border-border-table">Schema / DB</th>
            </tr>
          </thead>
          <tbody>
            {tables.map((t) => (
              <tr
                key={`${t.schema}-${t.name}`}
                onClick={() => onTableClick(t.name)}
                className="hover:bg-blue-500/10 cursor-pointer transition-colors border-b border-border-table group"
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
    <div className="h-full flex flex-col bg-app-bg overflow-hidden">
      <div className="h-9 px-4 flex items-center border-b border-border-table shrink-0">
        <span className="font-mono text-[11px] text-blue-400 font-bold">
          &gt; {fn.callSignature.slice(fn.prefix.length + 1)}
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
            <div className="bg-tab-active-bg rounded-xl p-4 border border-border-table">
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
    <div className="bg-toolbar-bg rounded-xl p-3 border border-border-table flex flex-col gap-1.5">
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
    connectionTables,
    connections,
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

  const activeTableDatabase = useMemo(() => {
    if (!activeFunction?.tableName) return "default";
    const tables = connectionTables[activeFunction.connectionId] ?? [];
    const tableInfo = tables.find((t) => t.name === activeFunction.tableName);
    return (
      tableInfo?.schema ??
      connections.find((c) => c.id === activeFunction.connectionId)?.database ??
      "default"
    );
  }, [activeFunction, connectionTables, connections]);

  const outputType = invocationResult?.outputType ?? "idle";

  // Show loader first — before the idle check — so switching tables/databases
  // shows a spinner instead of flickering through the "No function selected" screen.
  if (isLoading || invocationResult?.isLoading) {
    const label = activeFunction
      ? activeFunction.callSignature.slice(activeFunction.prefix.length + 1)
      : "";
    return (
      <div className="h-full flex items-center justify-center bg-app-bg">
        <div className="text-center space-y-3">
          <Loader2 size={24} className="animate-spin text-blue-500 mx-auto" />
          {label && (
            <p className="text-[10px] font-mono text-text-muted/60 uppercase tracking-widest">
              {label}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (outputType === "idle" || !invocationResult || !activeFunction) {
    return <IdleView onNewConnection={() => setConnectionDialogOpen(true)} />;
  }

  if (invocationResult.error) {
    return (
      <div className="h-full flex items-center justify-center bg-app-bg p-8">
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
          database={activeTableDatabase}
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
