import { Search, Command, Bell, Circle } from 'lucide-react';

const TitleBar = () => {
  return (
    <header className="h-10 bg-titlebar-bg border-b border-border-app flex items-center justify-between px-4 select-none tauri-drag-region">
      {/* Search / Command Palette Trigger */}
      <div className="flex items-center flex-1">
        <div className="flex items-center gap-2 px-3 py-1 bg-input-bg border border-border-input rounded-md text-text-muted hover:text-text-secondary cursor-pointer transition-all w-72">
          <Search size={14} />
          <span className="text-xs font-medium">Quick Search...</span>
          <div className="ml-auto flex items-center gap-0.5 opacity-50">
            <Command size={10} />
            <span className="text-[10px] font-bold">K</span>
          </div>
        </div>
      </div>

      {/* App Title/Logo */}
      <div className="flex-1 flex justify-center">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-linear-to-br from-blue-500 to-indigo-600 rounded flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Circle size={10} fill="white" stroke="none" />
          </div>
          <span className="text-xs font-bold tracking-tighter text-text-primary uppercase">DB Connect</span>
        </div>
      </div>

      {/* Actions & Window Controls (Mac Style) */}
      <div className="flex-1 flex justify-end items-center gap-4">
        <button className="p-1.5 text-text-muted hover:text-text-secondary transition-colors">
          <Bell size={16} />
        </button>
        
        <div className="flex items-center gap-2 pl-4 border-l border-border-app">
          <div className="w-3 h-3 rounded-full bg-amber-500/20 hover:bg-amber-500 transition-colors cursor-pointer" />
          <div className="w-3 h-3 rounded-full bg-emerald-500/20 hover:bg-emerald-500 transition-colors cursor-pointer" />
          <div className="w-3 h-3 rounded-full bg-rose-500/20 hover:bg-rose-500 transition-colors cursor-pointer" />
        </div>
      </div>
    </header>
  );
};

export default TitleBar;
