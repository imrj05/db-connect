import { useEffect, useState } from "react";
import {
    Shield,
    Globe,
    Tag,
    Loader2,
    CheckCircle2,
    Trash2,
    Hash,
    Wifi,
    WifiOff,
    Zap,
    Layers,
    Link2,
    Laptop,
    Code2,
    FlaskConical,
    TestTube,
} from "lucide-react";
import { ConnectionConfig } from "@/types";
import { useAppStore } from "@/store/useAppStore";
import { tauriApi } from "@/lib/tauri-api";
import { toast } from "@/components/ui/sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { suggestPrefix } from "@/lib/db-functions";
import { DB_LOGO as DB_LOGOS } from "@/lib/db-ui";
import { EngineSelector } from "@/components/layout/connection-dialog/EngineSelector";
import { GroupSelector } from "@/components/layout/connection-dialog/GroupSelector";
import { EngineFields } from "@/components/layout/connection-dialog/EngineFields";
import { SshTunnelSection } from "@/components/layout/connection-dialog/SshTunnelSection";

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
                    <EngineSelector
                        selectedType={formData.type ?? "postgresql"}
                        onSelect={handleEngineChange}
                    />

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
                                        : `Configure your ${formData.type ?? "database"} connection`}
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
                                <GroupSelector
                                    group={formData.group}
                                    onChange={(g) => patch({ group: g })}
                                />
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
                            <EngineFields
                                formData={formData}
                                showPassword={showPassword}
                                onTogglePassword={() => setShowPassword((v) => !v)}
                                onPatch={patch}
                            />

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
                                <SshTunnelSection formData={formData} onPatch={patch} />
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
