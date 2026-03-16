import { useState } from 'react';
import { 
  flexRender, 
  getCoreRowModel, 
  useReactTable, 
  getSortedRowModel,
  SortingState
} from '@tanstack/react-table';
import { useAppStore } from '@/store/useAppStore';
import { RefreshCw, Download, Filter, Search } from 'lucide-react';

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const ResultsView = () => {
  const { queryTabs, activeTabId, activeDatabase, activeTable } = useAppStore();
  const activeTab = queryTabs.find((t: any) => t.id === activeTabId);
  const results = activeTab?.results;

  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data: results?.rows || [],
    columns: (results?.columns || []).map((col: string) => ({
      accessorKey: col,
      header: col,
      cell: (info: any) => (
        <span className={`${info.getValue() === null ? 'text-text-null italic' : ''} font-medium`}>
          {info.getValue() === null ? 'null' : String(info.getValue())}
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
      <div className="h-full flex flex-col items-center justify-center text-text-muted bg-table-bg">
        <div className="w-16 h-16 mb-4 opacity-10 bg-blue-500/10 rounded-2xl flex items-center justify-center">
            <Search size={32} className="text-blue-500/20" />
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-text-muted">No results to display</p>
        <p className="text-[10px] mt-1 text-text-muted/60">Run a query to see data here</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-table-bg overflow-hidden">
      {/* Results Header */}
      <div className="p-4 flex flex-col gap-4 bg-table-bg shrink-0">
        <div className="flex items-center justify-between">
            <div className="flex flex-col">
                <span className="text-xs font-bold text-text-primary tracking-tight">
                  {activeDatabase || 'No DB Selected'}{activeTable ? `.${activeTable}` : ''}
                </span>
                <span className="text-[10px] text-text-muted uppercase tracking-tighter">
                  {results ? `Showing 1-${results.rows.length} of ${results.rows.length} records` : 'No results'}
                </span>
            </div>
            <Button variant="outline" size="sm" className="font-bold text-[10px] uppercase tracking-tighter">
                <RefreshCw data-icon="inline-start" />
                Refresh Data
            </Button>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-2">
            <div className="flex-1 relative group">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 size-3 text-text-muted group-focus-within:text-blue-500 transition-colors" />
                <Input 
                    placeholder="Filter: e.g. id = 1 AND status = 'active'" 
                    className="h-9 pl-8 text-[11px] font-medium"
                />
            </div>
            <Button size="sm" className="bg-amber-500 hover:bg-amber-400 text-black font-bold text-[11px] uppercase tracking-tighter shadow-lg shadow-amber-500/5">
                Apply
            </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto scrollbar-thin px-4 pb-4">
        <div className="border border-border-app rounded-lg overflow-hidden">
          <Table className="w-full border-collapse text-[11px]">
            <TableHeader className="bg-zinc-900 border-b border-border-header">
              {table.getHeaderGroups().map(headerGroup => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent border-none">
                  {headerGroup.headers.map(header => (
                    <TableHead 
                      key={header.id}
                      className="h-9 px-4 text-left font-bold text-text-table-header border-r last:border-r-0 border-border-table hover:bg-white/5 cursor-pointer transition-colors"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center justify-between gap-2 lowercase tracking-tight">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() && (
                          <span className="text-[10px] text-blue-500">
                            {header.column.getIsSorted() === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow 
                  key={row.id} 
                  className="hover:bg-row-hover transition-colors group border-b border-border-table last:border-b-0"
                >
                  {row.getVisibleCells().map(cell => (
                    <TableCell 
                      key={cell.id} 
                      className="h-8 px-4 border-r last:border-r-0 border-border-table text-text-primary whitespace-nowrap overflow-hidden text-ellipsis max-w-75"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Results Footer */}
      <div className="h-8 bg-toolbar-bg border-t border-border-app flex items-center justify-between px-4 text-[10px] font-bold text-text-muted">
        <div className="flex items-center gap-4">
          <span className="uppercase tracking-widest">{results.rows.length} rows fetched</span>
          <span className="text-emerald-500 uppercase tracking-widest">Executed in {results.executionTimeMs}ms</span>
        </div>
        <Button variant="ghost" size="xs" className="hover:text-text-primary transition-colors uppercase tracking-widest text-[10px]">
            <Download data-icon="inline-start" />
            Download CSV
        </Button>
      </div>
    </div>
  );
};

export default ResultsView;
