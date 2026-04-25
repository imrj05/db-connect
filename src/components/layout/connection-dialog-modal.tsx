import { startTransition, useEffect, useState } from "react";
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
    WandSparkles,
    LayoutTemplate,
    ArrowRight,
} from "lucide-react";
import { ConnectionConfig } from "@/types";
import { useAppStore } from "@/store/useAppStore";
import { tauriApi } from "@/lib/tauri-api";
import { toast } from "@/components/ui/sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Field,
    FieldDescription,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { suggestPrefix } from "@/lib/db-functions";
import { DB_LOGO as DB_LOGOS } from "@/lib/db-ui";
import { EngineSelector } from "@/components/layout/connection-dialog/engine-selector";
import { GroupSelector } from "@/components/layout/connection-dialog/group-selector";
import { EngineFields } from "@/components/layout/connection-dialog/engine-fields";
import { SshTunnelSection } from "@/components/layout/connection-dialog/ssh-tunnel-section";
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
    { label: "Local PG", engine: "postgresql" as const, name: "Local PostgreSQL", host: "localhost", port: 5432, user: "postgres", database: "postgres" },
    { label: "Local MySQL", engine: "mysql" as const, name: "Local MySQL", host: "localhost", port: 3306, user: "root", database: "mysql" },
    { label: "SQLite", engine: "sqlite" as const, name: "Local SQLite", database: "local.sqlite" },
    { label: "MongoDB", engine: "mongodb" as const, name: "Local MongoDB", uri: "mongodb://localhost:27017" },
    { label: "Redis", engine: "redis" as const, name: "Local Redis", host: "localhost", port: 6379 },
];
const DEFAULT_DIALOG_TAB = "details";
const tabTriggerBaseClass =
    "flex h-9 min-w-[132px] items-center justify-center gap-2 rounded-xl border px-3 text-[12px] font-medium transition-colors";
const createDraftConnectionId = () =>
    Math.random().toString(36).substring(7);
const buildConnectionConfig = (
    formData: Partial<ConnectionConfig>,
    draftConnectionId: string,
    connectionsCount: number,
): ConnectionConfig =>
    ({
        ...formData,
        id: formData.id || draftConnectionId,
        name: formData.name || `Connection ${connectionsCount + 1}`,
        prefix:
            formData.prefix ||
            suggestPrefix(formData.name || `conn${connectionsCount + 1}`),
    }) as ConnectionConfig;
const getConfigSnapshotKey = (config: ConnectionConfig) => JSON.stringify(config);
// ── Group presets ──────────────────────────────────────────────────────────────
export const GROUP_PRESETS: {
    id: string;
    label: string;
    icon: React.FC<{ size?: number; className?: string }>;
    color: string;
    activeClass: string;
}[] = [
        { id: "local", label: "local", icon: Laptop, color: "text-sky-400", activeClass: "border-sky-400/50 bg-sky-400/10 text-sky-400" },
        { id: "dev", label: "dev", icon: Code2, color: "text-cyan-400", activeClass: "border-cyan-400/50 bg-cyan-400/10 text-cyan-400" },
        { id: "staging", label: "staging", icon: FlaskConical, color: "text-amber-400", activeClass: "border-amber-400/50 bg-amber-400/10 text-amber-400" },
        { id: "prod", label: "prod", icon: Globe, color: "text-emerald-400", activeClass: "border-emerald-400/50 bg-emerald-400/10 text-emerald-400" },
        { id: "testing", label: "testing", icon: TestTube, color: "text-purple-400", activeClass: "border-purple-400/50 bg-purple-400/10 text-purple-400" },
    ];
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
        updateConnection,
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
    const [activeTab, setActiveTab] = useState(DEFAULT_DIALOG_TAB);
    const [draftConnectionId] = useState(() => initialData?.id || createDraftConnectionId());
    const [formData, setFormData] = useState<Partial<ConnectionConfig>>(
        initialData || {
            name: "",
            prefix: "",
            type: "postgresql",
            ...ENGINE_DEFAULTS.postgresql,
            ssl: false,
        },
    );
    const [lastSavedConfigKey, setLastSavedConfigKey] = useState<string | null>(() =>
        initialData
            ? getConfigSnapshotKey(
                buildConnectionConfig(initialData, initialData.id, connections.length),
            )
            : null,
    );
    useEffect(() => {
        if (!prefixManuallyEdited && formData.name) {
            setFormData((prev) => ({
                ...prev,
                prefix: suggestPrefix(formData.name || ""),
            }));
        }
    }, [formData.name, prefixManuallyEdited]);
    const currentConfig = buildConnectionConfig(
        formData,
        draftConnectionId,
        connections.length,
    );
    const currentConfigKey = getConfigSnapshotKey(currentConfig);
    const isDirty = currentConfigKey !== lastSavedConfigKey;
    const patch = (partial: Partial<ConnectionConfig>) => {
        setFormData((prev) => ({ ...prev, ...partial }));
        setTestStatus("idle");
    };
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
        startTransition(() => setActiveTab(DEFAULT_DIALOG_TAB));
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
            startTransition(() => setActiveTab(DEFAULT_DIALOG_TAB));
            toast.success("URI parsed");
        } catch (err) {
            toast.error(`Could not parse URI: ${String(err)}`);
        } finally {
            setIsParsingUri(false);
        }
    };
    const persistConnection = (config: ConnectionConfig) => {
        if (connections.some((c) => c.id === config.id)) {
            updateConnection(config);
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
        const config = currentConfig;
        persistConnection(config);
        setLastSavedConfigKey(currentConfigKey);
        toast.success(initialData ? "Connection updated" : "Connection saved");
    };
    const handleConnect = async () => {
        const config = currentConfig;
        persistConnection(config);
        setLastSavedConfigKey(currentConfigKey);
        const connected = await connectAndInit(config.id);
        if (connected) {
            onClose();
        }
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
                className="!max-w-[900px] !w-[900px] !p-0 !gap-0 overflow-hidden bg-card border border-border-subtle shadow-2xl rounded-xl"
            >
                <DialogTitle className="sr-only">
                    {initialData ? "Edit Connection" : "New Connection"}
                </DialogTitle>
                <DialogDescription className="sr-only">
                    Configure a database connection and optionally use Quick Connect presets.
                </DialogDescription>
                <Tabs
                    value={activeTab}
                    onValueChange={setActiveTab}
                    className="flex h-[580px] flex-col"
                >
                    <div className="flex items-center justify-between gap-4 border-b border-border-subtle bg-surface-2/72 px-6 py-4.5">
                        <div className="min-w-0">
                            <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
                                {initialData ? "Edit Connection" : "New Connection"}
                            </h2>
                            <p className="mt-1 text-[12px] text-muted-foreground/68">
                                {initialData
                                    ? `Editing ${initialData.name}`
                                    : "Create a connection from scratch or start with Quick Connect."}
                            </p>
                        </div>
                        {!initialData && (
                            <TabsList
                                variant="line"
                                className="grid h-10 auto-cols-fr grid-flow-col shrink-0 rounded-lg bg-surface-3 p-0.5"
                            >
                                <TabsTrigger
                                    value="details"
                                    className={cn(
                                        tabTriggerBaseClass,
                                        activeTab === "details"
                                            ? "border-border-subtle bg-surface-elevated text-foreground shadow-xs [&_svg]:text-foreground"
                                            : "border-transparent bg-transparent text-muted-foreground/60 hover:bg-surface-2 hover:text-foreground/80 [&_svg]:text-muted-foreground/45",
                                    )}
                                >
                                    <LayoutTemplate data-icon="inline-start" />
                                    Details
                                </TabsTrigger>
                                <TabsTrigger
                                    value="quick-connect"
                                    className={cn(
                                        tabTriggerBaseClass,
                                        activeTab === "quick-connect"
                                            ? "border-border-subtle bg-surface-elevated text-foreground shadow-xs [&_svg]:text-foreground"
                                            : "border-transparent bg-transparent text-muted-foreground/60 hover:bg-surface-2 hover:text-foreground/80 [&_svg]:text-muted-foreground/45",
                                    )}
                                >
                                    <WandSparkles data-icon="inline-start" />
                                    Quick Connect
                                </TabsTrigger>
                            </TabsList>
                        )}
                    </div>
                    <TabsContent value="details" className="min-h-0 flex-1">
                        <div className="flex h-full min-h-0">
                            <EngineSelector
                                selectedType={formData.type ?? "postgresql"}
                                onSelect={handleEngineChange}
                            />
                            <div className="flex min-w-0 flex-1 flex-col">
                                <div className="flex-1 overflow-y-auto p-6">
                                    <div className="flex flex-col gap-5">
                                        <FieldGroup>
                                            <div className="grid grid-cols-2 gap-4">
                                                <Field>
                                                    <FieldLabel>
                                                        <Tag className="inline size-3 mr-1 opacity-60" />
                                                        Connection Name
                                                        <span className="text-destructive ml-0.5">*</span>
                                                    </FieldLabel>
                                                    <Input
                                                        value={formData.name || ""}
                                                        onChange={(e) => patch({ name: e.target.value })}
                                                        placeholder="e.g. Production Analytics"
                                                        className="h-9 bg-muted/30"
                                                    />
                                                </Field>
                                                <Field>
                                                    <FieldLabel>
                                                        <Hash className="inline size-3 mr-1 opacity-60" />
                                                        Function Prefix
                                                    </FieldLabel>
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
                                                        <FieldDescription className="mt-1 text-[10px] font-mono text-muted-foreground/40">
                                                            <span className="text-foreground/50">{formData.prefix}_list()</span>
                                                            {" · "}
                                                            <span className="text-foreground/50">{formData.prefix}_query()</span>
                                                            {" · ..."}
                                                        </FieldDescription>
                                                    )}
                                                </Field>
                                            </div>
                                            <Field>
                                                <FieldLabel>
                                                    <Layers className="inline size-3 mr-1 opacity-60" />
                                                    Group
                                                </FieldLabel>
                                                <GroupSelector
                                                    group={formData.group}
                                                    onChange={(g) => patch({ group: g })}
                                                />
                                            </Field>
                                        </FieldGroup>
                                        <div className="flex items-center gap-3">
                                            <Separator className="flex-1" />
                                            <span className="text-[10px] font-semibold text-muted-foreground/55 shrink-0">
                                                Connection Details
                                            </span>
                                            <Separator className="flex-1" />
                                        </div>
                                        <EngineFields
                                            formData={formData}
                                            showPassword={showPassword}
                                            onTogglePassword={() => setShowPassword((v) => !v)}
                                            onPatch={patch}
                                        />
                                        {formData.type !== "redis" && formData.type !== "sqlite" && (
                                            <div
                                                    className={cn(
                                                        "overflow-hidden rounded-xl border transition-colors",
                                                        formData.ssl
                                                            ? "border-primary/20 bg-primary/5"
                                                            : "border-border-subtle bg-surface-2/72 hover:bg-surface-2",
                                                )}
                                            >
                                                <div
                                                    onClick={() => patch({ ssl: !formData.ssl })}
                                                    className="flex cursor-pointer items-start justify-between gap-3 px-3.5 py-3"
                                                >
                                                    <div className="flex min-w-0 items-start gap-2.5">
                                                        <div
                                                            className={cn(
                                                                "flex size-8 shrink-0 items-center justify-center rounded-md border transition-colors",
                                                                formData.ssl
                                                                    ? "border-primary/20 bg-primary/10 text-foreground"
                                                                    : "border-border-subtle bg-surface-3 text-muted-foreground/55",
                                                            )}
                                                        >
                                                            <Shield size={13} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="flex flex-wrap items-center gap-1.5">
                                                                <p className="text-[11px] font-semibold text-foreground">
                                                                    SSL / TLS Encryption
                                                                </p>
                                                                <span
                                                                    className={cn(
                                                                        "rounded-md border px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.16em]",
                                                                        formData.ssl
                                                                            ? "border-primary/24 bg-primary/10 text-foreground/80"
                                                                            : "border-transparent bg-surface-3 text-muted-foreground/55",
                                                                    )}
                                                                >
                                                                    {formData.ssl ? "Enabled" : "Optional"}
                                                                </span>
                                                            </div>
                                                            <p className="mt-0.5 text-[9px] leading-relaxed text-muted-foreground/60">
                                                                Encrypt traffic in transit for remote or managed databases.
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <Switch
                                                        checked={!!formData.ssl}
                                                        onCheckedChange={(checked) => patch({ ssl: checked })}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="mt-0.5 shrink-0"
                                                    />
                                                </div>
                                                <div className="grid gap-1.5 border-t border-border-subtle px-3.5 py-2.5 md:grid-cols-2">
                                                    <div
                                                        className={cn(
                                                            "rounded-md border px-2.5 py-2 transition-colors",
                                                            formData.ssl
                                                                ? "border-primary/20 bg-surface-elevated/92"
                                                                : "border-border-subtle bg-surface-elevated/80",
                                                        )}
                                                    >
                                                        <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-muted-foreground/55">
                                                            Transport
                                                        </p>
                                                        <p className="mt-1 text-[10px] font-medium text-foreground">
                                                            {formData.ssl ? "Encrypted in transit" : "Plain connection"}
                                                        </p>
                                                    </div>
                                                    <div className="rounded-md border border-border-subtle bg-surface-elevated/80 px-2.5 py-2">
                                                        <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-muted-foreground/55">
                                                            Best For
                                                        </p>
                                                        <p className="mt-1 text-[10px] font-medium text-foreground">
                                                            {formData.ssl
                                                                ? "Production, cloud, and shared networks"
                                                                : "Trusted local development only"}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {formData.type !== "sqlite" && (
                                            <SshTunnelSection formData={formData} onPatch={patch} />
                                        )}
                                        <ConnectionUrlPreview formData={formData} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TabsContent>
                    {!initialData && (
                        <TabsContent value="quick-connect" className="min-h-0 flex-1">
                                        <div className="flex h-full min-h-0 flex-col overflow-y-auto p-6">
                                            <div className="flex flex-col gap-4">
                                    <Card size="sm" className="border border-border-subtle bg-surface-2/72 py-0 rounded-md">
                                        <CardHeader className="border-b border-border-subtle py-4">
                                            <CardTitle className="flex items-center gap-2 text-sm">
                                                <Link2 className="size-4 text-muted-foreground" />
                                                Paste Connection URI
                                            </CardTitle>
                                            <CardDescription className="text-xs">
                                                Paste a full connection string and we&apos;ll populate the form for you.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="py-4">
                                            <FieldGroup>
                                                <Field>
                                                    <FieldLabel>Connection URI</FieldLabel>
                                                    <div className="flex gap-2">
                                                        <Input
                                                            value={uriInput}
                                                            onChange={(e) => setUriInput(e.target.value)}
                                                            placeholder="postgresql://user:pass@host:5432/db"
                                                            className="h-9 flex-1 bg-background font-mono text-[11px]"
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
                                                            className="h-9 shrink-0 text-[10px] font-bold uppercase tracking-widest"
                                                        >
                                                            {isParsingUri ? <Loader2 className="animate-spin" /> : "Parse"}
                                                        </Button>
                                                    </div>
                                                    <FieldDescription className="text-xs">
                                                        Supported schemes: PostgreSQL, MySQL, SQLite, MongoDB, and Redis.
                                                    </FieldDescription>
                                                </Field>
                                            </FieldGroup>
                                        </CardContent>
                                    </Card>
                                    <Card size="sm" className="border border-border-subtle bg-surface-2/72 py-0 rounded-md">
                                        <CardHeader className="border-b border-border-subtle py-4">
                                            <CardTitle className="flex items-center gap-2 text-sm">
                                                <Zap className="size-4 text-muted-foreground" />
                                                Quick Connect Presets
                                            </CardTitle>
                                            <CardDescription className="text-xs">
                                                Start from a local default, then continue in the Details tab.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="py-4">
                                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                                {QUICK_PRESETS.map((preset) => {
                                                    const Logo = DB_LOGOS[preset.engine];
                                                    return (
                                                        <button
                                                            key={preset.label}
                                                            type="button"
                                                            onClick={() => handlePreset(preset)}
                                                            className="group flex items-center justify-between rounded-xl border border-border-subtle bg-surface-elevated px-4 py-3.5 text-left transition-colors hover:border-border hover:bg-surface-3"
                                                        >
                                                            <div className="flex min-w-0 items-center gap-3">
                                                                <div className="flex size-10 items-center justify-center rounded-md bg-surface-3 text-foreground/70">
                                                                    <Logo className="text-base" />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="text-sm font-semibold text-foreground">
                                                                        {preset.name}
                                                                    </p>
                                                                    <p className="truncate text-[11px] text-muted-foreground">
                                                                        {preset.engine === "mongodb"
                                                                            ? preset.uri
                                                                            : preset.engine === "sqlite"
                                                                                ? preset.database
                                                                                : `${preset.host}:${preset.port}`}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        </TabsContent>
                    )}
                    {/* ── Footer ── */}
                    <div className="shrink-0 border-t border-border-subtle bg-surface-2/72 px-6 py-3">
                        <div className="flex h-full items-center justify-between gap-3">
                            <p className="min-w-0 max-w-[380px] text-[12px] text-muted-foreground/68 text-pretty">
                                    {isLoading
                                        ? "Connecting with the latest saved details..."
                                        : !formData.name
                                            ? "Add a connection name to save it or connect."
                                            : isDirty
                                                ? "Save keeps this dialog open. Connect saves first and closes on success."
                                                : "Saved in the background. You can keep editing, close, or connect now."}
                            </p>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleTest}
                                    disabled={isTesting || isLoading}
                                    className={cn(
                                        "h-8 rounded-md px-3 text-[11px] font-medium gap-1.5",
                                        testStatus === "success" &&
                                        "bg-primary/8 text-primary border-primary/24",
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
                                        className="h-8 rounded-md px-3 text-[11px] font-medium text-destructive/60 hover:text-destructive hover:bg-destructive/10 gap-1.5"
                                    >
                                        <Trash2 size={11} />
                                        Delete
                                    </Button>
                                )}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={onClose}
                                    disabled={isLoading}
                                    className="h-8 rounded-md px-3 text-[11px] font-medium"
                                >
                                    Close
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleSave}
                                    disabled={isLoading || !formData.name || !isDirty}
                                    className="h-8 rounded-md px-3 text-[11px] font-medium"
                                >
                                    {isDirty ? "Save" : "Saved"}
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={handleConnect}
                                    disabled={isLoading || !formData.name}
                                    className="h-8 rounded-md px-4 text-[11px] font-medium gap-1.5 active:scale-[0.97]"
                                >
                                    {isLoading ? (
                                        <Loader2 size={11} className="animate-spin" />
                                    ) : (
                                        <CheckCircle2 size={11} />
                                    )}
                                    Connect now
                                </Button>
                            </div>
                        </div>
                    </div>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
};
export default ConnectionDialog;
