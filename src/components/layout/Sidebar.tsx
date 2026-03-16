import { Database, Plus, ChevronDown, Table as TableIcon, Settings } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

const Sidebar = () => {
  const { connections, activeConnection, setActiveConnection, sidebarCollapsed } = useAppStore();

  return (
    <div className={`h-full flex flex-col bg-sidebar-bg border-r border-border-sidebar transition-all duration-300 ${sidebarCollapsed ? 'w-12' : 'w-full'}`}>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Connections Section */}
        <div className="p-2">
          {!sidebarCollapsed && (
            <div className="flex items-center justify-between mb-2 px-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Connections</span>
              <button className="p-1 hover:bg-sidebar-item-hover rounded-md transition-colors text-text-secondary">
                <Plus size={14} />
              </button>
            </div>
          )}
          <div className="space-y-0.5">
            {connections.map((conn) => (
              <button
                key={conn.id}
                onClick={() => setActiveConnection(conn)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md transition-all group ${
                  activeConnection?.id === conn.id 
                    ? 'bg-sidebar-item-active text-text-sidebar-active' 
                    : 'text-text-sidebar-item hover:bg-sidebar-item-hover'
                }`}
              >
                <div className={`p-1 rounded shadow-sm ${
                  conn.type === 'postgresql' ? 'bg-blue-500/20 text-blue-400' :
                  conn.type === 'mongodb' ? 'bg-green-500/20 text-green-400' :
                  conn.type === 'redis' ? 'bg-red-500/20 text-red-400' :
                  'bg-zinc-500/20 text-zinc-400'
                }`}>
                  <Database size={14} />
                </div>
                {!sidebarCollapsed && (
                  <span className="text-xs font-medium truncate">{conn.name}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Schema Explorer Section (Only if connected) */}
        {activeConnection && !sidebarCollapsed && (
          <div className="mt-4 p-2 border-t border-border-sidebar">
            <div className="flex items-center justify-between mb-2 px-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Explorer</span>
            </div>
            {/* Mock Schema Explorer */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 px-2 py-1 text-xs text-text-secondary hover:text-text-primary cursor-pointer group">
                <ChevronDown size={14} className="text-text-muted" />
                <span className="font-semibold">public</span>
              </div>
              <div className="ml-4 space-y-0.5">
                {['users', 'orders', 'products'].map(table => (
                  <div key={table} className="flex items-center gap-2 px-2 py-1 text-xs text-text-sidebar-item hover:bg-sidebar-item-hover rounded cursor-pointer group">
                    <TableIcon size={12} className="text-text-muted" />
                    <span>{table}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="p-2 border-t border-border-sidebar bg-toolbar-bg">
        <button className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-sidebar-item-hover rounded-md transition-all">
          <Settings size={14} />
          {!sidebarCollapsed && <span>Settings</span>}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;

