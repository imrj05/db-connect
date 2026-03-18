import { useEffect, useState } from "react";
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
import { Onboarding, shouldShowOnboarding } from "./components/layout/Onboarding";
import { SettingsDialog } from "./components/layout/SettingsDialog";
import { TooltipProvider } from "./components/ui/tooltip";
import { Toaster } from "sonner";

function App() {
    const {
        theme,
        appSettings,
        loadConnections,
        connections,
        connectionDialogOpen,
        editingConnection,
        setConnectionDialogOpen,
        setEditingConnection,
    } = useAppStore();

    const [onboardingDone, setOnboardingDone] = useState(false);

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

    useEffect(() => {
        document.documentElement.style.zoom = `${appSettings.uiZoom}%`;
    }, [appSettings.uiZoom]);

    const showOnboarding = !onboardingDone && shouldShowOnboarding(connections.length > 0);

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
                        {/* Main content: onboarding or function output */}
                        <Panel className="h-full">
                            {showOnboarding ? (
                                <Onboarding
                                    onDone={() => setOnboardingDone(true)}
                                    onOpenConnectionDialog={() => {
                                        setEditingConnection(null);
                                        setConnectionDialogOpen(true);
                                    }}
                                />
                            ) : (
                                <FunctionOutput />
                            )}
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
                <SettingsDialog />
                <Toaster position="bottom-right" richColors theme={theme} />
            </div>
        </TooltipProvider>
    );
}
export default App;
