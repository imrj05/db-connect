import { useEffect } from 'react';
import { ResizablePanel as Panel, ResizablePanelGroup as PanelGroup, ResizableHandle as PanelResizeHandle } from '@/components/ui/resizable';
import { useAppStore } from '@/store/useAppStore';
import TitleBar from './components/layout/TitleBar';
import Sidebar from './components/layout/Sidebar';
import QueryEditor from './components/layout/QueryEditor';
import ResultsView from './components/layout/ResultsView';
import RightPanel from './components/layout/RightPanel';

function App() {
  const { rightPanelOpen, activeConnection } = useAppStore();

  // Mock initial connection for UI verification
  useEffect(() => {
    // In a real app, we'd load this from an API/Store
  }, []);

  return (
    <div className="h-screen w-screen bg-app-bg text-text-primary flex flex-col overflow-hidden">
      <TitleBar />

      <main className="flex-1 overflow-hidden relative">
        <PanelGroup direction="horizontal">
          {/* Sidebar */}
          <Panel defaultSize={18} minSize={12} maxSize={30}>
            <Sidebar />
          </Panel>

          <PanelResizeHandle className="w-px bg-border-app hover:bg-blue-500 transition-colors z-20" />

          {/* Main Area */}
          <Panel defaultSize={62}>
            <PanelGroup direction="vertical">
              <Panel defaultSize={50} minSize={20}>
                <QueryEditor />
              </Panel>
              
              <PanelResizeHandle className="h-px bg-border-app hover:bg-blue-500 transition-colors z-20" />
              
              <Panel defaultSize={50} minSize={10}>
                <ResultsView />
              </Panel>
            </PanelGroup>
          </Panel>

          {/* Right Panel */}
          {rightPanelOpen && (
            <>
              <PanelResizeHandle className="w-px bg-border-app hover:bg-blue-500 transition-colors z-20" />
              <Panel defaultSize={20} minSize={15} maxSize={40}>
                <RightPanel />
              </Panel>
            </>
          )}
        </PanelGroup>
      </main>

      {/* Status Bar */}
      <footer className="h-6 bg-toolbar-bg border-t border-border-app flex items-center px-3 text-[10px] font-medium text-text-secondary">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded-full border border-emerald-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Connected: {activeConnection ? activeConnection.name : 'Standby'}</span>
          </div>
          {activeConnection && <span>{activeConnection.type.toUpperCase()} 15.2</span>}
        </div>
        <div className="ml-auto flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="opacity-50 tracking-widest uppercase text-[8px] font-black">Memory:</span>
            <span>42MB</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="opacity-50 tracking-widest uppercase text-[8px] font-black">Encoding:</span>
            <span>UTF-8</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
