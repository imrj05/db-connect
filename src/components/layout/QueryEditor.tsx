import { useCallback, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';
import { Play, Save, Sparkles, Plus, Loader2 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { tauriApi } from '@/lib/tauri-api';
import { toast } from 'sonner';
import { Button } from "@/components/ui/button"

const QueryEditor = () => {
  const { 
    queryTabs, 
    activeTabId, 
    updateTabQuery, 
    activeConnection, 
    setTabResults,
    isLoading,
    setLoading,
    addQueryTab,
    setActiveTabId
  } = useAppStore();
  
  const activeTab = queryTabs.find((t: any) => t.id === activeTabId);

  const handleRunQuery = useCallback(async () => {
    if (!activeConnection || !activeTabId || !activeTab?.query || isLoading) return;

    setLoading(true);
    try {
      const results = await tauriApi.executeQuery(activeConnection.id, activeTab.query);
      setTabResults(activeTabId, results);
      toast.success('Query executed successfully');
    } catch (error) {
      console.error(error);
      toast.error(String(error));
    } finally {
      setLoading(false);
    }
  }, [activeConnection, activeTabId, activeTab?.query, isLoading, setTabResults, setLoading]);

  const onChange = useCallback((value: string) => {
    if (activeTabId) updateTabQuery(activeTabId, value);
  }, [activeTabId, updateTabQuery]);

  // Command + Enter to run query
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleRunQuery();
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [handleRunQuery]);

  return (
    <div className="h-full flex flex-col bg-table-bg overflow-hidden text-text-primary">
      {/* Editor Header: Tabs & Actions */}
      <div className="h-10 flex items-center justify-between bg-tabbar-bg border-b border-border-app px-3 shrink-0">
        <div className="flex items-center gap-0.5 h-full pt-1">
          {queryTabs.map((tab: any) => (
            <div 
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`h-full px-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-tight rounded-t-md border-x border-t transition-all cursor-pointer relative group ${
                activeTabId === tab.id 
                  ? 'bg-table-bg border-border-app text-blue-500 z-10' 
                  : 'bg-transparent border-transparent text-text-muted hover:bg-black/5'
              }`}
            >
              <span>{tab.name}</span>
              <Plus size={10} className="rotate-45 opacity-0 group-hover:opacity-100 transition-opacity" />
              {activeTabId === tab.id && <div className="absolute -bottom-px left-0 right-0 h-[1.5px] bg-blue-500" />}
            </div>
          ))}
          <Button 
            variant="ghost"
            size="icon-xs"
            onClick={addQueryTab}
            className="text-text-muted hover:text-text-primary"
          >
            <Plus />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-text-muted hover:text-text-primary hover:bg-black/5 font-bold uppercase tracking-tighter text-[10px]">
             <Save data-icon="inline-start" />
             Save Query
          </Button>
          <Button 
            size="sm"
            onClick={handleRunQuery}
            disabled={isLoading || !activeTab?.query}
            className="bg-amber-500 hover:bg-amber-400 text-black font-bold text-[11px] uppercase tracking-tighter shadow-lg shadow-amber-500/10 active:scale-95"
          >
            {isLoading ? <Loader2 className="animate-spin" /> : <Play fill="currentColor" />}
            Run SQL (⌘↵)
          </Button>
          <Button variant="outline" size="sm" className="bg-zinc-800 hover:bg-zinc-700 text-amber-500 border-amber-500/20 font-bold text-[11px] uppercase tracking-tighter group">
            <Sparkles data-icon="inline-start" className="group-hover:animate-pulse" />
            AI Help
          </Button>
        </div>
      </div>

      {/* Editor Container */}
      <div className="flex-1 relative">
        <div className="absolute inset-0">
          <CodeMirror
            value={activeTab?.query || ''}
            height="100%"
            theme={oneDark}
            extensions={[sql()]}
            onChange={onChange}
            className="text-[13px] h-full"
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
    </div>
  );
};

export default QueryEditor;
