import { useState } from 'react';
import { 
  flexRender, 
  getCoreRowModel, 
  useReactTable, 
  getSortedRowModel,
  SortingState
} from '@tanstack/react-table';
import { useAppStore } from '@/store/useAppStore';

const ResultsView = () => {
  const { queryTabs, activeTabId } = useAppStore();
  const activeTab = queryTabs.find((t: any) => t.id === activeTabId);
  const results = activeTab?.results;

  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data: results?.rows || [],
    columns: (results?.columns || []).map(col => ({
      accessorKey: col,
      header: col,
      cell: info => (
        <span className={info.getValue() === null ? 'text-[var(--color-text-null)] italic' : ''}>
          {info.getValue() === null ? 'NULL' : String(info.getValue())}
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
      <div className="h-full flex flex-col items-center justify-center text-[var(--color-text-muted)] bg-[var(--color-table-bg)]">
        <div className="w-16 h-16 mb-4 opacity-5 bg-[var(--color-text-muted)] rounded-2xl rotate-12" />
        <p className="text-xs font-medium uppercase tracking-widest">No results to display</p>
        <p className="text-[10px] mt-1">Run a query to see data here</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[var(--color-table-bg)] overflow-hidden">
      <div className="flex-1 overflow-auto scrollbar-thin">
        <table className="w-full border-collapse text-[11px]">
          <thead className="sticky top-0 bg-[var(--color-toolbar-bg)] border-b border-[var(--color-border-header)] z-10">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th 
                    key={header.id}
                    className="h-8 px-3 text-left font-bold text-[var(--color-text-table-header)] border-r border-[var(--color-border-table)] hover:bg-black/5 cursor-pointer transition-colors"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center justify-between gap-2 uppercase tracking-tighter">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() && (
                        <span className="text-[10px] text-blue-500">
                          {header.column.getIsSorted() === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, idx) => (
              <tr 
                key={row.id} 
                className={`hover:bg-[var(--color-row-hover)] transition-colors group ${idx % 2 === 0 ? '' : 'bg-[var(--color-row-alt)]'}`}
              >
                {row.getVisibleCells().map(cell => (
                  <td 
                    key={cell.id} 
                    className="h-7 px-3 border-r border-b border-[var(--color-border-table)] text-[var(--color-text-primary)] truncate max-w-[300px]"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination / Results Footer */}
      <div className="h-8 bg-[var(--color-toolbar-bg)] border-t border-[var(--color-border-app)] flex items-center px-3 text-[10px] font-medium text-[var(--color-text-secondary)]">
        <div className="flex items-center gap-4">
          <span>{results.rows.length} rows</span>
          <span className="text-[var(--color-accent-green)] font-bold">{results.executionTimeMs}ms</span>
        </div>
      </div>
    </div>
  );
};

export default ResultsView;
