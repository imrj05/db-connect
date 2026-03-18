import { useEffect } from "react";
import {
    Panel,
    Group as PanelGroup,
    Separator as PanelResizeHandle,
} from "react-resizable-panels";
import Sidebar from "./components/layout/Sidebar";
import TitleBar from "./components/layout/TitleBar";
import FunctionOutput from "./components/layout/FunctionOutput";
import { useAppStore } from "./store/useAppStore";
import { CommandPalette } from "./components/layout/CommandPalette";
import ConnectionDialog from "./components/layout/ConnectionDialog";
import { TooltipProvider } from "./components/ui/tooltip";
import { Toaster } from "sonner";
function App() {
    const {
        theme,
        loadConnections,
        connectionDialogOpen,
        editingConnection,
        setConnectionDialogOpen,
        setEditingConnection,
    } = useAppStore();
    useEffect(() => {
        loadConnections();
    }, [loadConnections]);
    useEffect(() => {
        if (theme === "dark") {
            document.documentElement.classList.add("dark");
        } else {
            document.documentElement.classList.remove("dark");
        }
    }, [theme]);
    return (
        <TooltipProvider>
            <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden font-sans selection:bg-accent/30">
                <TitleBar />
                <main className="flex-1 overflow-hidden relative">
                    <PanelGroup orientation="horizontal">
                        {/* Sidebar: connection tree + generated functions */}
                        <Panel
                            defaultSize={260}
                            minSize={180}
                            maxSize={480}
                            className="h-full"
                        >
                            <Sidebar />
                        </Panel>
                        <PanelResizeHandle className="w-px bg-border hover:bg-primary/60 transition-colors duration-200 cursor-col-resize" />
                        {/* Main content: function output area */}
                        <Panel className="h-full">
                            <FunctionOutput />
                        </Panel>
                    </PanelGroup>
                </main>
                <CommandPalette />
                {connectionDialogOpen && (
                    <ConnectionDialog
                        initialData={editingConnection ?? undefined}
                        onClose={() => {
                            setConnectionDialogOpen(false);
                            setEditingConnection(null);
                        }}
                    />
                )}
                <Toaster position="bottom-right" richColors theme={theme} />
            </div>
        </TooltipProvider>
    );
}
export default App;
