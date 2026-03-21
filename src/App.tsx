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
import { TooltipProvider } from "./components/ui/tooltip";
import { Toaster } from "sonner";
import { getCurrentWindow } from "@tauri-apps/api/window";
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
import { Loader2 } from "lucide-react";

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
		sidebarCollapsed,
	} = useAppStore();

	const [onboardingDone, setOnboardingDone] = useState(false);
	const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
	const [showCloseApp, setShowCloseApp] = useState(false);
	const [isClosing, setIsClosing] = useState(false);
	const isDragging = useRef(false);
	const startX = useRef(0);
	const startWidth = useRef(0);

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

	const handleCloseApp = useCallback(async () => {
		setIsClosing(true);
		// Gracefully disconnect all active connections before exit
		await Promise.all(
			connectedIds.map((id) => disconnectConnection(id).catch(() => {})),
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

	return (
		<TooltipProvider>
			<div className="h-screen flex flex-col bg-background text-foreground overflow-hidden font-sans selection:bg-accent/30">
				<TitleBar />
				<main className="flex-1 overflow-hidden relative flex">
					{/* Sidebar — collapses smoothly */}
					<div
						style={{ width: sidebarCollapsed ? 0 : sidebarWidth, minWidth: sidebarCollapsed ? 0 : sidebarWidth }}
						className="h-full shrink-0 overflow-hidden transition-[width,min-width] duration-200 ease-in-out"
					>
						<Sidebar />
					</div>

					{/* Sidebar resize handle — hidden when collapsed */}
					{!sidebarCollapsed && (
						<div
							onMouseDown={onMouseDown}
							className="w-0.5 h-full shrink-0 cursor-col-resize bg-border hover:bg-primary/60 transition-colors duration-150 relative z-10"
						/>
					)}

					{/* Main content */}
					<div className="flex-1 h-full min-w-0 overflow-hidden">
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
				<SettingsDialog />
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
			</div>
		</TooltipProvider>
	);
}
export default App;
