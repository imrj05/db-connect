import { Info, Key, List, Clock, Shield, Search } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

const RightPanel = () => {
  const { activeConnection } = useAppStore();

  if (!activeConnection) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-[var(--color-text-muted)] bg-[var(--color-sidebar-bg)] p-6 text-center">
        <Info size={24} className="mb-4 opacity-20" />
        <p className="text-[10px] uppercase tracking-widest font-bold">No active table</p>
        <p className="text-[10px] mt-2 opacity-50">Select a table from the sidebar to view its structure and properties.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[var(--color-sidebar-bg)] border-l border-[var(--color-border-sidebar)] overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[var(--color-border-app)]">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-bold text-blue-500 uppercase tracking-tighter">Table Details</span>
        </div>
        <h2 className="text-sm font-bold text-[var(--color-text-primary)]">users</h2>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Quick Stats */}
        <div className="p-4 grid grid-cols-2 gap-2">
          <div className="p-3 bg-black/5 rounded-lg border border-black/5">
            <span className="block text-[9px] text-[var(--color-text-muted)] uppercase font-bold tracking-widest">Rows</span>
            <span className="text-sm font-bold">12,430</span>
          </div>
          <div className="p-3 bg-black/5 rounded-lg border border-black/5">
            <span className="block text-[9px] text-[var(--color-text-muted)] uppercase font-bold tracking-widest">Size</span>
            <span className="text-sm font-bold">1.2 MB</span>
          </div>
        </div>

        {/* Section: Columns */}
        <div className="px-4 py-2 bg-black/5 text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] flex items-center justify-between">
          <span>Columns (8)</span>
          <Search size={12} />
        </div>
        <div className="p-2 space-y-0.5">
          {[
            { name: 'id', type: 'uuid', pk: true },
            { name: 'email', type: 'varchar(255)', pk: false },
            { name: 'full_name', type: 'text', pk: false },
            { name: 'created_at', type: 'timestamp', pk: false },
            { name: 'status', type: 'enum', pk: false },
          ].map(col => (
            <div key={col.name} className="flex items-center justify-between px-2 py-1.5 hover:bg-black/5 rounded cursor-default group transition-colors">
              <div className="flex items-center gap-2">
                {col.pk ? <Key size={12} className="text-amber-500" /> : <List size={12} className="text-[var(--color-text-muted)]" />}
                <span className="text-xs font-semibold text-[var(--color-text-primary)]">{col.name}</span>
              </div>
              <span className="text-[10px] font-mono text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity bg-black/10 px-1 rounded">{col.type}</span>
            </div>
          ))}
        </div>

        {/* Section: Indexes */}
        <div className="px-4 py-2 bg-black/5 text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mt-2">
          Indexes
        </div>
        <div className="p-2 space-y-0.5">
           <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-[var(--color-text-primary)]">
             <Shield size={12} className="text-emerald-500" />
             <span className="font-semibold">idx_users_email</span>
             <span className="text-[9px] text-[var(--color-text-muted)] ml-auto font-bold uppercase tracking-tighter">Unique</span>
           </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-4 bg-[var(--color-toolbar-bg)] border-t border-[var(--color-border-app)] text-[10px] text-[var(--color-text-muted)]">
        <div className="flex items-center gap-2 mb-1">
          <Clock size={12} />
          <span>Last vacuum: 2 days ago</span>
        </div>
      </div>
    </div>
  );
};

export default RightPanel;
