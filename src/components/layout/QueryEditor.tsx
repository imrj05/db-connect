import { useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';
import { Play, Save, History, Code, Sparkles, Plus } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

const QueryEditor = () => {
  const { queryTabs, activeTabId, updateTabQuery } = useAppStore();
  const activeTab = queryTabs.find((t: any) => t.id === activeTabId);

  const onChange = useCallback((value: string) => {
    if (activeTabId) updateTabQuery(activeTabId, value);
  }, [activeTabId, updateTabQuery]);

  return (
    <div className="h-full flex flex-col bg-[var(--color-app-bg)] overflow-hidden">
      {/* Tabs Toolbar */}
      <div className="h-9 flex items-center bg-tabbar-bg border-b border-border-app px-2">
        <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide">
          {queryTabs.map((tab: any) => (
            <div 
              key={tab.id}
              className={`h-7 px-3 flex items-center gap-2 text-[11px] font-medium rounded-t-md border-x border-t transition-all cursor-pointer ${
                activeTabId === tab.id 
                  ? 'bg-[var(--color-tab-active-bg)] border-[var(--color-border-app)] text-[var(--color-text-primary)] shadow-[0_-2px_4px_rgba(0,0,0,0.1)]' 
                  : 'bg-transparent border-transparent text-[var(--color-text-muted)] hover:bg-black/5'
              }`}
            >
              <Code size={12} className={activeTabId === tab.id ? 'text-blue-500' : ''} />
              <span>{tab.name}</span>
            </div>
          ))}
        </div>
        <button className="ml-2 w-6 h-6 flex items-center justify-center rounded hover:bg-black/5 text-[var(--color-text-muted)]">
          <Plus size={14} />
        </button>
      </div>

      {/* Editor Container */}
      <div className="flex-1 relative group">
        <div className="absolute inset-0">
          <CodeMirror
            value={activeTab?.query || ''}
            height="100%"
            theme={oneDark}
            extensions={[sql()]}
            onChange={onChange}
            className="text-sm h-full"
            basicSetup={{
              lineNumbers: true,
              foldGutter: true,
              dropCursor: true,
              allowMultipleSelections: true,
              indentOnInput: true,
            }}
          />
        </div>
      </div>

      {/* Action Bar */}
      <div className="h-10 bg-[var(--color-toolbar-bg)] border-t border-[var(--color-border-app)] flex items-center justify-between px-3">
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-1 bg-blue-600 hover:bg-blue-500 rounded text-white text-xs font-bold transition-all shadow-lg shadow-blue-500/20 active:scale-95">
            <Play size={14} fill="white" />
            <span>RUN</span>
          </button>
          <button className="p-1.5 text-[var(--color-text-secondary)] hover:bg-black/5 rounded transition-all tooltip" title="Save Query">
            <Save size={16} />
          </button>
          <button className="p-1.5 text-[var(--color-text-secondary)] hover:bg-black/5 rounded transition-all" title="Query History">
            <History size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded text-xs font-medium transition-all group">
            <Sparkles size={14} className="group-hover:animate-pulse" />
            <span>AI Assistant</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default QueryEditor;
