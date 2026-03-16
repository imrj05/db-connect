import { Search, Command, Circle, Database, ChevronDown, Trash2 } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";

const TitleBar = () => {
    const {
        setCommandPaletteOpen,
        activeConnection,
        connections,
        setActiveConnection,
        deleteConnection,
    } = useAppStore();

    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setDeleteConfirmId(id);
    };

    const confirmDelete = () => {
        if (deleteConfirmId) {
            deleteConnection(deleteConfirmId);
            toast.success("Connection deleted");
            setDeleteConfirmId(null);
        }
    };

    return (
        <header className="h-10 bg-titlebar-bg border-b border-border-app flex items-center justify-between px-3 select-none tauri-drag-region">
            {/* Left: Navigation & Connections */}
            <div className="flex items-center gap-4 flex-1">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <div className="flex items-center gap-2 text-text-muted hover:text-text-primary cursor-pointer transition-colors ml-1 group">
                            <div className="flex items-center justify-center size-6 hover:bg-white/5 rounded transition-colors group-data-[state=open]:bg-white/10">
                                <Database
                                    size={14}
                                    className={cn(
                                        activeConnection
                                            ? "text-blue-500"
                                            : "text-text-muted",
                                    )}
                                />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">
                                {activeConnection
                                    ? activeConnection.name
                                    : "Connect"}
                            </span>
                            <ChevronDown size={10} className="opacity-50" />
                        </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                        <DropdownMenuLabel className="text-[10px] uppercase tracking-widest opacity-50">
                            Saved Connections
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {connections.length === 0 && (
                            <div className="px-2 py-4 text-center">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
                                    No saved connections
                                </p>
                            </div>
                        )}
                        {connections.map((conn) => (
                            <DropdownMenuItem
                                key={conn.id}
                                onClick={() => setActiveConnection(conn)}
                                className="flex items-center justify-between group cursor-pointer"
                            >
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <div
                                        className={cn(
                                            "size-2 rounded-full shrink-0",
                                            activeConnection?.id === conn.id
                                                ? "bg-emerald-500"
                                                : "bg-zinc-600",
                                        )}
                                    />
                                    <span className="text-xs font-semibold truncate">
                                        {conn.name}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                    <Badge
                                        variant="outline"
                                        className="text-[8px] py-0 px-1 opacity-50 group-hover:opacity-100 uppercase tracking-tighter"
                                    >
                                        {conn.type.substring(0, 3)}
                                    </Badge>
                                    <button
                                        onClick={(e) => handleDelete(e, conn.id)}
                                        className="p-1 hover:bg-red-500/10 hover:text-red-500 rounded text-text-muted transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                        <Trash2 size={11} />
                                    </button>
                                </div>
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
                    <AlertDialogContent className="max-w-[320px] bg-zinc-900 border-zinc-800">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="text-sm font-bold uppercase tracking-widest text-text-primary">
                                Delete Connection?
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-xs text-text-muted leading-relaxed">
                                This will permanently remove this connection from your saved list.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="mt-4 gap-2">
                            <AlertDialogCancel className="h-8 text-[10px] font-bold uppercase tracking-widest bg-transparent border-white/5 hover:bg-white/5">
                                Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                                onClick={confirmDelete}
                                className="h-8 text-[10px] font-bold uppercase tracking-widest bg-red-600 hover:bg-red-500 text-white border-none"
                            >
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <div className="h-4 w-px bg-border-app/50 mx-1" />

                <div className="flex items-center gap-2 text-text-muted hover:text-text-primary cursor-pointer transition-colors">
                    <div className="flex items-center justify-center size-6 hover:bg-white/5 rounded transition-colors">
                        <Command size={14} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">
                        Back
                    </span>
                </div>
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
                        Search tables...
                    </span>
                    <div className="ml-auto flex items-center gap-0.5 opacity-20 group-hover:opacity-50 transition-opacity">
                        <span className="text-[9px] font-black">⌘K</span>
                    </div>
                </div>
            </div>

            {/* Right: Status Indicators */}
            <div className="flex items-center justify-end gap-2 flex-1 text-[9px] font-bold">
                {activeConnection ? (
                    <>
                        <Badge
                            variant="secondary"
                            className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-none uppercase tracking-widest text-[9px] gap-1.5 flex py-0.5 px-2"
                        >
                            <Circle className="size-1.5 fill-current stroke-none animate-pulse" />
                            Connected
                        </Badge>

                        <Badge
                            variant="outline"
                            className="border-blue-500/20 text-blue-400 bg-blue-500/5 uppercase tracking-widest text-[9px] py-0.5 px-2"
                        >
                            {activeConnection.type.toUpperCase()}
                        </Badge>

                        <Badge
                            variant="outline"
                            className={cn(
                                "uppercase tracking-widest text-[9px] py-0.5 px-2",
                                activeConnection.ssl
                                    ? "border-emerald-500/20 text-emerald-400 bg-emerald-500/5"
                                    : "border-border-app/50 text-text-muted bg-zinc-500/5",
                            )}
                        >
                            SSL: {activeConnection.ssl ? "YES" : "NO"}
                        </Badge>
                    </>
                ) : (
                    <Badge
                        variant="outline"
                        className="border-border-app/50 text-text-muted bg-zinc-500/5 uppercase tracking-widest text-[9px] py-0.5 px-2"
                    >
                        Disconnected
                    </Badge>
                )}
            </div>
        </header>
    );
};

export default TitleBar;
