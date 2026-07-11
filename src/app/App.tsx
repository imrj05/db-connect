import { useEffect, useLayoutEffect, useState, useRef, useCallback, Suspense, lazy } from "react";
import Sidebar from "@/features/explorer/app-sidebar-panel";
import TitleBar from "@/app/title-bar";
import FunctionOutput from "@/features/workspace/function-output-panel";
import { useAppStore } from "@/stores/useAppStore";
import { CommandPalette } from "@/features/command-palette/command-palette";
import ConnectionDialog from "@/features/connections/connection-dialog-modal";
import {
    Onboarding,
    shouldShowOnboarding,
} from "@/features/onboarding/app-onboarding-screen";
import { Toaster } from "@/components/ui/sonner";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import type { UpdateInfo } from "@/features/updates/update-dialog";
import { ShortcutsHelpDialog } from "@/app/shortcuts-help-dialog";

const SettingsPage = lazy(() =>
    import("@/features/settings/settings-page").then((m) => ({ default: m.SettingsPage })),
);
const SchemaDiffView = lazy(() =>
    import("@/features/schema-diff/schema-diff-view").then((m) => ({ default: m.SchemaDiffView })),
);
const UpdateDialog = lazy(() =>
    import("@/features/updates/update-dialog").then((m) => ({ default: m.UpdateDialog })),
);
const LicenseActivationDialog = lazy(() =>
    import("@/features/licensing/license-activation-dialog").then((m) => ({ default: m.LicenseActivationDialog })),
);
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
import { Check, Database, Loader2 } from "lucide-react";
import {
    Command,
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { licenseCheckOffline, syncLicenseInBackground, type OfflineCheckResult } from "@/features/licensing/lib/license";
import { ErrorBoundary } from "@/app/error-boundary";
import { DB_FONT_SANS, DB_FONT_MONO, DB_FONT_SANS_STACK, DB_FONT_MONO_STACK } from "@/lib/fonts";
import { resolveEnv, envColorValue, type EnvKind } from "@/lib/env-safety";
import { captureTelemetry, syncTauriMonitoringPreferences } from "@/lib/monitoring";
import packageJson from "../../package.json";

const SIDEBAR_MIN = 180;
const SIDEBAR_MAX = 480;
const SIDEBAR_DEFAULT = 260;

function LazyViewFallback() {
    return (
        <div className="flex h-full w-full items-center justify-center bg-background">
            <Loader2 className="size-6 animate-spin text-primary/60" />
        </div>
    );
}

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
        tabs,
        switchToTab,
        closeTab,
        openNewTab,
        sidebarCollapsed,
        activeView,
        toggleSidebar,
        toggleQueryLog,
        setShowConnectionsManager,
        activeFunction,
        activeConnectionId,
        selectedDatabases,
        connectionDatabases,
        selectDatabase,
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
    const [databaseSwitcherOpen, setDatabaseSwitcherOpen] = useState(false);
    const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
    const isDragging = useRef(false);
    const startX = useRef(0);
    const startWidth = useRef(0);
    const currentDragWidth = useRef(SIDEBAR_DEFAULT);
    const sidebarRef = useRef<HTMLDivElement>(null);
    const appStartedTelemetrySent = useRef(false);

    // ── License state (non-blocking) ─────────────────────────────────────────
    const [licenseCheck, setLicenseCheck] = useState<OfflineCheckResult | null>(null);
    const [licenseDialogOpen, setLicenseDialogOpen] = useState(false);

    const databaseSwitcherConnectionId =
        activeConnectionId ?? activeFunction?.connectionId ?? connectedIds[0] ?? null;
    const databaseSwitcherConnection = databaseSwitcherConnectionId
        ? connections.find((conn) => conn.id === databaseSwitcherConnectionId) ?? null
        : null;
    const databaseSwitcherDatabases = databaseSwitcherConnectionId
        ? connectionDatabases[databaseSwitcherConnectionId] ?? []
        : [];
    const databaseSwitcherSelected = databaseSwitcherConnectionId
        ? selectedDatabases[databaseSwitcherConnectionId]
        : undefined;

    // ── Ambient Safety System (DESIGN.md §7) ──────────────────────────────────
    // Resolve the active connection's environment and drive the `--env-color`
    // token. null when no live connection → the env bar reads neutral, never
    // the misleading default green.
    const activeEnvConn = databaseSwitcherConnection;
    const activeEnvKind: EnvKind | null = activeEnvConn
        ? resolveEnv(activeEnvConn.group)
        : null;
    useEffect(() => {
        document.documentElement.style.setProperty(
            "--env-color",
            envColorValue(activeEnvKind),
        );
    }, [activeEnvKind]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        syncTauriMonitoringPreferences(
            appSettings.errorReportingEnabled,
            appSettings.anonymousTelemetryEnabled,
        );
    }, [appSettings.errorReportingEnabled, appSettings.anonymousTelemetryEnabled]);

    useEffect(() => {
        if (!isLoading && !appStartedTelemetrySent.current) {
            appStartedTelemetrySent.current = true;
            captureTelemetry("app_started", { version: packageJson.version });
        }
    }, [isLoading]);

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

    useEffect(() => {
        setIsLoading(true);
        loadConnections()
            .finally(() => setIsLoading(false));
    }, [loadConnections]);

    // Hand off the boot splash (painted by index.html) to the real app once
    // initial data has loaded. The splash fades via CSS transition, then we
    // remove its DOM node entirely.
    useEffect(() => {
        if (isLoading) return;
        document.body.dataset.appReady = "true";
        const t = setTimeout(() => {
            const splash = document.getElementById("boot-splash");
            splash?.remove();
        }, 400);
        return () => clearTimeout(t);
    }, [isLoading]);

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
        const editorTheme = theme === "dark" ? appSettings.editorDarkTheme : appSettings.editorLightTheme;
        document.documentElement.dataset.editorTheme = editorTheme;
    }, [theme, appSettings.editorDarkTheme, appSettings.editorLightTheme]);

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

    // ⌘1–9 / Ctrl+Tab — switch between result tabs
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (tabs.length === 0) return;

            // Ctrl+Tab / Ctrl+Shift+Tab — cycle through tabs
            if (e.ctrlKey && !e.metaKey && !e.altKey && e.key === "Tab") {
                e.preventDefault();
                const idx = tabs.findIndex((t) => t.id === activeTabId);
                const next = e.shiftKey
                    ? (idx - 1 + tabs.length) % tabs.length
                    : (idx + 1) % tabs.length;
                switchToTab(tabs[next].id);
                return;
            }

            // ⌘1–8 — jump to tab N; ⌘9 — last tab (browser convention)
            if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
                const digit = Number(e.key);
                if (!Number.isInteger(digit) || digit < 1 || digit > 9) return;
                e.preventDefault();
                const target = digit === 9 ? tabs[tabs.length - 1] : tabs[digit - 1];
                if (target) switchToTab(target.id);
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [tabs, activeTabId, switchToTab]);

    // "?" — open keyboard shortcuts help (when not typing in an input)
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            if (e.key !== "?") return;
            const target = e.target as HTMLElement | null;
            const tag = target?.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
            e.preventDefault();
            setShowShortcutsHelp((v) => !v);
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);

    // ⌘T / Ctrl+T — open new tab; global workspace shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (!(e.metaKey || e.ctrlKey) || e.altKey) return;

            const key = e.key.toLowerCase();
            if (!e.shiftKey && key === "t") {
                e.preventDefault();
                openNewTab();
            }
            if (!e.shiftKey && key === ",") {
                e.preventDefault();
                setActiveView("settings");
            }
            if (!e.shiftKey && key === "b") {
                e.preventDefault();
                toggleSidebar();
            }
            if (!e.shiftKey && key === "n") {
                e.preventDefault();
                setActiveView("new-connection");
            }
            if (e.shiftKey && key === "l") {
                e.preventDefault();
                toggleQueryLog();
            }
            if (e.shiftKey && key === "m") {
                e.preventDefault();
                setActiveView("main");
                setShowConnectionsManager(true);
            }
            if (e.shiftKey && key === "d") {
                const connectionId = activeConnectionId ?? activeFunction?.connectionId;
                if (!connectionId) return;
                const databases = connectionDatabases[connectionId] ?? [];
                if (databases.length === 0) return;

                e.preventDefault();
                setDatabaseSwitcherOpen(true);
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [
        activeConnectionId,
        activeFunction?.connectionId,
        connectionDatabases,
        openNewTab,
        setActiveView,
        setShowConnectionsManager,
        toggleQueryLog,
        toggleSidebar,
    ]);

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

    // Auto-hide the sidebar until the user has at least one live connection.
    // Once connected, fall back to the user's manual toggle preference.
    const hasLiveConnection = connectedIds.length > 0;
    const sidebarHidden =
        sidebarCollapsed ||
        connections.length === 0 ||
        !hasLiveConnection ||
        showOnboarding ||
        activeView === "new-connection";

    if (isLoading) {
        // Boot splash from index.html is still on-screen; render nothing yet
        // so the splash continues to cover the viewport without flicker.
        return null;
    }

    return (
        <ErrorBoundary>
            <>
                <div id="app-wrapper" className="h-full flex flex-col bg-background text-foreground overflow-hidden font-sans">
                    {/* Ambient Safety top border — always 2px, colored by the
                        active connection's environment via --env-color. Reads
                        neutral when no env is active (DESIGN.md §1, §7). */}
                    <div
                        aria-hidden="true"
                        className="h-0.5 w-full shrink-0 bg-[var(--env-color)] transition-colors duration-300"
                    />
                    <TitleBar
                        isLicensed={licenseCheck?.ok ?? null}
                        onActivate={() => setLicenseDialogOpen(true)}
                    />
                    <main className="relative z-0 flex flex-1 overflow-hidden bg-background">
                        {/* Sidebar — collapses smoothly; fully unmounted when there's no live connection */}
                        <div
                            ref={sidebarRef}
                            style={{ width: sidebarHidden ? 0 : sidebarWidth, minWidth: sidebarHidden ? 0 : sidebarWidth }}
                            className="h-full shrink-0 overflow-hidden border-r border-border transition-[width,min-width] duration-200 ease-in-out"
                            aria-hidden={sidebarHidden}
                        >
                            {!sidebarHidden && <Sidebar />}
                        </div>
                        {/* Sidebar resize handle — hidden when sidebar is hidden */}
                        {!sidebarHidden && (
                            <div
                                onMouseDown={onMouseDown}
                                role="separator"
                                aria-orientation="vertical"
                                aria-label="Resize sidebar"
                                className="relative z-10 h-full w-2 shrink-0 cursor-col-resize before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2 before:bg-border before:transition-colors hover:before:bg-primary/35"
                            />
                        )}
                        {/* Main content */}
                        <div className="flex h-full min-w-0 flex-1 overflow-hidden bg-background">
                            {showOnboarding ? (
                                <Onboarding
                                    onDone={() => setOnboardingDone(true)}
                                    onOpenConnectionPage={() => {
                                        setEditingConnection(null);
                                        setActiveView("new-connection");
                                    }}
                                />
                            ) : activeView === "settings" ? (
                                <Suspense fallback={<LazyViewFallback />}>
                                    <SettingsPage onActivate={() => setLicenseDialogOpen(true)} />
                                </Suspense>
                            ) : activeView === "new-connection" ? (
                                <ConnectionDialog
                                    mode="page"
                                    onClose={() => setActiveView("main")}
                                />
                            ) : activeView === "schema-diff" ? (
                                <Suspense fallback={<LazyViewFallback />}>
                                    <SchemaDiffView />
                                </Suspense>
                            ) : (
                                <FunctionOutput />
                            )}
                        </div>
                    </main>
                    <CommandPalette />
                    <CommandDialog
                        open={databaseSwitcherOpen}
                        onOpenChange={setDatabaseSwitcherOpen}
                        title="Change Database"
                        description="Select a database for the active connection."
                        className="sm:max-w-xl"
                        width="min(40rem, 92vw)"
                    >
                        <Command shouldFilter>
                            <CommandInput
                                placeholder={
                                    databaseSwitcherConnection
                                        ? `Search ${databaseSwitcherConnection.name} databases...`
                                        : "Search databases..."
                                }
                            />
                            <CommandList>
                                <CommandEmpty>No databases found.</CommandEmpty>
                                <CommandGroup heading="Current Connection Databases">
                                    {databaseSwitcherDatabases.map((database) => (
                                        <CommandItem
                                            key={database}
                                            value={database}
                                            onSelect={() => {
                                                if (!databaseSwitcherConnectionId) return;
                                                setDatabaseSwitcherOpen(false);
                                                void selectDatabase(databaseSwitcherConnectionId, database);
                                            }}
                                            className="gap-2"
                                        >
                                            <Database size={13} className="text-muted-foreground/60" />
                                            <span className="min-w-0 flex-1 truncate font-mono text-[12px]">
                                                {database}
                                            </span>
                                            {database === databaseSwitcherSelected && (
                                                <Check size={13} className="text-primary" />
                                            )}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </CommandDialog>
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
                                                            <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
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
                    {updateInfo && (
                        <Suspense fallback={null}>
                            <UpdateDialog
                                open={showUpdateDialog}
                                updateInfo={updateInfo}
                                onSkip={() => setShowUpdateDialog(false)}
                            />
                        </Suspense>
                    )}
                    <ShortcutsHelpDialog open={showShortcutsHelp} onOpenChange={setShowShortcutsHelp} />
                    <Suspense fallback={null}>
                        <LicenseActivationDialog
                            open={licenseDialogOpen}
                            reason={licenseCheck?.reason}
                            onActivated={(result) => {
                                setLicenseCheck(result);
                                setLicenseDialogOpen(false);
                            }}
                            onClose={() => setLicenseDialogOpen(false)}
                        />
                    </Suspense>
                </div>
                <Toaster position="top-center" richColors theme={theme} />
            </>
        </ErrorBoundary>
    );
}

export default App;
