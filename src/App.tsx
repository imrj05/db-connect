import { useEffect, useState, useRef, useCallback } from "react";
import Sidebar from "./components/layout/Sidebar";
import TitleBar from "./components/layout/TitleBar";
import FunctionOutput from "./components/layout/FunctionOutput";
import { useAppStore } from "./store/useAppStore";
import { CommandPalette } from "./components/layout/CommandPalette";
import ConnectionDialog from "./components/layout/ConnectionDialog";
import {
    Onboarding,
    shouldShowOnboarding,
} from "./components/layout/Onboarding";
import { SettingsDialog } from "./components/layout/SettingsDialog";
import { SettingsPage } from "./components/layout/function-output/SettingsPage";
import { TooltipProvider } from "./components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { UpdateDialog, type UpdateInfo } from "./components/layout/UpdateDialog";
import { LicenseActivationDialog } from "./components/layout/LicenseActivationDialog";
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Table2, Loader2 } from "lucide-react";
import { licenseCheckOffline, syncLicenseInBackground, type OfflineCheckResult } from "@/lib/license";
import { ErrorBoundary } from "./components/layout/ErrorBoundary";

const SIDEBAR_MIN = 180;
const SIDEBAR_MAX = 480;
const SIDEBAR_DEFAULT = 260;

function App() {
    const {
        theme,
        appSettings,
        loadConnections,
        connections,
        connectedIds,
        disconnectConnection,
        connectionDialogOpen,
        editingConnection,
        setConnectionDialogOpen,
        setEditingConnection,
        activeTabId,
        closeTab,
        openNewTab,
        sidebarCollapsed,
        activeView,
    } = useAppStore();

    const [onboardingDone, setOnboardingDone] = useState(false);
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
    const [showUpdateDialog, setShowUpdateDialog] = useState(false);
    const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
    const [showCloseApp, setShowCloseApp] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const isDragging = useRef(false);
    const startX = useRef(0);
    const startWidth = useRef(0);

    // ── License state (non-blocking) ─────────────────────────────────────────
    const [licenseCheck, setLicenseCheck] = useState<OfflineCheckResult | null>(null);
    const [licenseDialogOpen, setLicenseDialogOpen] = useState(false);

    useEffect(() => {
        licenseCheckOffline().then((result) => {
            setLicenseCheck(result);
            if (result.ok) {
                void syncLicenseInBackground("https://db-connect.rajeshwarkashyap.in");
            }
        }).catch(() => {
            setLicenseCheck({ ok: false, reason: "missing_license" });
        });
    }, []);
    // ─────────────────────────────────────────────────────────────────────────

    const [isLoading, setIsLoading] = useState(true);
    useEffect(() => {
        setIsLoading(true);
        loadConnections()
            .finally(() => setIsLoading(false));
    }, [loadConnections]);

    useEffect(() => {
        const timer = setTimeout(async () => {
            try {
                const info = await invoke<UpdateInfo>("check_for_updates");
                if (info.available) {
                    setUpdateInfo(info);
                    setShowUpdateDialog(true);
                }
            } catch {
                // Silently fail — update checks should never block the app
            }
        }, 2000);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        // Remove all UI theme classes first
        document.documentElement.classList.remove(
            "dark",
            "ui-dark-dim", "ui-dark-midnight", "ui-dark-catppuccin-mocha", "ui-dark-nord", "ui-dark-dracula",
            "ui-dark-one-dark", "ui-dark-github-dark", "ui-dark-slack-dark", "ui-dark-linear", "ui-dark-voyage",
            "ui-dark-astro", "ui-dark-night-owl", "ui-dark-borland", "ui-dark-metals",
            "ui-light-light", "ui-light-sunrise", "ui-light-cream", "ui-light-catppuccin-latte", "ui-light-nord-light",
            "ui-light-github-light", "ui-light-slack-zen", "ui-light-linear-light", "ui-light-voyage-light",
            "ui-light-astro-light", "ui-light-spring", "ui-light-monokai-light", "ui-light-solarized-light", "ui-light-dracula-light"
        );

        if (theme === "dark") {
            // Add .dark for Tailwind dark: variants
            document.documentElement.classList.add("dark");
            // Apply dark variant class override (skip "dark" variant as .dark already handles it)
            if (appSettings.uiDarkTheme !== "dark") {
                document.documentElement.classList.add(`ui-dark-${appSettings.uiDarkTheme}`);
            }
        } else {
            // Apply light variant class (skip "light" variant as it's the default)
            if (appSettings.uiLightTheme !== "light") {
                document.documentElement.classList.add(`ui-light-${appSettings.uiLightTheme}`);
            }
        }

        const editorTheme = theme === "dark" ? appSettings.editorDarkTheme : appSettings.editorLightTheme;
        document.documentElement.dataset.editorTheme = editorTheme;
    }, [theme, appSettings.uiDarkTheme, appSettings.uiLightTheme, appSettings.editorDarkTheme, appSettings.editorLightTheme]);

    useEffect(() => {
        const scale = appSettings.uiZoom / 100;
        const wrapper = document.getElementById("app-wrapper");
        if (wrapper) {
            wrapper.style.transform = `scale(${scale})`;
            wrapper.style.transformOrigin = "top left";
            wrapper.style.width = `${100 / scale}%`;
            wrapper.style.height = `${100 / scale}%`;
            wrapper.style.position = "absolute";
            wrapper.style.left = "0";
            wrapper.style.top = "0";
        }
    }, [appSettings.uiZoom]);

    useEffect(() => {
        const sansFont = appSettings.uiFontFamily;
        const monoFont = appSettings.monoFontFamily;
        
        // Check if font might be bundled (has quotes when loaded from system)
        const hasQuotes = (f: string) => f.startsWith('"') || f.startsWith("'");
        
        // Build proper font-stack with fallbacks
        const sansList = hasQuotes(sansFont)
            ? `${sansFont}, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Helvetica, Arial, sans-serif`
            : `"${sansFont}", sans-serif`;
            
        const monoList = hasQuotes(monoFont)
            ? `${monoFont}, ui-monospace, SF Mono, Menlo, Monaco, Consolas, monospace`
            : `"${monoFont}", monospace`;
        
        document.documentElement.style.setProperty("--font-sans", sansList);
        document.documentElement.style.setProperty("--font-mono", monoList);
    }, [appSettings.uiFontFamily, appSettings.monoFontFamily]);

    // ⌘W / Ctrl+W — close active tab, or show close-app dialog when no tabs remain
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "w") {
                e.preventDefault();
                if (activeTabId) {
                    closeTab(activeTabId);
                } else {
                    setShowCloseApp(true);
                }
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [activeTabId, closeTab]);

    // ⌘T / Ctrl+T — open new tab
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "t") {
                e.preventDefault();
                openNewTab();
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [openNewTab]);

    const handleCloseApp = useCallback(async () => {
        setIsClosing(true);
        // Gracefully disconnect all active connections before exit
        await Promise.all(
            connectedIds.map((id) => disconnectConnection(id).catch(() => { })),
        );
        await getCurrentWindow().close();
    }, [connectedIds, disconnectConnection]);

    const onMouseDown = useCallback((e: React.MouseEvent) => {
        isDragging.current = true;
        startX.current = e.clientX;
        startWidth.current = sidebarWidth;
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
    }, [sidebarWidth]);

    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            if (!isDragging.current) return;
            const delta = e.clientX - startX.current;
            const next = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startWidth.current + delta));
            setSidebarWidth(next);
        };
        const onMouseUp = () => {
            if (!isDragging.current) return;
            isDragging.current = false;
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        };
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
    }, []);

    const showOnboarding =
        !onboardingDone && shouldShowOnboarding(connections.length > 0);

    // Active connection names for the close dialog
    const activeConnections = connections.filter((c) =>
        connectedIds.includes(c.id),
    );

    if (isLoading) {
        return (
            <div
                className="h-full w-full flex flex-col items-center justify-center gap-4"
                style={{ backgroundColor: "var(--background, #ffffff)" }}
            >
                <div
                    className="size-16 rounded-md flex items-center justify-center animate-pulse"
                    style={{ backgroundColor: "oklch(0.52 0.13 265 / 0.1)", border: "1px solid oklch(0.52 0.13 265 / 0.2)" }}
                >
                    <Table2 size={32} style={{ color: "oklch(0.52 0.13 265)" }} />
                </div>
                <p className="text-sm font-semibold" style={{ color: "var(--foreground, #1e1e1e)" }}>DB Connect</p>
            </div>
        );
    }

    return (
        <ErrorBoundary>
            <TooltipProvider>
                <div id="app-wrapper" className="h-full flex flex-col bg-app-bg text-foreground overflow-hidden font-sans selection:bg-accent/30">
                    <TitleBar
                        isLicensed={licenseCheck?.ok ?? null}
                        onActivate={() => setLicenseDialogOpen(true)}
                    />
                    <main className="relative z-0 flex-1 overflow-hidden flex bg-app-bg p-1.5 gap-1.5">
                        {/* Sidebar — collapses smoothly */}
                        <div
                            style={{ width: sidebarCollapsed ? 0 : sidebarWidth, minWidth: sidebarCollapsed ? 0 : sidebarWidth }}
                            className="h-full shrink-0 overflow-hidden transition-[width,min-width] duration-200 ease-in-out rounded-md"
                        >
                            <Sidebar />
                        </div>
                        {/* Sidebar resize handle — hidden when collapsed */}
                        {!sidebarCollapsed && (
                            <div
                                onMouseDown={onMouseDown}
                                className="relative h-full w-3 shrink-0 cursor-col-resize z-10 before:absolute before:inset-y-3 before:left-1/2 before:w-px before:-translate-x-1/2 before:bg-border-subtle before:transition-colors hover:before:bg-primary/35"
                            />
                        )}
                        {/* Main content */}
                        <div className="flex-1 h-full min-w-0 overflow-hidden rounded-md border border-border-subtle bg-surface-1 shadow-sm">
                            {showOnboarding ? (
                                <Onboarding
                                    onDone={() => setOnboardingDone(true)}
                                    onOpenConnectionDialog={() => {
                                        setEditingConnection(null);
                                        setConnectionDialogOpen(true);
                                    }}
                                />
                            ) : activeView === "settings" ? (
                                <SettingsPage onActivate={() => setLicenseDialogOpen(true)} />
                            ) : (
                                <FunctionOutput />
                            )}
                        </div>
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
                    <SettingsDialog onActivate={() => setLicenseDialogOpen(true)} />
                    {/* Close app confirmation */}
                    <AlertDialog
                        open={showCloseApp}
                        onOpenChange={(o) => { if (!isClosing) setShowCloseApp(o); }}
                    >
                        <AlertDialogContent className="max-w-sm">
                            <AlertDialogHeader>
                                <AlertDialogTitle>Close DB Connect?</AlertDialogTitle>
                                <AlertDialogDescription asChild>
                                    <div className="flex flex-col gap-2">
                                        {activeConnections.length > 0 ? (
                                            <>
                                                <span>
                                                    The following{" "}
                                                    {activeConnections.length === 1
                                                        ? "connection"
                                                        : `${activeConnections.length} connections`}{" "}
                                                    will be disconnected:
                                                </span>
                                                <ul className="flex flex-col gap-1">
                                                    {activeConnections.map((c) => (
                                                        <li
                                                            key={c.id}
                                                            className="flex items-center gap-2 px-2 py-1 rounded bg-muted text-[11px] font-mono text-foreground/80"
                                                        >
                                                            <span className="w-1.5 h-1.5 rounded-full bg-accent-green shrink-0" />
                                                            {c.name ?? c.host}
                                                        </li>
                                                    ))}
                                                </ul>
                                                <span className="text-muted-foreground">
                                                    Any unsaved query changes will be lost.
                                                </span>
                                            </>
                                        ) : (
                                            <span>
                                                Any unsaved query changes will be lost.
                                            </span>
                                        )}
                                    </div>
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel autoFocus disabled={isClosing}>
                                    Cancel
                                </AlertDialogCancel>
                                <Button
                                    variant="default"
                                    disabled={isClosing}
                                    onClick={handleCloseApp}
                                    className="gap-2"
                                >
                                    {isClosing ? (
                                        <>
                                            <Loader2 size={12} className="animate-spin" />
                                            Disconnecting…
                                        </>
                                    ) : (
                                        "Close App"
                                    )}
                                </Button>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                    <Toaster position="bottom-right" richColors theme={theme} />
                    {updateInfo && (
                        <UpdateDialog
                            open={showUpdateDialog}
                            updateInfo={updateInfo}
                            onSkip={() => setShowUpdateDialog(false)}
                        />
                    )}
                    <LicenseActivationDialog
                        open={licenseDialogOpen}
                        reason={licenseCheck?.reason}
                        onActivated={(result) => {
                            setLicenseCheck(result);
                            setLicenseDialogOpen(false);
                        }}
                        onClose={() => setLicenseDialogOpen(false)}
                    />
                </div>
            </TooltipProvider>
        </ErrorBoundary>
    );
}

export default App;