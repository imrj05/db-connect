import { useEffect, useState } from "react";
import {
    Shield,
    Globe,
    Database,
    Key,
    Server,
    Tag,
    Loader2,
    FileText,
    CheckCircle2,
    Trash2,
    Hash,
    Wifi,
    WifiOff,
    Eye,
    EyeOff,
    ChevronRight,
    Zap,
    Layers,
    Laptop,
    Code2,
    FlaskConical,
    TestTube,
    X,
    Link2,
    Terminal,
    FolderOpen,
} from "lucide-react";
import { ConnectionConfig } from "@/types";
import { useAppStore } from "@/store/useAppStore";
import { tauriApi } from "@/lib/tauri-api";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { suggestPrefix } from "@/lib/db-functions";

import {
    SiPostgresql,
    SiMysql,
    SiSqlite,
    SiMongodb,
    SiRedis,
} from "react-icons/si";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ConnectionDialogProps {
    onClose: () => void;
    initialData?: ConnectionConfig;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const ENGINE_DEFAULTS: Record<string, Partial<ConnectionConfig>> = {
    postgresql: {
        host: "localhost",
        port: 5432,
        user: "postgres",
        database: "postgres",
    },
    mysql: { host: "localhost", port: 3306, user: "root", database: "mysql" },
    sqlite: { database: "local.sqlite" },
    mongodb: { uri: "mongodb://localhost:27017" },
    redis: { host: "localhost", port: 6379 },
};

const QUICK_PRESETS = [
    { label: "Local PG",    engine: "postgresql" as const, name: "Local PostgreSQL", host: "localhost", port: 5432, user: "postgres",  database: "postgres" },
    { label: "Local MySQL", engine: "mysql"      as const, name: "Local MySQL",      host: "localhost", port: 3306, user: "root",       database: "mysql" },
    { label: "SQLite",      engine: "sqlite"     as const, name: "Local SQLite",     database: "local.sqlite" },
    { label: "MongoDB",     engine: "mongodb"    as const, name: "Local MongoDB",    uri: "mongodb://localhost:27017" },
    { label: "Redis",       engine: "redis"      as const, name: "Local Redis",      host: "localhost", port: 6379 },
];

const DB_LOGOS: Record<string, React.FC<{ className?: string }>> = {
    postgresql: ({ className }) => <SiPostgresql className={className} />,
    mysql: ({ className }) => <SiMysql className={className} />,
    sqlite: ({ className }) => <SiSqlite className={className} />,
    mongodb: ({ className }) => <SiMongodb className={className} />,
    redis: ({ className }) => <SiRedis className={className} />,
};

// ── Group presets ──────────────────────────────────────────────────────────────

export const GROUP_PRESETS: {
    id: string;
    label: string;
    icon: React.FC<{ size?: number; className?: string }>;
    color: string;
    activeClass: string;
}[] = [
    { id: "local",   label: "local",   icon: Laptop,        color: "text-sky-400",    activeClass: "border-sky-400/50 bg-sky-400/10 text-sky-400" },
    { id: "dev",     label: "dev",     icon: Code2,         color: "text-cyan-400",   activeClass: "border-cyan-400/50 bg-cyan-400/10 text-cyan-400" },
    { id: "staging", label: "staging", icon: FlaskConical,  color: "text-amber-400",  activeClass: "border-amber-400/50 bg-amber-400/10 text-amber-400" },
    { id: "prod",    label: "prod",    icon: Globe,         color: "text-emerald-400",activeClass: "border-emerald-400/50 bg-emerald-400/10 text-emerald-400" },
    { id: "testing", label: "testing", icon: TestTube,      color: "text-purple-400", activeClass: "border-purple-400/50 bg-purple-400/10 text-purple-400" },
];

// ── Engine definitions ─────────────────────────────────────────────────────────

const DATABASE_ENGINES = [
    { id: "postgresql", label: "PostgreSQL", description: "Advanced open source RDBMS" },
    { id: "mysql",      label: "MySQL",      description: "Most popular open source DB" },
    { id: "sqlite",     label: "SQLite",     description: "Lightweight embedded database" },
    { id: "mongodb",    label: "MongoDB",    description: "Flexible document database" },
    { id: "redis",      label: "Redis",      description: "In-memory data structure store" },
] as const;

// ── Sub-components ─────────────────────────────────────────────────────────────

function FormLabel({
    children,
    required,
}: {
    children: React.ReactNode;
    required?: boolean;
}) {
    return (
        <Label className="block text-[10px] font-label font-bold uppercase tracking-widest text-muted-foreground/70 mb-1.5">
            {children}
            {required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
    );
}

function ConnectionUrlPreview({
    formData,
}: {
    formData: Partial<ConnectionConfig>;
}) {
    const url = (() => {
        const { type, host, port, user, database, uri } = formData;
        if (type === "mongodb") return uri || "mongodb://localhost:27017";
        if (type === "sqlite") return `sqlite://${database || "local.sqlite"}`;
        if (type === "redis")
            return `redis://${host || "localhost"}:${port || 6379}/0`;
        const scheme = type === "mysql" ? "mysql" : "postgres";
        return `${scheme}://${user || "user"}:****@${host || "localhost"}:${port || 5432}/${database || "db"}`;
    })();

    return (
        <div className="bg-muted/20 border border-border rounded-lg px-3 py-2 flex items-center gap-2">
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 shrink-0">
                URL
            </span>
            <span className="text-[11px] font-mono text-muted-foreground/60 truncate">
                {url}
            </span>
        </div>
    );
}

// ── Main component ─────────────────────────────────────────────────────────────

const ConnectionDialog = ({ onClose, initialData }: ConnectionDialogProps) => {
    const {
        connections,
        addConnection,
        setConnections,
        deleteConnection,
        connectAndInit,
        isLoading,
    } = useAppStore();

    const [customGroup, setCustomGroup] = useState(
        initialData?.group && !GROUP_PRESETS.find(p => p.id === initialData.group)
            ? initialData.group
            : ""
    );
    const [isTesting, setIsTesting] = useState(false);
    const [testStatus, setTestStatus] = useState<"idle" | "success" | "error">("idle");
    const [showPassword, setShowPassword] = useState(false);
    const [prefixManuallyEdited, setPrefixManuallyEdited] = useState(!!initialData?.prefix);
    const [uriInput, setUriInput] = useState("");
    const [isParsingUri, setIsParsingUri] = useState(false);

    const [formData, setFormData] = useState<Partial<ConnectionConfig>>(
        initialData || {
            name: "",
            prefix: "",
            type: "postgresql",
            ...ENGINE_DEFAULTS.postgresql,
            ssl: false,
        },
    );

    const activeEngine =
        DATABASE_ENGINES.find((e) => e.id === formData.type) ?? DATABASE_ENGINES[0];

    useEffect(() => {
        if (!prefixManuallyEdited && formData.name) {
            setFormData((prev) => ({
                ...prev,
                prefix: suggestPrefix(formData.name || ""),
            }));
        }
    }, [formData.name, prefixManuallyEdited]);

    const patch = (partial: Partial<ConnectionConfig>) =>
        setFormData((prev) => ({ ...prev, ...partial }));

    const handleEngineChange = (id: string) => {
        setFormData((prev) => ({
            id: prev.id,
            name: prev.name,
            prefix: prev.prefix,
            ssl: false,
            type: id as any,
            ...(ENGINE_DEFAULTS[id] || {}),
        }));
        setTestStatus("idle");
    };

    const handlePreset = (preset: (typeof QUICK_PRESETS)[number]) => {
        const { label: _label, engine, name, ...fields } = preset;
        setFormData((prev) => ({
            id: prev.id,
            group: prev.group,
            ssl: false,
            type: engine,
            name,
            prefix: suggestPrefix(name),
            ...fields,
        }));
        setPrefixManuallyEdited(true);
        setTestStatus("idle");
    };

    const handleParseUri = async (rawUri?: string) => {
        const uri = (rawUri ?? uriInput).trim();
        if (!uri) return;
        setIsParsingUri(true);
        try {
            const parsed = await tauriApi.parseConnectionUri(uri);
            setFormData((prev) => ({
                ...parsed,
                id: prev.id || parsed.id,
                name: parsed.name || prev.name || "",
                prefix: parsed.prefix || suggestPrefix(parsed.name || ""),
                group: prev.group,
            }));
            setUriInput("");
            setPrefixManuallyEdited(true);
            setTestStatus("idle");
            toast.success("URI parsed");
        } catch (err) {
            toast.error(`Could not parse URI: ${String(err)}`);
        } finally {
            setIsParsingUri(false);
        }
    };

    const buildConfig = (): ConnectionConfig =>
        ({
            ...formData,
            id: formData.id || Math.random().toString(36).substring(7),
            name: formData.name || `Connection ${connections.length + 1}`,
            prefix:
                formData.prefix ||
                suggestPrefix(formData.name || `conn${connections.length + 1}`),
        }) as ConnectionConfig;

    const persistConnection = (config: ConnectionConfig) => {
        if (initialData) {
            setConnections(connections.map((c) => (c.id === initialData.id ? config : c)));
        } else if (connections.find((c) => c.name === config.name)) {
            setConnections(connections.map((c) => (c.name === config.name ? config : c)));
        } else {
            addConnection(config);
        }
    };

    const handleTest = async () => {
        setIsTesting(true);
        setTestStatus("idle");
        try {
            const testConfig = {
                ...formData,
                id: `test-${Math.random().toString(36).substring(7)}`,
                name: formData.name || "Test",
                prefix: formData.prefix || "test",
            } as ConnectionConfig;
            await tauriApi.connect(testConfig);
            await tauriApi.disconnect(testConfig.id);
            setTestStatus("success");
            toast.success("Connection successful");
        } catch (err) {
            setTestStatus("error");
            toast.error(`Connection failed: ${String(err)}`);
        } finally {
            setIsTesting(false);
        }
    };

    const handleSave = async () => {
        const config = buildConfig();
        persistConnection(config);
        toast.success(initialData ? "Connection updated" : "Connection saved");
        onClose();
    };

    const handleConnect = async () => {
        const config = buildConfig();
        persistConnection(config);
        await connectAndInit(config.id);
        onClose();
    };

    const handleDelete = () => {
        if (initialData?.id) {
            deleteConnection(initialData.id);
            toast.success("Connection deleted");
            onClose();
        }
    };

    // ── Render ───────────────────────────────────────────────────────────────────

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                showCloseButton={false}
                className="!max-w-[860px] !w-[860px] !p-0 !gap-0 overflow-hidden bg-card border border-border shadow-2xl rounded-2xl"
            >
                <div className="flex h-[560px]">
                    {/* ── Left panel: engine selector ─────────────────────────────── */}
                    <div className="w-48 shrink-0 bg-muted/20 border-r border-border flex flex-col">
                        {/* Panel header */}
                        <div className="h-14 px-4 flex items-end pb-3 border-b border-border">
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">
                                Engine
                            </span>
                        </div>

                        {/* Engine list */}
                        <div className="flex-1 p-2 space-y-0.5 overflow-y-auto">
                            {DATABASE_ENGINES.map((engine) => {
                                const isActive = formData.type === engine.id;
                                const Logo = DB_LOGOS[engine.id];
                                return (
                                    <button
                                        key={engine.id}
                                        onClick={() => handleEngineChange(engine.id)}
                                        className={cn(
                                            "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-100 text-left group",
                                            isActive
                                                ? "bg-card border border-border shadow-sm"
                                                : "border border-transparent hover:bg-muted/50",
                                        )}
                                    >
                                        <div className={cn(
                                            "size-7 rounded-md flex items-center justify-center shrink-0 transition-all",
                                            isActive ? "bg-muted" : "bg-muted/40 opacity-50 group-hover:opacity-75",
                                        )}>
                                            <Logo className={cn("text-base", isActive ? "text-foreground" : "text-muted-foreground")} />
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className={cn(
                                                "text-[11px] font-semibold leading-none",
                                                isActive ? "text-foreground" : "text-muted-foreground",
                                            )}>
                                                {engine.label}
                                            </div>
                                            <div className="text-[9px] text-muted-foreground/40 mt-0.5 leading-tight truncate">
                                                {engine.description}
                                            </div>
                                        </div>

                                        {isActive && (
                                            <ChevronRight size={11} className="shrink-0 text-muted-foreground/40" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Panel footer */}
                        <div className="p-3 border-t border-border">
                            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-muted/40">
                                {(() => {
                                    const Logo = DB_LOGOS[activeEngine.id];
                                    return <Logo className="text-sm text-muted-foreground/60 shrink-0" />;
                                })()}
                                <span className="text-[10px] font-semibold text-muted-foreground/60 truncate">
                                    {activeEngine.label}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* ── Right panel: form ────────────────────────────────────────── */}
                    <div className="flex-1 flex flex-col min-w-0">
                        {/* Form header */}
                        <div className="h-14 px-6 flex items-center border-b border-border shrink-0">
                            <div>
                                <h2 className="text-sm font-sans font-bold text-foreground">
                                    {initialData ? "Edit Connection" : "New Connection"}
                                </h2>
                                <p className="text-[10px] font-sans text-muted-foreground/50 mt-0.5">
                                    {initialData
                                        ? `Editing ${initialData.name}`
                                        : `Configure your ${activeEngine.label} connection`}
                                </p>
                            </div>
                        </div>

                        {/* Scrollable form body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-5">
                            {/* ── Paste Connection URI ── */}
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <Link2 size={11} className="text-muted-foreground/40 shrink-0" />
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">
                                        Paste Connection URI
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    <Input
                                        value={uriInput}
                                        onChange={(e) => setUriInput(e.target.value)}
                                        placeholder="postgresql://user:pass@host:5432/db"
                                        className="h-8 bg-muted/30 font-mono text-[11px] flex-1"
                                        onPaste={(e) => {
                                            const pasted = e.clipboardData.getData("text").trim();
                                            if (/^(postgresql|postgres|mysql|sqlite|mongodb|redis):/.test(pasted)) {
                                                e.preventDefault();
                                                handleParseUri(pasted);
                                            }
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && uriInput.trim()) {
                                                e.preventDefault();
                                                handleParseUri();
                                            }
                                        }}
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleParseUri()}
                                        disabled={!uriInput.trim() || isParsingUri}
                                        className="h-8 text-[10px] font-bold uppercase tracking-widest shrink-0"
                                    >
                                        {isParsingUri ? <Loader2 size={11} className="animate-spin" /> : "Parse"}
                                    </Button>
                                </div>
                            </div>

                            {/* ── Quick Connect presets ── */}
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <Zap size={11} className="text-muted-foreground/40 shrink-0" />
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">
                                        Quick Connect
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {QUICK_PRESETS.map((preset) => {
                                        const Logo = DB_LOGOS[preset.engine];
                                        return (
                                            <button
                                                key={preset.label}
                                                type="button"
                                                onClick={() => handlePreset(preset)}
                                                className="flex items-center gap-1.5 h-6 px-2.5 rounded-full border border-border bg-muted/50 text-[10px] font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground hover:border-border/80"
                                            >
                                                <Logo className="text-[10px]" />
                                                {preset.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* ── Identity row ── */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <FormLabel required>
                                        <Tag className="inline size-3 mr-1 opacity-60" />
                                        Connection Name
                                    </FormLabel>
                                    <Input
                                        value={formData.name || ""}
                                        onChange={(e) => patch({ name: e.target.value })}
                                        placeholder="e.g. Production Analytics"
                                        className="h-9 bg-muted/30"
                                    />
                                </div>

                                <div>
                                    <FormLabel>
                                        <Hash className="inline size-3 mr-1 opacity-60" />
                                        Function Prefix
                                    </FormLabel>
                                    <div className="flex gap-2">
                                        <Input
                                            value={formData.prefix || ""}
                                            onChange={(e) => {
                                                setPrefixManuallyEdited(true);
                                                patch({ prefix: e.target.value });
                                            }}
                                            placeholder="e.g. prod"
                                            className="h-9 bg-muted/30 font-mono flex-1"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                setPrefixManuallyEdited(false);
                                                patch({ prefix: suggestPrefix(formData.name || "") });
                                            }}
                                            className="h-9 text-[10px] font-bold uppercase tracking-widest shrink-0"
                                        >
                                            Auto
                                        </Button>
                                    </div>
                                    {formData.prefix && (
                                        <p className="mt-1.5 text-[10px] font-mono text-muted-foreground/40">
                                            <span className="text-foreground/50">{formData.prefix}_list()</span>
                                            {" · "}
                                            <span className="text-foreground/50">{formData.prefix}_query()</span>
                                            {" · ..."}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* ── Group field ── */}
                            <div className="space-y-2">
                                <FormLabel>
                                    <Layers className="inline size-3 mr-1 opacity-60" />
                                    Group
                                </FormLabel>
                                {/* Preset pills */}
                                <div className="flex flex-wrap gap-1.5">
                                    {GROUP_PRESETS.map(({ id, label, icon: Icon, activeClass }) => {
                                        const isActive = formData.group === id;
                                        return (
                                            <button
                                                key={id}
                                                type="button"
                                                onClick={() => {
                                                    patch({ group: isActive ? undefined : id });
                                                    setCustomGroup("");
                                                }}
                                                className={cn(
                                                    "flex items-center gap-1.5 h-7 px-2.5 rounded-md border text-xs font-medium transition-all",
                                                    isActive
                                                        ? activeClass
                                                        : "border-border/60 text-muted-foreground/60 hover:border-border hover:text-foreground bg-transparent"
                                                )}
                                            >
                                                <Icon size={11} />
                                                {label}
                                            </button>
                                        );
                                    })}
                                </div>
                                {/* Custom group input */}
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Custom group…"
                                        value={
                                            formData.group && !GROUP_PRESETS.find(p => p.id === formData.group)
                                                ? formData.group
                                                : customGroup
                                        }
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setCustomGroup(val);
                                            patch({ group: val || undefined });
                                        }}
                                        onFocus={() => {
                                            if (GROUP_PRESETS.find(p => p.id === formData.group)) {
                                                patch({ group: undefined });
                                            }
                                        }}
                                        className={cn(
                                            "w-full h-8 px-3 rounded-md border bg-transparent text-xs outline-none transition-colors",
                                            "placeholder:text-muted-foreground/35 text-foreground",
                                            "border-border/60 focus:border-border",
                                        )}
                                    />
                                    {customGroup && !GROUP_PRESETS.find(p => p.id === formData.group) && formData.group && (
                                        <button
                                            type="button"
                                            onClick={() => { setCustomGroup(""); patch({ group: undefined }); }}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground transition-colors"
                                        >
                                            <X size={11} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* ── Divider ── */}
                            <div className="flex items-center gap-3">
                                <Separator className="flex-1" />
                                <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/30 shrink-0">
                                    Connection Details
                                </span>
                                <Separator className="flex-1" />
                            </div>

                            {/* ── Engine-specific fields ── */}
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={formData.type}
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -6 }}
                                    transition={{ duration: 0.15 }}
                                    className="space-y-4"
                                >
                                    {formData.type === "mongodb" ? (
                                        <div>
                                            <FormLabel>
                                                <Globe className="inline size-3 mr-1 opacity-60" />
                                                Connection URI
                                            </FormLabel>
                                            <Input
                                                value={formData.uri || ""}
                                                onChange={(e) => patch({ uri: e.target.value })}
                                                placeholder="mongodb+srv://user:pass@cluster0.example.net/db"
                                                className="h-9 bg-muted/30 font-mono text-[12px]"
                                            />
                                        </div>
                                    ) : formData.type === "sqlite" ? (
                                        <div>
                                            <FormLabel>
                                                <FileText className="inline size-3 mr-1 opacity-60" />
                                                Database File Path
                                            </FormLabel>
                                            <div className="flex gap-2">
                                                <Input
                                                    value={formData.database || ""}
                                                    onChange={(e) => patch({ database: e.target.value })}
                                                    placeholder="/path/to/database.sqlite"
                                                    className="h-9 bg-muted/30 font-mono text-[12px] flex-1"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-9 text-[10px] font-bold uppercase tracking-widest shrink-0"
                                                >
                                                    Browse
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {/* Host + Port */}
                                            <div className="grid grid-cols-3 gap-3">
                                                <div className="col-span-2">
                                                    <FormLabel>
                                                        <Server className="inline size-3 mr-1 opacity-60" />
                                                        Hostname
                                                    </FormLabel>
                                                    <Input
                                                        value={formData.host || ""}
                                                        onChange={(e) => patch({ host: e.target.value })}
                                                        placeholder="localhost"
                                                        className="h-9 bg-muted/30"
                                                    />
                                                </div>
                                                <div>
                                                    <FormLabel>Port</FormLabel>
                                                    <Input
                                                        type="number"
                                                        value={formData.port || ""}
                                                        onChange={(e) =>
                                                            patch({ port: parseInt(e.target.value) || 0 })
                                                        }
                                                        placeholder="5432"
                                                        className="h-9 bg-muted/30 font-mono"
                                                    />
                                                </div>
                                            </div>

                                            {/* User + Password */}
                                            {formData.type !== "redis" && (
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <FormLabel>
                                                            <Key className="inline size-3 mr-1 opacity-60" />
                                                            Username
                                                        </FormLabel>
                                                        <Input
                                                            value={formData.user || ""}
                                                            onChange={(e) => patch({ user: e.target.value })}
                                                            placeholder="database_user"
                                                            className="h-9 bg-muted/30"
                                                        />
                                                    </div>
                                                    <div>
                                                        <FormLabel>Password</FormLabel>
                                                        <div className="relative">
                                                            <Input
                                                                type={showPassword ? "text" : "password"}
                                                                value={formData.password || ""}
                                                                onChange={(e) => patch({ password: e.target.value })}
                                                                placeholder="••••••••"
                                                                className="h-9 bg-muted/30 pr-9"
                                                            />
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon-xs"
                                                                onClick={() => setShowPassword((v) => !v)}
                                                                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground"
                                                            >
                                                                {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Default database */}
                                            {formData.type !== "redis" && (
                                                <div>
                                                    <FormLabel>
                                                        <Database className="inline size-3 mr-1 opacity-60" />
                                                        Default Database
                                                    </FormLabel>
                                                    <Input
                                                        value={formData.database || ""}
                                                        onChange={(e) => patch({ database: e.target.value })}
                                                        placeholder="e.g. postgres"
                                                        className="h-9 bg-muted/30"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </motion.div>
                            </AnimatePresence>

                            {/* ── SSL toggle ── */}
                            {formData.type !== "redis" && formData.type !== "sqlite" && (
                                <div
                                    onClick={() => patch({ ssl: !formData.ssl })}
                                    className={cn(
                                        "flex items-center justify-between px-4 py-3 rounded-xl border cursor-pointer transition-all",
                                        formData.ssl
                                            ? "bg-accent/5 border-accent/20"
                                            : "bg-muted/20 border-border hover:bg-muted/40",
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className={cn(
                                                "size-8 rounded-lg flex items-center justify-center transition-colors",
                                                formData.ssl
                                                    ? "bg-accent/10 text-accent-foreground"
                                                    : "bg-muted text-muted-foreground/40",
                                            )}
                                        >
                                            <Shield size={14} />
                                        </div>
                                        <div>
                                            <p className="text-[12px] font-semibold text-foreground">
                                                SSL / TLS Encryption
                                            </p>
                                            <p className="text-[10px] text-muted-foreground/50">
                                                Encrypt the connection with TLS
                                            </p>
                                        </div>
                                    </div>
                                    <Switch
                                        checked={!!formData.ssl}
                                        onCheckedChange={(checked) => patch({ ssl: checked })}
                                        onClick={(e) => e.stopPropagation()}
                                        className="shrink-0"
                                    />
                                </div>
                            )}

                            {/* ── SSH Tunnel ── */}
                            {formData.type !== "sqlite" && (
                                <div className="space-y-2">
                                    <div
                                        onClick={() => patch({ sshEnabled: !formData.sshEnabled })}
                                        className={cn(
                                            "flex items-center justify-between px-4 py-3 rounded-xl border cursor-pointer transition-all",
                                            formData.sshEnabled
                                                ? "bg-accent/5 border-accent/20"
                                                : "bg-muted/20 border-border hover:bg-muted/40",
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div
                                                className={cn(
                                                    "size-8 rounded-lg flex items-center justify-center transition-colors",
                                                    formData.sshEnabled
                                                        ? "bg-accent/10 text-accent-foreground"
                                                        : "bg-muted text-muted-foreground/40",
                                                )}
                                            >
                                                <Terminal size={14} />
                                            </div>
                                            <div>
                                                <p className="text-[12px] font-semibold text-foreground">
                                                    SSH Tunnel
                                                </p>
                                                <p className="text-[10px] text-muted-foreground/50">
                                                    Connect via SSH port-forward
                                                </p>
                                            </div>
                                        </div>
                                        <Switch
                                            checked={!!formData.sshEnabled}
                                            onCheckedChange={(checked) => patch({ sshEnabled: checked })}
                                            onClick={(e) => e.stopPropagation()}
                                            className="shrink-0"
                                        />
                                    </div>

                                    <AnimatePresence>
                                        {formData.sshEnabled && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: "auto" }}
                                                exit={{ opacity: 0, height: 0 }}
                                                transition={{ duration: 0.15 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="space-y-3 pt-1 pl-1 border-l-2 border-accent/20 ml-4">
                                                    {/* SSH Host + Port */}
                                                    <div className="grid grid-cols-[1fr_100px] gap-2">
                                                        <div>
                                                            <FormLabel>SSH Host</FormLabel>
                                                            <Input
                                                                value={formData.sshHost ?? ""}
                                                                onChange={(e) => patch({ sshHost: e.target.value })}
                                                                placeholder="bastion.example.com"
                                                                className="h-9 bg-muted/30"
                                                            />
                                                        </div>
                                                        <div>
                                                            <FormLabel>Port</FormLabel>
                                                            <Input
                                                                type="number"
                                                                value={formData.sshPort ?? 22}
                                                                onChange={(e) => patch({ sshPort: parseInt(e.target.value) || 22 })}
                                                                className="h-9 bg-muted/30"
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* SSH User */}
                                                    <div>
                                                        <FormLabel>SSH User</FormLabel>
                                                        <Input
                                                            value={formData.sshUser ?? ""}
                                                            onChange={(e) => patch({ sshUser: e.target.value })}
                                                            placeholder="ubuntu"
                                                            className="h-9 bg-muted/30"
                                                        />
                                                    </div>

                                                    {/* Auth Method tabs */}
                                                    <div>
                                                        <FormLabel>Authentication</FormLabel>
                                                        <div className="flex gap-1 mb-2">
                                                            {(["password", "key"] as const).map((method) => {
                                                                const isKeyAuth = !!(formData.sshKeyPath && formData.sshKeyPath.length > 0);
                                                                const active = method === "key" ? isKeyAuth : !isKeyAuth;
                                                                return (
                                                                    <button
                                                                        key={method}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            if (method === "key") {
                                                                                patch({ sshKeyPath: formData.sshKeyPath || " ", sshPassword: undefined });
                                                                            } else {
                                                                                patch({ sshKeyPath: undefined, sshKeyPassphrase: undefined });
                                                                            }
                                                                        }}
                                                                        className={cn(
                                                                            "flex items-center gap-1.5 h-7 px-3 rounded-md border text-[11px] font-medium transition-all capitalize",
                                                                            active
                                                                                ? "border-accent/40 bg-accent/10 text-accent-foreground"
                                                                                : "border-border/60 text-muted-foreground/60 hover:border-border bg-transparent",
                                                                        )}
                                                                    >
                                                                        {method === "password" ? <Key size={10} /> : <FileText size={10} />}
                                                                        {method === "password" ? "Password" : "Key File"}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>

                                                        {/* Password auth */}
                                                        {!(formData.sshKeyPath && formData.sshKeyPath.trim().length > 0) && (
                                                            <Input
                                                                type="password"
                                                                value={formData.sshPassword ?? ""}
                                                                onChange={(e) => patch({ sshPassword: e.target.value })}
                                                                placeholder="SSH password"
                                                                className="h-9 bg-muted/30"
                                                            />
                                                        )}

                                                        {/* Key file auth */}
                                                        {(formData.sshKeyPath && formData.sshKeyPath.trim().length > 0) && (
                                                            <div className="space-y-2">
                                                                <div className="relative">
                                                                    <Input
                                                                        value={formData.sshKeyPath.trim() === "" ? "" : formData.sshKeyPath}
                                                                        onChange={(e) => patch({ sshKeyPath: e.target.value })}
                                                                        placeholder="~/.ssh/id_rsa"
                                                                        className="h-9 bg-muted/30 pr-9"
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground"
                                                                        onClick={async () => {
                                                                            try {
                                                                                const { open } = await import("@tauri-apps/plugin-dialog");
                                                                                const path = await open({ multiple: false, directory: false });
                                                                                if (typeof path === "string") patch({ sshKeyPath: path });
                                                                            } catch {}
                                                                        }}
                                                                    >
                                                                        <FolderOpen size={13} />
                                                                    </button>
                                                                </div>
                                                                <Input
                                                                    type="password"
                                                                    value={formData.sshKeyPassphrase ?? ""}
                                                                    onChange={(e) => patch({ sshKeyPassphrase: e.target.value })}
                                                                    placeholder="Key passphrase (optional)"
                                                                    className="h-9 bg-muted/30"
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )}

                            {/* ── Connection URL preview ── */}
                            <ConnectionUrlPreview formData={formData} />
                        </div>

                        {/* ── Footer ── */}
                        <div className="h-14 px-6 border-t border-border flex items-center justify-between shrink-0 bg-card">
                            {/* Left: test + delete */}
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleTest}
                                    disabled={isTesting || isLoading}
                                    className={cn(
                                        "h-8 text-[10px] font-bold uppercase tracking-widest gap-1.5",
                                        testStatus === "success" &&
                                            "bg-primary/10 text-primary border-primary/30",
                                        testStatus === "error" &&
                                            "bg-destructive/10 text-destructive border-destructive/20",
                                    )}
                                >
                                    {isTesting ? (
                                        <Loader2 size={11} className="animate-spin" />
                                    ) : testStatus === "success" ? (
                                        <Wifi size={11} />
                                    ) : testStatus === "error" ? (
                                        <WifiOff size={11} />
                                    ) : (
                                        <Globe size={11} />
                                    )}
                                    {testStatus === "success"
                                        ? "Connected"
                                        : testStatus === "error"
                                          ? "Failed"
                                          : "Test"}
                                </Button>

                                {initialData && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleDelete}
                                        className="h-8 text-[10px] font-bold uppercase tracking-widest text-destructive/60 hover:text-destructive hover:bg-destructive/10 gap-1.5"
                                    >
                                        <Trash2 size={11} />
                                        Delete
                                    </Button>
                                )}
                            </div>

                            {/* Right: cancel + save + connect */}
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={onClose}
                                    disabled={isLoading}
                                    className="h-8 text-[10px] font-bold uppercase tracking-widest"
                                >
                                    Cancel
                                </Button>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleSave}
                                    disabled={isLoading || !formData.name}
                                    className="h-8 text-[10px] font-bold uppercase tracking-widest"
                                >
                                    Save
                                </Button>

                                <Button
                                    size="sm"
                                    onClick={handleConnect}
                                    disabled={isLoading || !formData.name}
                                    className="h-8 px-5 text-[10px] font-black uppercase tracking-widest gap-1.5 active:scale-[0.97]"
                                >
                                    {isLoading ? (
                                        <Loader2 size={11} className="animate-spin" />
                                    ) : (
                                        <CheckCircle2 size={11} />
                                    )}
                                    {initialData ? "Reconnect" : "Connect"}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ConnectionDialog;
