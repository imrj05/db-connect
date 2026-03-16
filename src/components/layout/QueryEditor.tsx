import { useCallback, useEffect } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { sql } from "@codemirror/lang-sql";
import { oneDark } from "@codemirror/theme-one-dark";
import { Play, Save, Plus, History, Loader2 } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { tauriApi } from "@/lib/tauri-api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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
        setActiveTabId,
        closeQueryTab,
    } = useAppStore();
    const activeTab = queryTabs.find((t: any) => t.id === activeTabId);
    const handleRunQuery = useCallback(async () => {
        if (!activeConnection || !activeTabId || !activeTab?.query || isLoading)
            return;
        setLoading(true);
        try {
            const results = await tauriApi.executeQuery(
                activeConnection.id,
                activeTab.query,
            );
            setTabResults(activeTabId, results);
            toast.success("Query executed successfully");
        } catch (error) {
            console.error(error);
            toast.error(String(error));
        } finally {
            setLoading(false);
        }
    }, [
        activeConnection,
        activeTabId,
        activeTab?.query,
        isLoading,
        setTabResults,
        setLoading,
    ]);
    const onChange = useCallback(
        (value: string) => {
            if (activeTabId) updateTabQuery(activeTabId, value);
        },
        [activeTabId, updateTabQuery],
    );
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
        <div className="h-full flex flex-col bg-[#0A0A0A] border-t border-white/5 overflow-hidden">
            {/* Editor Header: Tabs & Actions */}
            <div className="h-9 flex items-center justify-between bg-[#111111] border-b border-white/5 px-2 shrink-0">
                <div className="flex items-center gap-px h-full">
                    {queryTabs.map((tab: any) => (
                        <div
                            key={tab.id}
                            onClick={() => setActiveTabId(tab.id)}
                            className={cn(
                                "h-7 px-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-tight transition-all cursor-pointer relative group rounded-md mx-0.5",
                                activeTabId === tab.id
                                    ? "bg-white/5 text-blue-400"
                                    : "text-text-muted hover:bg-white/[0.02]"
                            )}
                        >
                            <span className="truncate max-w-20">{tab.name}</span>
                            <div
                                className="size-3.5 rounded-full hover:bg-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    closeQueryTab(tab.id);
                                }}
                            >
                                <Plus size={10} className="rotate-45" />
                            </div>
                        </div>
                    ))}
                    <button
                        onClick={addQueryTab}
                        className="size-7 flex items-center justify-center text-text-muted hover:text-white transition-colors"
                    >
                        <Plus size={12} />
                    </button>
                </div>
                <div className="flex items-center gap-2 pr-1">
                    <button className="h-6 px-2 text-[10px] font-bold text-text-muted hover:text-white flex items-center gap-1.5 transition-colors">
                        <Save size={11} /> Save
                    </button>
                </div>
            </div>
            {/* Editor Container */}
            <div className="flex-1 relative group">
                <div className="absolute inset-0 scrollbar-thin">
                    <CodeMirror
                        value={activeTab?.query || ""}
                        height="100%"
                        theme={oneDark}
                        extensions={[sql()]}
                        onChange={onChange}
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
            {/* Bottom Status Bar / Execute Bar */}
            <div className="h-10 bg-[#0F0F0F] border-t border-white/5 flex items-center justify-between px-3 shrink-0 select-none">
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleRunQuery}
                        disabled={isLoading}
                        className={cn(
                            "group h-7 px-4 rounded flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] transition-all",
                            isLoading
                                ? "bg-white/5 text-text-muted cursor-not-allowed"
                                : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 active:scale-95 shadow-[0_0_20px_rgba(16,185,129,0.05)]"
                        )}
                    >
                        {isLoading ? (
                            <Loader2 className="size-3 animate-spin" />
                        ) : (
                            <Play size={11} className="fill-current" />
                        )}
                        Execute
                    </button>
                    <div className="w-px h-3 bg-white/5" />
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-[10px] font-mono text-text-muted/40">
                            <span className="text-[9px]">LIMIT</span>
                            <span className="text-text-muted/60">1000</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-4 text-[10px] font-mono">
                    <div className="flex items-center gap-3">
                        <button className="text-text-muted/40 hover:text-white transition-colors">
                            <History size={13} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
export default QueryEditor;
