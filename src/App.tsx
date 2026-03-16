import { useEffect } from 'react';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import Sidebar from './components/layout/Sidebar';
import QueryEditor from './components/layout/QueryEditor';
import ResultsView from './components/layout/ResultsView';
import TitleBar from './components/layout/TitleBar';
import { useAppStore } from './store/useAppStore';
import { CommandPalette } from './components/layout/CommandPalette';
import ConnectionDialog from './components/layout/ConnectionDialog';
import { TooltipProvider } from './components/ui/tooltip';
import { Toaster } from 'sonner';
function App() {
    const { activeConnection, theme, setConnections, connectionDialogOpen, setConnectionDialogOpen } = useAppStore();
    // Load connections from storage
    useEffect(() => {
        const saved = localStorage.getItem('db_connections');
        if (saved) {
            try {
                setConnections(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to parse saved connections', e);
            }
        }
    }, [setConnections]);
    // Manage theme class on document element
    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [theme]);
    // In this version (v4), PanelGroup is Group and the prop is orientation
    return (
        <TooltipProvider>
            <div className="h-screen flex flex-col bg-app-bg text-text-primary overflow-hidden font-sans selection:bg-blue-500/30">
                <TitleBar />
                <main className="flex-1 overflow-hidden relative">
                    <PanelGroup orientation="horizontal">
                        {/* Sidebar */}
                        <Panel defaultSize={300} minSize={100} maxSize={500} className="h-full">
                            <Sidebar />
                        </Panel>
                        <PanelResizeHandle className="w-[1.5px] bg-border/40 hover:bg-primary/50 transition-all duration-300 cursor-col-resize relative group">
                            <div className="absolute inset-y-0 -left-2 -right-2 z-10" />
                            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                        </PanelResizeHandle>
                        {/* Main Content Area */}
                        <Panel className="h-full">
                            {!activeConnection ? (
                                <div className="h-full flex items-center justify-center bg-table-bg text-text-muted transition-all duration-500">
                                    <div className="text-center p-8 bg-zinc-900/50 rounded-3xl border border-white/5 backdrop-blur-3xl shadow-2xl">
                                        <h2 className="text-2xl font-black mb-3 tracking-tight text-white">Welcome to DB Connect</h2>
                                        <p className="text-sm font-medium opacity-60">Connect to a database to begin exploring your data.</p>
                                        <button
                                            onClick={() => setConnectionDialogOpen(true)}
                                            className="mt-8 px-10 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all active:scale-95 shadow-lg shadow-blue-500/20"
                                        >
                                            Add Connection
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <PanelGroup orientation="vertical">
                                    <Panel defaultSize={50} minSize={20}>
                                        <QueryEditor />
                                    </Panel>
                                    <PanelResizeHandle className="h-px bg-border-app hover:bg-blue-500/50 transition-colors cursor-row-resize relative">
                                        <div className="absolute inset-x-0 -top-1 -bottom-1" />
                                    </PanelResizeHandle>
                                    <Panel defaultSize={50} minSize={20}>
                                        <ResultsView />
                                    </Panel>
                                </PanelGroup>
                            )}
                        </Panel>
                    </PanelGroup>
                </main>
                <CommandPalette />
                {connectionDialogOpen && <ConnectionDialog onClose={() => setConnectionDialogOpen(false)} />}
                <Toaster position="bottom-right" richColors theme={theme} />
            </div>
        </TooltipProvider>
    );
}
export default App;
