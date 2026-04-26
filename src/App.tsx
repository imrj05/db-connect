import { useEffect, useLayoutEffect, useState, useRef, useCallback } from "react";
import Sidebar from "./components/layout/app-sidebar-panel";
import TitleBar from "./components/layout/title-bar";
import FunctionOutput from "./components/layout/function-output-panel";
import { useAppStore } from "./store/useAppStore";
import { CommandPalette } from "./components/layout/command-palette";
import ConnectionDialog from "./components/layout/connection-dialog-modal";
import {
    Onboarding,
    shouldShowOnboarding,
} from "./components/layout/app-onboarding-screen";
import { SettingsPage } from "./components/layout/function-output/settings-page";
import { SchemaDiffView } from "./components/layout/function-output/schema-diff-view";
import { TooltipProvider } from "./components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { UpdateDialog, type UpdateInfo } from "./components/layout/update-dialog";
import { LicenseActivationDialog } from "./components/layout/license-activation-dialog";
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
import { ErrorBoundary } from "./components/layout/error-boundary";
import { DB_FONT_SANS, DB_FONT_MONO, DB_FONT_SANS_STACK, DB_FONT_MONO_STACK } from "@/lib/fonts";

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
        setActiveView,
        activeTabId,
        closeTab,
        openNewTab,
        sidebarCollapsed,
        activeView,
    } = useAppStore();

    const [onboardingDone, setOnboardingDone] = useState(false);
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
    const [showUpdateDialog, setShowUpdateDialog] = useState(false);
    const [sidebarWidth, setSidebarWidth] = useState(() => {
        try {
            const saved = localStorage.getItem("db_connect_sidebar_width");
            if (saved) {
                const n = Number(saved);
                if (n >= 180 && n <= 480) return n;
            }
        } catch { /* ignore */ }
        return SIDEBAR_DEFAULT;
    });
    const [showCloseApp, setShowCloseApp] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const isDragging = useRef(false);
    const startX = useRef(0);
    const startWidth = useRef(0);
    const currentDragWidth = useRef(SIDEBAR_DEFAULT);
    const sidebarRef = useRef<HTMLDivElement>(null);

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

    useLayoutEffect(() => {
        // Remove all UI sub-theme variant classes by prefix (NOT "dark" — managed by setTheme directly)
        const toRemove = [...document.documentElement.classList].filter(
            (c) => c.startsWith("ui-dark-") || c.startsWith("ui-light-")
        );
        document.documentElement.classList.remove(...toRemove);

        if (theme === "dark") {
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
        if (!wrapper) return;
        if (scale === 1) {
            // Reset any previously applied zoom styles
            wrapper.style.transform = "";
            wrapper.style.transformOrigin = "";
            wrapper.style.width = "";
            wrapper.style.height = "";
            wrapper.style.position = "";
            wrapper.style.left = "";
            wrapper.style.top = "";
        } else {
            wrapper.style.transform = `scale(${scale})`;
            wrapper.style.transformOrigin = "top left";
            wrapper.style.width = `${100 / scale}%`;
            wrapper.style.height = `${100 / scale}%`;
            wrapper.style.position = "absolute";
            wrapper.style.left = "0";
            wrapper.style.top = "0";
        }
    }, [appSettings.uiZoom, isLoading]);

    useEffect(() => {
        const sansFont = appSettings.uiFontFamily;
        const monoFont = appSettings.monoFontFamily;

        // Resolve built-in aliases first
        let sansList: string;
        if (sansFont === DB_FONT_SANS) {
            sansList = DB_FONT_SANS_STACK;
        } else {
            const hasQuotes = sansFont.startsWith('"') || sansFont.startsWith("'");
            sansList = hasQuotes
                ? `${sansFont}, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Helvetica, Arial, sans-serif`
                : `"${sansFont}", sans-serif`;
        }

        let monoList: string;
        if (monoFont === DB_FONT_MONO) {
            monoList = DB_FONT_MONO_STACK;
        } else {
            const hasQuotes = monoFont.startsWith('"') || monoFont.startsWith("'");
            monoList = hasQuotes
                ? `${monoFont}, ui-monospace, SF Mono, Menlo, Monaco, Consolas, monospace`
                : `"${monoFont}", monospace`;
        }

        document.documentElement.style.setProperty("--app-font-sans", sansList);
        document.documentElement.style.setProperty("--app-font-mono", monoList);
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
            if ((e.metaKey || e.ctrlKey) && e.key === ",") {
                e.preventDefault();
                setActiveView("settings");
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
        currentDragWidth.current = sidebarWidth;
        // Disable CSS transition so every pixel is instant
        if (sidebarRef.current) {
            sidebarRef.current.style.transition = "none";
        }
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
    }, [sidebarWidth]);

    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            if (!isDragging.current) return;
            const delta = e.clientX - startX.current;
            const next = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startWidth.current + delta));
            currentDragWidth.current = next;
            // Drive resize via direct DOM mutation — no React re-render on every pixel
            if (sidebarRef.current) {
                sidebarRef.current.style.width = `${next}px`;
                sidebarRef.current.style.minWidth = `${next}px`;
            }
        };
        const onMouseUp = () => {
            if (!isDragging.current) return;
            isDragging.current = false;
            // Re-enable transition (for collapse animation), then commit state
            if (sidebarRef.current) {
                sidebarRef.current.style.transition = "";
            }
            setSidebarWidth(currentDragWidth.current);
            try { localStorage.setItem("db_connect_sidebar_width", String(currentDragWidth.current)); } catch { /* ignore */ }
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
            <div className="h-full w-full flex flex-col items-center justify-center gap-4 bg-background">
                <div className="size-16 rounded-md flex items-center justify-center animate-pulse bg-primary/10 border border-primary/20">
                    <Table2 size={32} className="text-primary" />
                </div>
                <p className="text-sm font-semibold text-foreground">DB Connect</p>
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
                    <main className="relative z-0 flex flex-1 overflow-hidden bg-app-bg">
                        {/* Sidebar — collapses smoothly */}
                        <div
                            ref={sidebarRef}
                            style={{ width: sidebarCollapsed ? 0 : sidebarWidth, minWidth: sidebarCollapsed ? 0 : sidebarWidth }}
                            className="h-full shrink-0 overflow-hidden border-r border-border-subtle transition-[width,min-width] duration-200 ease-in-out"
                        >
                            <Sidebar />
                        </div>
                        {/* Sidebar resize handle — hidden when collapsed */}
                        {!sidebarCollapsed && (
                            <div
                                onMouseDown={onMouseDown}
                                className="relative z-10 h-full w-2 shrink-0 cursor-col-resize before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2 before:bg-border-subtle before:transition-colors hover:before:bg-primary/35"
                            />
                        )}
                        {/* Main content */}
                        <div className="flex h-full min-w-0 flex-1 overflow-hidden bg-surface-1">
                            {showOnboarding ? (
                                <Onboarding
                                    onDone={() => setOnboardingDone(true)}
                                    onOpenConnectionPage={() => {
                                        setEditingConnection(null);
                                        setActiveView("new-connection");
                                    }}
                                />
                            ) : activeView === "settings" ? (
                                <SettingsPage onActivate={() => setLicenseDialogOpen(true)} />
                            ) : activeView === "new-connection" ? (
                                <ConnectionDialog
                                    mode="page"
                                    onClose={() => setActiveView("main")}
                                />
                            ) : activeView === "schema-diff" ? (
                                <SchemaDiffView />
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
