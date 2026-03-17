import { Search, Circle } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { Badge } from "@/components/ui/badge";

const TitleBar = () => {
    const {
        setCommandPaletteOpen,
        activeFunction,
        connectedIds,
    } = useAppStore();

    return (
        <header className="h-10 bg-titlebar-bg border-b border-border-app flex items-center justify-between px-3 select-none tauri-drag-region">
            {/* Left: Active function display */}
            <div className="flex items-center gap-3 flex-1">
                {activeFunction ? (
                    <span className="font-mono text-[11px] text-blue-400 font-bold tracking-tight ml-1">
                        &gt; {activeFunction.callSignature}
                    </span>
                ) : (
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted/60 ml-1">
                        DB Connect
                    </span>
                )}
            </div>

            {/* Center: Search / Palette Trigger */}
            <div className="flex items-center justify-center flex-1">
                <div
                    onClick={() => setCommandPaletteOpen(true)}
                    className="flex items-center gap-2 px-3 py-1 bg-input-bg/50 border border-border-input/50 rounded-md text-text-muted hover:text-text-secondary cursor-pointer transition-all w-72 group"
                >
                    <Search
                        size={11}
                        className="group-hover:text-blue-500 transition-colors"
                    />
                    <span className="text-[10px] font-bold uppercase tracking-tighter">
                        Search functions...
                    </span>
                    <div className="ml-auto flex items-center gap-0.5 opacity-20 group-hover:opacity-50 transition-opacity">
                        <span className="text-[9px] font-black">⌘K</span>
                    </div>
                </div>
            </div>

            {/* Right: Connection count status */}
            <div className="flex items-center justify-end gap-2 flex-1 text-[9px] font-bold">
                {connectedIds.length > 0 ? (
                    <Badge
                        variant="secondary"
                        className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-none uppercase tracking-widest text-[9px] gap-1.5 flex py-0.5 px-2"
                    >
                        <Circle className="size-1.5 fill-current stroke-none animate-pulse" />
                        {connectedIds.length} connected
                    </Badge>
                ) : (
                    <Badge
                        variant="outline"
                        className="border-border-app/50 text-text-muted bg-zinc-500/5 uppercase tracking-widest text-[9px] py-0.5 px-2"
                    >
                        No connections
                    </Badge>
                )}
            </div>
        </header>
    );
};

export default TitleBar;
