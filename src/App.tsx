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

const SIDEBAR_MIN = 180;
const SIDEBAR_MAX = 480;
const SIDEBAR_DEFAULT = 260;

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
	const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
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

	return (
		<TooltipProvider>
			<div className="h-screen flex flex-col bg-background text-foreground overflow-hidden font-sans selection:bg-accent/30">
				<TitleBar />
				<main className="flex-1 overflow-hidden relative flex">
					{/* Sidebar */}
					<div style={{ width: sidebarWidth, minWidth: sidebarWidth }} className="h-full shrink-0">
						<Sidebar />
					</div>

					{/* Resize handle */}
					<div
						onMouseDown={onMouseDown}
						className="w-0.5 h-full shrink-0 cursor-col-resize bg-border hover:bg-primary/60 transition-colors duration-150 relative z-10"
					/>

					{/* Main content */}
					<div className="flex-1 h-full min-w-0">
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
				<Toaster position="bottom-right" richColors theme={theme} />
			</div>
		</TooltipProvider>
	);
}
export default App;
