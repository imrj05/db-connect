import { useState } from "react";
import {
    flexRender,
    getCoreRowModel,
    useReactTable,
    getSortedRowModel,
    SortingState,
} from "@tanstack/react-table";
import { useAppStore } from "@/store/useAppStore";
import { RefreshCw, Download, Filter, Search, Sparkles, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/cn";
const ResultsView = () => {
    const { queryTabs, activeTabId, activeDatabase, activeTable: activeStoreTable, isLoading } = useAppStore();
    const activeTab = queryTabs.find((t: any) => t.id === activeTabId);
    const results = activeTab?.results;
    const activeTable =
        activeTab?.type === "table" ? activeTab.tableName : null;
    const [viewMode, setViewMode] = useState<"data" | "structure">("data");
    const [sorting, setSorting] = useState<SortingState>([]);
    const table = useReactTable({
        data: results?.rows || [],
        columns: (results?.columns && results.columns.length > 0
            ? results.columns
            : (results?.rows && results.rows.length > 0 ? Object.keys(results.rows[0]) : [])
        ).map((col: string) => ({
            accessorKey: col,
            header: col,
            cell: (info: any) => (
                <span
                    className={`${info.getValue() === null ? "text-text-null italic" : ""} font-medium`}
                >
                    {info.getValue() === null
                        ? "null"
                        : String(info.getValue())}
                </span>
            ),
        })),
        state: {
            sorting,
        },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });
    if (!results) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-text-muted bg-[#0c0c0c]">
                <div className="w-16 h-16 mb-4 opacity-10 bg-blue-500/10 rounded-2xl flex items-center justify-center">
                    <Search size={32} className="text-blue-500/20" />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-text-muted">
                    {activeTable ? `Loading ${activeTable}...` : "No results to display"}
                </p>
                <div className="flex flex-col items-center gap-1 mt-2">
                    <p className="text-[10px] text-text-muted/60">
                        {isLoading ? "Fetching data from database..." : "Click a table or run a query to see data here"}
                    </p>
                    {isLoading && <Loader2 size={12} className="animate-spin text-blue-500 mt-2" />}
                </div>
            </div>
        );
    }
    if (results.rows.length === 0 && results.columns.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-emerald-500 bg-table-bg p-8 text-center">
                <div className="w-16 h-16 mb-6 bg-emerald-500/10 rounded-full flex items-center justify-center ring-1 ring-emerald-500/20">
                    <Sparkles size={32} className="text-emerald-500/40" />
                </div>
                <h3 className="text-sm font-bold uppercase tracking-[0.2em] mb-2 drop-shadow-sm">
                    Query executed successfully
                </h3>
                <p className="text-[10px] text-text-muted uppercase tracking-widest opacity-60">
                    {results.executionTimeMs || (results as any).execution_time_ms || 0}ms execution time • 0 rows affected
                </p>
            </div>
        );
    }
    return (
        <div className="h-full flex flex-col bg-[#111111] overflow-hidden">
            {/* Results Header: Minimalist breadcrumb style */}
            <div className="h-9 px-4 flex items-center justify-between border-b border-white/5 bg-[#111111] shrink-0">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-text-muted/40 uppercase tracking-[0.2em] font-mono">
                        {activeDatabase}
                    </span>
                    <span className="text-[10px] text-text-muted/20">/</span>
                    <span className="text-[11px] font-bold text-blue-400 tracking-tight">
                        {activeTable || "query_results"}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon-xs" className="size-6 text-text-muted">
                        <Download size={12} />
                    </Button>
                </div>
            </div>
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
                                            <div className="flex items-center gap-2">
                                                {flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext(),
                                                )}
                                            </div>
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
                                        {idx + 1}
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
            {/* Toolbar Footer like the screenshot */}
            <div className="h-9 bg-[#181818] border-t border-white/5 flex items-center justify-between px-2 shrink-0">
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setViewMode("data")}
                        className={cn(
                            "px-3 h-6 rounded text-[10px] font-bold uppercase tracking-widest transition-all",
                            viewMode === "data" ? "bg-white/10 text-white" : "text-text-muted hover:text-white"
                        )}
                    >
                        Data
                    </button>
                    <button
                        onClick={() => setViewMode("structure")}
                        className={cn(
                            "px-3 h-6 rounded text-[10px] font-bold uppercase tracking-widest transition-all",
                            viewMode === "structure" ? "bg-white/10 text-white" : "text-text-muted hover:text-white"
                        )}
                    >
                        Structure
                    </button>
                    <div className="w-px h-3 bg-white/10 mx-1" />
                    <button className="px-2 h-6 rounded text-text-muted hover:text-white flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest">
                        <Plus size={10} /> Row
                    </button>
                </div>
                <div className="flex items-center gap-4 text-[10px] font-mono text-text-muted/60">
                    <span className="tabular-nums">1-{results.rows.length} of {results.rows.length} rows</span>
                </div>
                <div className="flex items-center gap-1">
                    <button className="px-3 h-6 rounded bg-white/5 text-text-muted hover:text-white text-[10px] font-bold uppercase tracking-widest">
                        Filters
                    </button>
                    <button className="px-3 h-6 rounded bg-white/5 text-text-muted hover:text-white text-[10px] font-bold uppercase tracking-widest">
                        Columns
                    </button>
                </div>
            </div>
        </div>
    );
};
export default ResultsView;
