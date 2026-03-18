import type { CSSProperties } from "react";
import { Search, Circle, WifiOff, Info, Settings } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Inline styles — the only reliable way to set -webkit-app-region in Tauri 2
const noDragStyle: CSSProperties = {
    WebkitAppRegion: "no-drag",
} as CSSProperties;

// ── Status badge config ────────────────────────────────────────────────────────
type StatusVariant = "success" | "danger" | "info";

const STATUS_STYLES: Record<StatusVariant, string> = {
    success:
        "bg-emerald-500/10 text-emerald-600 border border-emerald-500/25 dark:text-emerald-400 dark:bg-emerald-500/10",
    danger:
        "bg-red-500/10 text-red-600 border border-red-500/25 dark:text-red-400 dark:bg-red-500/10",
    info:
        "bg-blue-500/10 text-blue-600 border border-blue-500/25 dark:text-blue-400 dark:bg-blue-500/10",
};

// ── TitleBar ──────────────────────────────────────────────────────────────────
const TitleBar = () => {
    const { setCommandPaletteOpen, setSettingsOpen, activeFunction, connectedIds, connections } =
        useAppStore();

    // Derive status variant
    const statusVariant: StatusVariant =
        connectedIds.length > 0
            ? "success"
            : connections.length > 0
              ? "danger"
              : "info";

    const statusLabel =
        connectedIds.length > 0
            ? `${connectedIds.length} connected`
            : connections.length > 0
              ? "Disconnected"
              : "No connections";

    const StatusIcon =
        connectedIds.length > 0
            ? Circle
            : connections.length > 0
              ? WifiOff
              : Info;

    return (
        <header
            data-tauri-drag-region
            className="h-10 bg-sidebar border-b border-border flex items-center justify-between select-none shrink-0"
        >
            {/* Left: ~80px spacer for macOS traffic lights + active function name */}
            <div
                data-tauri-drag-region
                className="flex items-center gap-3 flex-1 pl-[80px]"
            >
                {activeFunction ? (
                    <span className="font-mono text-[11px] text-accent-blue font-bold tracking-tight">
                        {activeFunction.type === "table"
                            ? activeFunction.tableName
                            : activeFunction.callSignature
                                  .slice(activeFunction.prefix.length + 1)
                                  .replace(/\(.*$/, "")}
                    </span>
                ) : (
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                        DB Connect
                    </span>
                )}
            </div>

            {/* Center: Command palette trigger */}
            <div
                data-tauri-drag-region
                className="flex items-center justify-center flex-1"
            >
                <Button
                    style={noDragStyle}
                    variant="outline"
                    onClick={() => setCommandPaletteOpen(true)}
                    className="w-72 h-7 justify-start gap-2 bg-background/50 border-input/50 text-muted-foreground/60 hover:text-muted-foreground text-[10px] font-bold uppercase tracking-tighter px-3"
                >
                    <Search size={11} className="shrink-0" />
                    <span className="flex-1 text-left">Search functions...</span>
                    <span className="text-[9px] font-black opacity-40 ml-auto">⌘K</span>
                </Button>
            </div>

            {/* Right: status badge + settings */}
            <div
                data-tauri-drag-region
                className="flex items-center justify-end gap-2 flex-1 pr-3"
            >
                <div style={noDragStyle} className="flex items-center gap-1.5">
                    <Badge
                        variant="outline"
                        className={cn(
                            "uppercase tracking-widest text-[9px] py-0.5 px-2 gap-1.5 font-bold border-none",
                            STATUS_STYLES[statusVariant],
                        )}
                    >
                        <StatusIcon
                            className={cn(
                                "size-2 shrink-0",
                                statusVariant === "success" && "fill-current stroke-none animate-pulse",
                            )}
                        />
                        {statusLabel}
                    </Badge>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => setSettingsOpen(true)}
                                className="size-6 text-muted-foreground/40 hover:text-muted-foreground"
                            >
                                <Settings size={12} />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" sideOffset={4}>Settings</TooltipContent>
                    </Tooltip>
                </div>
            </div>
        </header>
    );
};

export default TitleBar;
