import type { CSSProperties } from "react";
import { Search, Circle } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { Badge } from "@/components/ui/badge";
// Inline styles — the only reliable way to set -webkit-app-region in Tauri 2
const noDragStyle: CSSProperties = {
    WebkitAppRegion: "no-drag",
} as CSSProperties;
const TitleBar = () => {
    const { setCommandPaletteOpen, activeFunction, connectedIds } =
        useAppStore();
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
                        {activeFunction.type === "table" ? activeFunction.tableName : activeFunction.callSignature.slice(activeFunction.prefix.length + 1).replace(/\(.*$/, "")}
                    </span>
                ) : (
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                        DB Connect
                    </span>
                )}
            </div>
            {/* Center: Command palette trigger — must opt out of drag so it stays clickable */}
            <div
                data-tauri-drag-region
                className="flex items-center justify-center flex-1"
            >
                <button
                    style={noDragStyle}
                    onClick={() => setCommandPaletteOpen(true)}
                    className="flex items-center gap-2 px-3 py-1 bg-background/50 border border-input/50 rounded-md text-muted-foreground hover:text-muted-foreground cursor-pointer transition-all w-72 group"
                >
                    <Search
                        size={11}
                        className="group-hover:text-primary transition-colors"
                    />
                    <span className="text-[10px] font-bold uppercase tracking-tighter">
                        Search functions...
                    </span>
                    <div className="ml-auto flex items-center gap-0.5 opacity-20 group-hover:opacity-50 transition-opacity">
                        <span className="text-[9px] font-black">⌘K</span>
                    </div>
                </button>
            </div>
            {/* Right: connection status badge */}
            <div
                data-tauri-drag-region
                className="flex items-center justify-end gap-2 flex-1 pr-3"
            >
                <div style={noDragStyle}>
                    {connectedIds.length > 0 ? (
                        <Badge
                            variant="secondary"
                            className="bg-accent text-accent-foreground hover:bg-accent/90 border-none uppercase tracking-widest text-[9px] gap-1.5 flex py-0.5 px-2"
                        >
                            <Circle className="size-1.5 fill-current stroke-none animate-pulse" />
                            {connectedIds.length} connected
                        </Badge>
                    ) : (
                        <Badge
                            variant="outline"
                            className="border-border/50 text-muted-foreground bg-muted/5 uppercase tracking-widest text-[9px] py-0.5 px-2"
                        >
                            No connections
                        </Badge>
                    )}
                </div>
            </div>
        </header>
    );
};
export default TitleBar;
