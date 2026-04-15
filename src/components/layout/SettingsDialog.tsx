import { useEffect, useState } from "react";
import {
    Moon,
    Sun,
    Palette,
    Code2,
    Table2,
    HardDrive,
    Info,
    Trash2,
    FolderOpen,
    KeyRound,
    ShieldCheck,
    ShieldOff,
    CalendarClock,
    Cpu,
    RefreshCw,
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useAppStore, AppSettings } from "@/store/useAppStore";
import { tauriApi } from "@/lib/tauri-api";
import { licenseGetStored, licenseDeactivate, type StoredLicenseState } from "@/lib/license";
import packageJson from "../../../package.json";

// ── Section nav ───────────────────────────────────────────────────────────────

type Section = "appearance" | "editor" | "table" | "storage" | "license" | "about";

const NAV: { id: Section; label: string; icon: React.ReactNode }[] = [
    { id: "appearance", label: "Appearance", icon: <Palette size={13} /> },
    { id: "editor",     label: "Editor",     icon: <Code2 size={13} /> },
    { id: "table",      label: "Table",      icon: <Table2 size={13} /> },
    { id: "storage",    label: "Storage",    icon: <HardDrive size={13} /> },
    { id: "license",    label: "License",    icon: <KeyRound size={13} /> },
    { id: "about",      label: "About",      icon: <Info size={13} /> },
];

// ── Small reusable pieces ──────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
    return (
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground/40 mb-3">
            {children}
        </p>
    );
}

function SettingRow({
    label,
    description,
    children,
}: {
    label: string;
    description?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex items-center justify-between gap-6 py-3 border-b border-border/40 last:border-0">
            <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-foreground leading-tight">{label}</p>
                {description && (
                    <p className="text-[11px] text-muted-foreground/50 mt-0.5 leading-snug">{description}</p>
                )}
            </div>
            <div className="shrink-0">{children}</div>
        </div>
    );
}

function SegmentedControl<T extends string | number>({
    options,
    value,
    onChange,
    format,
}: {
    options: T[];
    value: T;
    onChange: (v: T) => void;
    format?: (v: T) => string;
}) {
    return (
        <div className="flex items-center gap-0.5 bg-muted/50 border border-border/50 rounded-lg p-0.5">
            {options.map((opt) => (
                <button
                    key={String(opt)}
                    onClick={() => onChange(opt)}
                    className={cn(
                        "px-2.5 h-6 rounded-md text-[11px] font-bold transition-colors",
                        value === opt
                            ? "bg-background shadow-sm text-foreground border border-border/60"
                            : "text-muted-foreground/60 hover:text-muted-foreground",
                    )}
                >
                    {format ? format(opt) : String(opt)}
                </button>
            ))}
        </div>
    );
}

// ── Section content ────────────────────────────────────────────────────────────

function AppearanceSection() {
    const { theme, setTheme, appSettings, updateAppSetting } = useAppStore();

    return (
        <div>
            <SectionHeading>Appearance</SectionHeading>
            <SettingRow label="Theme" description="Choose your preferred colour scheme">
                <div className="flex items-center gap-1 bg-muted/50 border border-border/60 rounded-lg p-0.5">
                    {(["dark", "light"] as const).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTheme(t)}
                            className={cn(
                                "flex items-center gap-1.5 h-7 px-3 rounded-md text-[11px] font-bold transition-all capitalize",
                                theme === t
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "text-muted-foreground/60 hover:text-foreground",
                            )}
                        >
                            {t === "dark" ? <Moon size={11} /> : <Sun size={11} />}
                            {t}
                        </button>
                    ))}
                </div>
            </SettingRow>
            <SettingRow label="UI Zoom" description="Scale the entire interface up or down">
                <SegmentedControl<AppSettings["uiZoom"]>
                    options={[100, 110, 125, 140, 150]}
                    value={appSettings.uiZoom}
                    onChange={(v) => updateAppSetting("uiZoom", v)}
                    format={(v) => `${v}%`}
                />
            </SettingRow>
        </div>
    );
}

function EditorSection() {
    const { appSettings, updateAppSetting } = useAppStore();

    return (
        <div>
            <SectionHeading>Editor</SectionHeading>
            <SettingRow
                label="Font Size"
                description="Size of text in the SQL editor"
            >
                <SegmentedControl<AppSettings["editorFontSize"]>
                    options={[12, 13, 14, 16]}
                    value={appSettings.editorFontSize}
                    onChange={(v) => updateAppSetting("editorFontSize", v)}
                    format={(v) => `${v}px`}
                />
            </SettingRow>
        </div>
    );
}

function TableSection() {
    const { appSettings, updateAppSetting } = useAppStore();

    return (
        <div>
            <SectionHeading>Table</SectionHeading>
            <SettingRow
                label="Rows per Page"
                description="Number of rows fetched per page in table view"
            >
                <SegmentedControl<AppSettings["tablePageSize"]>
                    options={[25, 50, 100, 200]}
                    value={appSettings.tablePageSize}
                    onChange={(v) => updateAppSetting("tablePageSize", v)}
                />
            </SettingRow>
        </div>
    );
}

function StorageSection() {
    const { clearAllHistory, clearAllSavedQueries, savedQueries, queryHistory, connections } =
        useAppStore();
    const [dataDir, setDataDir] = useState<string | null>(null);
    const [confirmClear, setConfirmClear] = useState<"history" | "queries" | null>(null);

    useEffect(() => {
        tauriApi.getAppDataDir().then(setDataDir).catch(() => {});
    }, []);

    const totalHistory = queryHistory.length;

    const handleClear = (type: "history" | "queries") => {
        if (confirmClear === type) {
            if (type === "history") clearAllHistory();
            else clearAllSavedQueries();
            setConfirmClear(null);
        } else {
            setConfirmClear(type);
            setTimeout(() => setConfirmClear(null), 3000);
        }
    };

    return (
        <div className="space-y-1">
            <SectionHeading>Storage</SectionHeading>

            {/* Data directory */}
            <div className="py-2.5 space-y-1.5">
                <p className="text-[12px] font-semibold text-foreground">Data Location</p>
                <p className="text-[11px] text-muted-foreground/50">
                    Connections and saved queries are stored here, encrypted.
                </p>
                {dataDir && (
                    <div className="flex items-center gap-2 mt-1.5 px-2.5 py-1.5 rounded-lg bg-muted/40 border border-border/50">
                        <FolderOpen size={11} className="text-muted-foreground/40 shrink-0" />
                        <span className="text-[10px] font-mono text-muted-foreground/60 truncate">
                            {dataDir}
                        </span>
                    </div>
                )}
            </div>

            <Separator className="my-1" />

            {/* Stats */}
            <div className="py-2.5 grid grid-cols-3 gap-3">
                {[
                    { label: "Connections", value: connections.length },
                    { label: "Saved Queries", value: savedQueries.length },
                    { label: "History Entries", value: totalHistory },
                ].map((stat) => (
                    <div
                        key={stat.label}
                        className="flex flex-col items-center gap-0.5 py-2 rounded-xl bg-muted/30 border border-border/40"
                    >
                        <span className="text-[18px] font-black tabular-nums text-foreground">
                            {stat.value}
                        </span>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">
                            {stat.label}
                        </span>
                    </div>
                ))}
            </div>

            <Separator className="my-1" />

            {/* Clear actions */}
            <SettingRow
                label="Query History"
                description={`${totalHistory} entries across all connections`}
            >
                <Button
                    variant={confirmClear === "history" ? "destructive" : "outline"}
                    size="xs"
                    onClick={() => handleClear("history")}
                    className="gap-1.5 text-[10px] font-bold uppercase tracking-wider h-7"
                    disabled={totalHistory === 0}
                >
                    <Trash2 size={10} />
                    {confirmClear === "history" ? "Confirm?" : "Clear"}
                </Button>
            </SettingRow>

            <SettingRow
                label="Saved Queries"
                description={`${savedQueries.length} saved queries`}
            >
                <Button
                    variant={confirmClear === "queries" ? "destructive" : "outline"}
                    size="xs"
                    onClick={() => handleClear("queries")}
                    className="gap-1.5 text-[10px] font-bold uppercase tracking-wider h-7"
                    disabled={savedQueries.length === 0}
                >
                    <Trash2 size={10} />
                    {confirmClear === "queries" ? "Confirm?" : "Clear"}
                </Button>
            </SettingRow>
        </div>
    );
}

function LicenseSection({ onActivate }: { onActivate: () => void }) {
    const [state, setState] = useState<StoredLicenseState | null | "loading">("loading");
    const [confirmDeactivate, setConfirmDeactivate] = useState(false);

    useEffect(() => {
        licenseGetStored().then(setState).catch(() => setState(null));
    }, []);

    const handleDeactivate = async () => {
        if (!confirmDeactivate) {
            setConfirmDeactivate(true);
            setTimeout(() => setConfirmDeactivate(false), 3000);
            return;
        }
        await licenseDeactivate().catch(() => {});
        setState(null);
        setConfirmDeactivate(false);
    };

    if (state === "loading") {
        return (
            <div>
                <SectionHeading>License</SectionHeading>
                <div className="flex items-center gap-2 py-6 text-muted-foreground/40">
                    <RefreshCw size={13} className="animate-spin" />
                    <span className="text-[12px]">Loading…</span>
                </div>
            </div>
        );
    }

    if (!state) {
        return (
            <div>
                <SectionHeading>License</SectionHeading>
                <div className="flex flex-col items-center gap-4 py-8 text-center">
                    <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-muted/50 border border-border/50">
                        <ShieldOff size={20} className="text-muted-foreground/30" />
                    </div>
                    <div>
                        <p className="text-[13px] font-semibold text-foreground">Not activated</p>
                        <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                            Activate a license key to unlock all features.
                        </p>
                    </div>
                    <Button size="sm" className="gap-2" onClick={onActivate}>
                        <KeyRound size={12} />
                        Activate License
                    </Button>
                </div>
            </div>
        );
    }

    const { license, activation } = state;

    const maskedKey = license.license_key.replace(
        /^(DBK-[A-Z0-9]{4}-)([A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4})$/,
        (_, prefix) => prefix + "****-****-****",
    );

    const formatDate = (iso: string) => {
        try {
            return new Date(iso).toLocaleDateString(undefined, {
                year: "numeric", month: "short", day: "numeric",
            });
        } catch { return iso; }
    };

    const formatDateTime = (iso: string | null) => {
        if (!iso) return "Never";
        try {
            return new Date(iso).toLocaleString(undefined, {
                year: "numeric", month: "short", day: "numeric",
                hour: "2-digit", minute: "2-digit",
            });
        } catch { return iso; }
    };

    const isExpired = new Date(license.expiry) < new Date();
    const planColors: Record<string, string> = {
        pro:      "bg-primary/10 text-primary border-primary/20",
        starter:  "bg-blue-500/10 text-blue-500 border-blue-500/20",
        lifetime: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    };
    const planColor = planColors[license.plan.toLowerCase()] ?? "bg-muted/50 text-muted-foreground border-border/50";

    return (
        <div>
            <SectionHeading>License</SectionHeading>

            {/* Status bar */}
            <div className={cn(
                "flex items-center gap-2.5 px-3 py-2.5 rounded-xl border mb-4",
                isExpired
                    ? "bg-destructive/10 border-destructive/20 text-destructive"
                    : "bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400",
            )}>
                {isExpired
                    ? <ShieldOff size={14} className="shrink-0" />
                    : <ShieldCheck size={14} className="shrink-0" />}
                <span className="text-[12px] font-semibold">
                    {isExpired ? "License expired" : "License active"}
                </span>
                <span className={cn(
                    "ml-auto px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border",
                    planColor,
                )}>
                    {license.plan}
                </span>
            </div>

            {/* Details */}
            <div className="space-y-0">
                <SettingRow label="License Key">
                    <span className="text-[11px] font-mono text-muted-foreground/70 tracking-wider">
                        {maskedKey}
                    </span>
                </SettingRow>

                <SettingRow label="Email">
                    <span className="text-[11px] font-mono text-muted-foreground/70">
                        {license.email}
                    </span>
                </SettingRow>

                <SettingRow
                    label="Expires"
                    description={isExpired ? "Renew your license to continue." : undefined}
                >
                    <span className={cn(
                        "flex items-center gap-1.5 text-[11px] font-mono",
                        isExpired ? "text-destructive" : "text-muted-foreground/70",
                    )}>
                        <CalendarClock size={11} className="shrink-0" />
                        {formatDate(license.expiry)}
                    </span>
                </SettingRow>

                <SettingRow label="Max Devices">
                    <span className="text-[11px] font-mono text-muted-foreground/70">
                        {license.max_devices}
                    </span>
                </SettingRow>

                <SettingRow label="Device ID">
                    <span className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground/70">
                        <Cpu size={11} className="shrink-0" />
                        {activation.device_id.slice(0, 8)}…
                    </span>
                </SettingRow>

                <SettingRow label="Last Validated">
                    <span className="text-[11px] text-muted-foreground/60">
                        {formatDateTime(activation.last_validated_at)}
                    </span>
                </SettingRow>
            </div>

            <Separator className="my-4" />

            {/* Actions */}
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-[12px] font-semibold text-foreground">Deactivate</p>
                    <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                        Frees this device slot so you can activate on another machine.
                    </p>
                </div>
                <Button
                    variant={confirmDeactivate ? "destructive" : "outline"}
                    size="xs"
                    onClick={handleDeactivate}
                    className="gap-1.5 text-[10px] font-bold uppercase tracking-wider h-7 shrink-0"
                >
                    <ShieldOff size={10} />
                    {confirmDeactivate ? "Confirm?" : "Deactivate"}
                </Button>
            </div>
        </div>
    );
}

function AboutSection() {
    return (
        <div>
            <SectionHeading>About</SectionHeading>

            {/* App identity */}
            <div className="flex items-center gap-4 py-3">
                <div className="size-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Table2 size={22} className="text-primary" />
                </div>
                <div>
                    <p className="text-[15px] font-black text-foreground">DB Connect</p>
                    <p className="text-[11px] text-muted-foreground/60">Version {packageJson.version}</p>
                </div>
            </div>

            <Separator className="my-3" />

            {/* Stack */}
            <div className="space-y-1.5">
                {[
                    ["Built with", "Tauri 2 · React 19 · TypeScript"],
                    ["UI",         "Tailwind CSS v4 · shadcn/ui"],
                    ["Database",   "SQLx · sqlx-sqlite · AES-256-GCM"],
                    ["Editor",     "CodeMirror 6"],
                    ["Grid",       "TanStack Table v8"],
                ].map(([label, value]) => (
                    <div key={label} className="flex items-baseline gap-2 py-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 w-20 shrink-0">
                            {label}
                        </span>
                        <span className="text-[11px] font-mono text-muted-foreground/70">
                            {value}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Main dialog ───────────────────────────────────────────────────────────────

export function SettingsDialog({ onActivate }: { onActivate?: () => void }) {
    const { settingsOpen, setSettingsOpen } = useAppStore();
    const [activeSection, setActiveSection] = useState<Section>("appearance");

    return (
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogHeader className="sr-only">
                <DialogTitle>Settings</DialogTitle>
                <DialogDescription>Configure DB Connect preferences</DialogDescription>
            </DialogHeader>
            <DialogContent className="w-[50vw]! max-w-[50vw]! h-[60vh]! max-h-[60vh]! p-0 gap-0 overflow-hidden rounded-2xl">
                <div className="flex h-full w-full">
                    {/* ── Left nav ── */}
                    <div className="w-48 shrink-0 bg-sidebar border-r border-border flex flex-col py-3 gap-0.5 px-2">
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/35 px-2 pb-2 pt-1">
                            Settings
                        </p>
                        {NAV.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setActiveSection(item.id)}
                                className={cn(
                                    "flex items-center gap-2.5 h-7 px-2.5 rounded-lg text-[12px] font-semibold transition-colors text-left w-full",
                                    activeSection === item.id
                                        ? "bg-primary/10 text-primary"
                                        : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/50",
                                )}
                            >
                                <span className={cn(
                                    "shrink-0",
                                    activeSection === item.id ? "text-primary" : "text-muted-foreground/40",
                                )}>
                                    {item.icon}
                                </span>
                                {item.label}
                            </button>
                        ))}
                    </div>

                    {/* ── Right content ── */}
                    <div className="flex-1 overflow-y-auto px-6 py-5">
                        {activeSection === "appearance" && <AppearanceSection />}
                        {activeSection === "editor"     && <EditorSection />}
                        {activeSection === "table"      && <TableSection />}
                        {activeSection === "storage"    && <StorageSection />}
                        {activeSection === "license"    && (
                            <LicenseSection onActivate={() => {
                                setSettingsOpen(false);
                                onActivate?.();
                            }} />
                        )}
                        {activeSection === "about"      && <AboutSection />}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
