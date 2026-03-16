import { useEffect } from "react";
import { ChevronDown, Database, Plus, Search, Loader2 } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { tauriApi } from "@/lib/tauri-api";
import {
    Combobox,
    ComboboxInput,
    ComboboxContent,
    ComboboxList,
    ComboboxEmpty,
    ComboboxItem,
} from "@/components/ui/combobox";

import { toast } from "sonner";

const Sidebar = () => {
    const {
        activeConnection,
        activeDatabase,
        setActiveDatabase,
        databases,
        setDatabases,
        tables,
        setTables,
        isLoading,
        setLoading,
        activeTable,
        setActiveTable,
        setConnectionDialogOpen,
        activeTabId,
        setTabResults,
        openTableTab,
        queryTabs,
    } = useAppStore();

    // Handle connection and fetch databases when activeConnection changes
    useEffect(() => {
        let isMounted = true;
        if (activeConnection) {
            console.log("Sidebar: Connecting to", activeConnection.name);
            setLoading(true);
            tauriApi
                .connect(activeConnection)
                .then(async () => {
                    console.log("Sidebar: Connected, fetching databases...");
                    const dbs = await tauriApi.getDatabases(
                        activeConnection.id,
                    );
                    console.log("Sidebar: Databases received:", dbs);
                    if (!isMounted) return;

                    setDatabases(dbs);

                    // If there are databases, ensure one is selected
                    if (dbs.length > 0) {
                        const targetDb =
                            activeDatabase && dbs.includes(activeDatabase)
                                ? activeDatabase
                                : activeConnection.database &&
                                    dbs.includes(activeConnection.database)
                                    ? activeConnection.database
                                    : dbs[0];

                        if (targetDb !== activeDatabase) {
                            setActiveDatabase(targetDb);
                        }
                    }
                })
                .catch((err) => {
                    if (isMounted) {
                        console.error("Connection error:", err);
                        toast.error(`Connection failed: ${err}`);
                    }
                })
                .finally(() => {
                    if (isMounted) setLoading(false);
                });
        }
        return () => {
            isMounted = false;
        };
    }, [activeConnection?.id]);

    // Fetch tables when database changes
    useEffect(() => {
        let isMounted = true;
        if (activeConnection && activeDatabase) {
            console.log("Sidebar: Fetching tables for", activeDatabase);
            setLoading(true);
            setTables([]); // Clear current tables while loading
            tauriApi
                .getTables(activeConnection.id, activeDatabase)
                .then((newTables) => {
                    console.log("Sidebar: Tables received:", newTables.length);
                    if (isMounted) setTables(newTables);
                })
                .catch((err) => {
                    if (isMounted) {
                        console.error("Tables fetch error:", err);
                        toast.error(`Failed to fetch tables: ${err}`);
                    }
                })
                .finally(() => {
                    if (isMounted) setLoading(false);
                });
        }
        return () => {
            isMounted = false;
        };
    }, [activeConnection?.id, activeDatabase]);

    // Fetch table data when table is selected
    useEffect(() => {
        const activeTab = queryTabs.find((t) => t.id === activeTabId);
        const isTableTabMissingData =
            activeTab?.type === "table" &&
            activeTab.tableName === activeTable &&
            !activeTab.results;

        if (
            activeConnection &&
            activeDatabase &&
            activeTable &&
            activeTabId &&
            isTableTabMissingData
        ) {
            console.log("Sidebar: Fetching data for table", activeTable);
            setLoading(true);
            tauriApi
                .getTableData(activeConnection.id, activeDatabase, activeTable)
                .then((results) => {
                    console.log("Sidebar: Table results received", results);
                    setTabResults(activeTabId, results);
                })
                .catch((err) => {
                    console.error("Sidebar: Error fetching table data", err);
                    toast.error(`Failed to load table data: ${err}`);
                })
                .finally(() => setLoading(false));
        }
    }, [
        activeConnection?.id,
        activeDatabase,
        activeTable,
        activeTabId,
        queryTabs.length,
    ]);

    if (!activeConnection) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center bg-sidebar-bg">
                <Plus size={32} className="text-text-muted mb-4 opacity-20" />
                <p className="text-xs font-bold text-text-muted uppercase tracking-widest">
                    No Active Connection
                </p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-sidebar-bg border-r border-border-sidebar overflow-hidden w-full">
            {/* Sidebar Header */}
            <div className="p-4 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <div className="size-6 bg-blue-600 shrink-0 rounded flex items-center justify-center font-bold text-white text-[10px]">
                            {(activeConnection.type || "")
                                .substring(0, 2)
                                .toUpperCase()}
                        </div>
                        <span className="text-sm font-bold tracking-tight truncate">
                            {activeConnection.name}
                        </span>
                    </div>
                    <Plus
                        size={14}
                        className="text-text-muted cursor-pointer hover:text-text-primary shrink-0"
                        onClick={() => setConnectionDialogOpen(true)}
                    />
                </div>

                {/* Database Selector */}
                <div className="px-0 relative group">
                    <Combobox
                        value={activeDatabase || ""}
                        onValueChange={(val) =>
                            setActiveDatabase(val as string)
                        }
                    >
                        <ComboboxInput
                            placeholder="Select Database..."
                            className="w-full h-9 bg-black/20 hover:bg-black/30 border-none text-[11px] font-bold uppercase tracking-wider text-text-secondary placeholder:text-text-muted/50 rounded-lg transition-all"
                            showTrigger
                        />
                        <ComboboxContent className="bg-popover border border-white/5 shadow-2xl overflow-hidden rounded-xl min-w-50">
                            <ComboboxList className="p-1 max-h-75">
                                <ComboboxEmpty className="py-6 text-[11px] font-bold uppercase tracking-widest text-text-muted">
                                    No databases found
                                </ComboboxEmpty>
                                {databases.map((db) => (
                                    <ComboboxItem
                                        key={db}
                                        value={db}
                                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest data-highlighted:bg-blue-500/10 data-highlighted:text-blue-400 cursor-pointer transition-colors"
                                    >
                                        <Database
                                            size={12}
                                            className="opacity-50"
                                        />
                                        {db}
                                    </ComboboxItem>
                                ))}
                            </ComboboxList>
                        </ComboboxContent>
                    </Combobox>
                </div>

                {/* Local Navigation Tabs */}
                <div className="flex p-0.5 bg-black/10 rounded-md">
                    <button className="flex-1 flex items-center justify-center gap-2 py-1 bg-white dark:bg-zinc-800 rounded shadow-sm text-[10px] font-bold uppercase transition-all">
                        <Database size={12} />
                        Schema
                    </button>
                    <button className="flex-1 flex items-center justify-center gap-2 py-1 text-text-muted text-[10px] font-bold uppercase hover:text-text-secondary transition-all">
                        <ChevronDown size={12} className="-rotate-90" />
                        Queries
                    </button>
                </div>

                {/* Search */}
                <div className="relative group">
                    <Search
                        size={12}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-blue-500 transition-colors"
                    />
                    <input
                        placeholder="Filter explorer..."
                        className="w-full bg-input-bg border border-border-input rounded-md pl-8 pr-3 py-1.5 text-[11px] outline-none focus:border-blue-500/50 transition-all font-medium"
                    />
                </div>
            </div>

            {/* Explorer Content */}
            <div className="flex-1 overflow-y-auto scrollbar-thin px-2">
                <div className="mb-4">
                    <div className="flex items-center justify-between px-2 mb-2">
                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
                            {isLoading ? (
                                <Loader2 size={10} className="animate-spin" />
                            ) : (
                                `${tables.length} objects`
                            )}
                        </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                        {tables.map((table) => (
                            <div key={table.name} className="group">
                                <div
                                    onClick={() => {
                                        setActiveTable(
                                            activeTable === table.name
                                                ? null
                                                : table.name,
                                        );
                                        openTableTab(table.name);
                                    }}
                                    className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-all ${activeTable === table.name ? "bg-sidebar-item-active text-sidebar-active" : "hover:bg-sidebar-item-hover text-text-secondary hover:text-text-primary"}`}
                                >
                                    <ChevronDown
                                        size={12}
                                        className={
                                            activeTable === table.name
                                                ? ""
                                                : "-rotate-90 text-text-muted"
                                        }
                                    />
                                    <Database
                                        size={13}
                                        className={
                                            activeTable === table.name
                                                ? "text-blue-400"
                                                : "text-text-muted"
                                        }
                                    />
                                    <span className="text-[11px] font-semibold flex-1 truncate">
                                        {table.name}
                                    </span>
                                </div>
                                {activeTable === table.name &&
                                    table.columns && (
                                        <div className="ml-6 mt-1 flex flex-col gap-1 mb-2">
                                            {table.columns.map((col) => (
                                                <div
                                                    key={col.name}
                                                    className="flex items-center justify-between pr-2 py-0.5 group/item cursor-default"
                                                >
                                                    <span className="text-[10px] font-medium text-text-muted group-hover/item:text-text-secondary truncate">
                                                        {col.name}
                                                    </span>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[9px] font-mono text-zinc-500 uppercase">
                                                            {col.type}
                                                        </span>
                                                        {col.isPrimary && (
                                                            <span className="text-[8px] px-1 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded font-black leading-none py-0.5">
                                                                PK
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Sidebar;
