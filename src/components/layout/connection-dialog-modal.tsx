import { startTransition, useEffect, useState } from "react";
import {
                    Globe,
    Tag,
    Loader2,
    CheckCircle2,
    Trash2,
    Hash,
    Wifi,
    WifiOff,
    Zap,
    Link2,
    Laptop,
    Code2,
    FlaskConical,
    TestTube,
    WandSparkles,
    LayoutTemplate,
    ArrowRight,
    ChevronDown,
    Settings2,
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
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
    mode?: "modal" | "page";
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
const DEFAULT_DIALOG_TAB = "quick-connect";
const tabTriggerBaseClass =
    "flex h-9 min-w-[148px] items-center justify-center gap-2 rounded-sm border px-3 text-xs font-medium transition-colors";
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
        { id: "local", label: "local", icon: Laptop, color: "text-emerald-400", activeClass: "border-emerald-400/35 bg-emerald-400/12 text-emerald-300" },
        { id: "dev", label: "dev", icon: Code2, color: "text-yellow-400", activeClass: "border-yellow-400/35 bg-yellow-400/12 text-yellow-300" },
        { id: "staging", label: "staging", icon: FlaskConical, color: "text-amber-400", activeClass: "border-amber-400/35 bg-amber-400/12 text-amber-300" },
        { id: "prod", label: "prod", icon: Globe, color: "text-red-400", activeClass: "border-red-400/35 bg-red-400/12 text-red-300" },
        { id: "testing", label: "testing", icon: TestTube, color: "text-purple-400", activeClass: "border-purple-400/35 bg-purple-400/12 text-purple-300" },
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

function StepBadge({ step, active }: { step: string; active: boolean }) {
    return (
        <span
            className={cn(
                "flex size-5 items-center justify-center border text-[10px] font-bold leading-none",
                active
                    ? "border-border-subtle bg-surface-1 text-foreground"
                    : "border-border-subtle bg-transparent text-muted-foreground/55",
            )}
        >
            {step}
        </span>
    );
}
// ── Main component ─────────────────────────────────────────────────────────────
const ConnectionDialog = ({ onClose, initialData, mode = "modal" }: ConnectionDialogProps) => {
    const isPageMode = mode === "page";
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
    const [activeTab, setActiveTab] = useState(initialData ? "details" : DEFAULT_DIALOG_TAB);
    const [advancedOpen, setAdvancedOpen] = useState(false);
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
    const content = (
        <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className={cn("flex flex-col", mode === "modal" ? "h-[620px]" : "h-full min-h-0")}
        >
                    <div className="flex items-center justify-between gap-4 border-b border-border-subtle bg-surface-1 px-6 py-4">
                        <div className="min-w-0">
                            <h2 className="text-sm font-semibold tracking-tight text-foreground">
                                {initialData ? "Edit Connection" : "New Connection"}
                            </h2>
                                            <p className="mt-1 text-xs text-muted-foreground/68">
                                {initialData
                                    ? `Editing ${initialData.name}`
                                    : activeTab === "quick-connect"
                                        ? "Start with a preset or URI, then continue into the details form."
                                        : "Review the generated details and finish the connection setup."}
                            </p>
                        </div>
                        {!initialData && (
                            <TabsList
                                variant="line"
                                className="grid h-10 auto-cols-fr grid-flow-col shrink-0 bg-transparent p-0"
                            >
                                <TabsTrigger
                                    value="quick-connect"
                                    className={cn(
                                        tabTriggerBaseClass,
                                        activeTab === "quick-connect"
                                            ? "border-border-subtle bg-surface-2 text-foreground [&_svg]:text-foreground"
                                            : "border-border-subtle bg-transparent text-muted-foreground/60 hover:bg-surface-2 hover:text-foreground/80 [&_svg]:text-muted-foreground/45",
                                    )}
                                >
                                    <StepBadge step="1" active={activeTab === "quick-connect"} />
                                    <WandSparkles data-icon="inline-start" />
                                    Quick Connect
                                </TabsTrigger>
                                <TabsTrigger
                                    value="details"
                                    className={cn(
                                        tabTriggerBaseClass,
                                        activeTab === "details"
                                            ? "border-border-subtle bg-surface-2 text-foreground [&_svg]:text-foreground"
                                            : "border-border-subtle bg-transparent text-muted-foreground/60 hover:bg-surface-2 hover:text-foreground/80 [&_svg]:text-muted-foreground/45",
                                    )}
                                >
                                    <StepBadge step="2" active={activeTab === "details"} />
                                    <LayoutTemplate data-icon="inline-start" />
                                    Details
                                </TabsTrigger>
                            </TabsList>
                        )}
                    </div>
                    <TabsContent value="details" className="min-h-0 flex-1 overflow-hidden">
                        <div className="flex h-full min-h-0 flex-col bg-surface-1">
                            <EngineSelector
                                selectedType={formData.type ?? "postgresql"}
                                onSelect={handleEngineChange}
                            />
                            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                                {!initialData && (
                                    <div className="border-b border-border-subtle bg-surface-2 px-6 py-5">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="min-w-0">
                                                <h3 className="text-xl font-bold tracking-[-0.02em] text-foreground">
                                                    {formData.name?.trim() || "New Connection"}
                                                </h3>
                                                <p className="mt-2 text-sm text-muted-foreground/72">
                                                    Configure and connect using a simple, focused setup flow.
                                                </p>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setActiveTab("quick-connect")}
                                                className="h-8 shrink-0 rounded-sm px-3 text-[11px] font-medium"
                                            >
                                                Back to presets
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                <div className="flex-1 overflow-y-auto px-6 py-6">
                                    <div className={cn("flex w-full flex-col gap-5", !isPageMode && "mx-auto max-w-5xl")}>
                                        <div>
                                            <p className="shell-section-label text-foreground/58">Group</p>
                                            <div className="mt-3">
                                                <GroupSelector
                                                    group={formData.group}
                                                    onChange={(g) => patch({ group: g })}
                                                />
                                            </div>
                                        </div>

                                        <div className="border border-border-subtle bg-surface-2">
                                            <div className="p-6">
                                                <FieldGroup>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <Field>
                                                            <FieldLabel>
                                                                <Tag className="mr-1 inline size-3 opacity-60" />
                                                                Connection Name
                                                                <span className="ml-0.5 text-destructive">*</span>
                                                            </FieldLabel>
                                                            <Input
                                                                value={formData.name || ""}
                                                                onChange={(e) => patch({ name: e.target.value })}
                                                                placeholder="e.g. Production Analytics"
                                                                className="h-12 border-border-subtle bg-background text-sm"
                                                            />
                                                        </Field>
                                                        <Field>
                                                            <FieldLabel>
                                                                <Hash className="mr-1 inline size-3 opacity-60" />
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
                                                                    className="h-12 flex-1 border-border-subtle bg-background font-mono text-sm"
                                                                />
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => {
                                                                        setPrefixManuallyEdited(false);
                                                                        patch({ prefix: suggestPrefix(formData.name || "") });
                                                                    }}
                                                                    className="h-12 shrink-0 rounded-sm px-4 text-[10px] font-bold uppercase tracking-widest"
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

                                                    <EngineFields
                                                        formData={formData}
                                                        showPassword={showPassword}
                                                        onTogglePassword={() => setShowPassword((v) => !v)}
                                                        onPatch={patch}
                                                    />
                                                </FieldGroup>
                                            </div>

                                            <div className="border-t border-border-subtle px-6 py-5">
                                                <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                                                    <CollapsibleTrigger asChild>
                                                        <button
                                                            type="button"
                                                            className="flex w-full items-center justify-between gap-3 text-left"
                                                        >
                                                            <div className="flex items-center gap-2 text-muted-foreground/74">
                                                                <Settings2 size={14} />
                                                                <span className="text-sm font-medium text-foreground/82">Advanced Options</span>
                                                            </div>
                                                            <ChevronDown
                                                                size={14}
                                                                className={cn(
                                                                    "text-muted-foreground/55 transition-transform",
                                                                    advancedOpen && "rotate-180",
                                                                )}
                                                            />
                                                        </button>
                                                    </CollapsibleTrigger>

                                                    <CollapsibleContent className="pt-5">
                                                        <div className="flex flex-col gap-5 border-t border-border-subtle pt-5">
                                                            {formData.type !== "redis" && formData.type !== "sqlite" && (
                                                                <div
                                                                    className="flex cursor-pointer items-center justify-between gap-3"
                                                                    onClick={() => patch({ ssl: !formData.ssl })}
                                                                >
                                                                    <div className="min-w-0">
                                                                        <p className="text-[11px] font-semibold text-foreground">SSL / TLS Encryption</p>
                                                                        <p className="mt-0.5 text-[10px] text-muted-foreground/60">
                                                                            Encrypt traffic in transit for remote or managed databases.
                                                                        </p>
                                                                    </div>
                                                                    <Switch
                                                                        checked={!!formData.ssl}
                                                                        onCheckedChange={(checked) => patch({ ssl: checked })}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        className="shrink-0"
                                                                    />
                                                                </div>
                                                            )}

                                                            {formData.type !== "sqlite" && (
                                                                <SshTunnelSection formData={formData} onPatch={patch} />
                                                            )}

                                                            <ConnectionUrlPreview formData={formData} />
                                                        </div>
                                                    </CollapsibleContent>
                                                </Collapsible>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TabsContent>
                    {!initialData && (
                        <TabsContent value="quick-connect" className="min-h-0 flex-1 overflow-hidden">
                            <div className={cn("grid h-full min-h-0 gap-4 overflow-y-auto p-6", isPageMode ? "xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]" : "lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]")}>
                                <div className="flex flex-col gap-4 self-start">
                                    <Card size="sm" className={cn("py-0 rounded-none", isPageMode ? "border-border-subtle bg-surface-2" : "border border-border-subtle bg-surface-2")}>
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
                                                            className="h-9 flex-1 bg-surface-elevated font-mono text-[11px]"
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
                                                            className="h-9 shrink-0 rounded-sm text-[10px] font-bold uppercase tracking-widest"
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
                                    <Card size="sm" className={cn("py-0 rounded-none", isPageMode ? "border-border-subtle bg-surface-2" : "border border-border-subtle bg-surface-2")}>
                                        <CardHeader className="border-b border-border-subtle py-4">
                                            <CardTitle className="flex items-center gap-2 text-sm">
                                                <Zap className="size-4 text-muted-foreground" />
                                                Quick Connect Presets
                                            </CardTitle>
                                            <CardDescription className="text-xs">
                                                    Pick a starting point, then continue to the details step with the form prefilled.
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
                                                            className="group flex items-center justify-between border border-border-subtle bg-surface-elevated px-4 py-3.5 text-left transition-colors hover:border-border hover:bg-surface-3"
                                                        >
                                                            <div className="flex min-w-0 items-center gap-3">
                                                                <div className="flex size-10 items-center justify-center border border-border-subtle bg-surface-3 text-foreground/70">
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
                                <Card size="sm" className={cn("h-fit self-start py-0 rounded-none", isPageMode ? "border-border-subtle bg-surface-2" : "border border-border-subtle bg-surface-2")}>
                                        <CardHeader className="border-b border-border-subtle py-4">
                                            <CardTitle className="flex items-center gap-2 text-sm">
                                                <LayoutTemplate className="size-4 text-muted-foreground" />
                                                What happens next
                                            </CardTitle>
                                            <CardDescription className="text-xs">
                                                Quick Connect fills the same details form you would otherwise complete manually.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="py-4">
                                            <div className="flex flex-col gap-3">
                                                <div className="border border-border-subtle bg-surface-elevated px-3 py-3">
                                                    <p className="shell-section-label text-foreground/58">Step 1</p>
                                                    <p className="mt-1 text-[12px] font-medium text-foreground">Choose a preset or paste a URI</p>
                                                    <p className="mt-1 text-[11px] text-muted-foreground/65">We infer the engine and prefill host, port, database, and URI values.</p>
                                                </div>
                                                <div className="border border-border-subtle bg-surface-elevated px-3 py-3">
                                                    <p className="shell-section-label text-foreground/58">Step 2</p>
                                                    <p className="mt-1 text-[12px] font-medium text-foreground">Review the full details form</p>
                                                    <p className="mt-1 text-[11px] text-muted-foreground/65">Adjust naming, environment, SSL, SSH tunnel, and credentials before testing.</p>
                                                </div>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    onClick={() => setActiveTab("details")}
                                                    className="mt-1 h-9 gap-1.5 rounded-sm px-4 text-[12px] font-medium"
                                                >
                                                    Continue to details
                                                    <ArrowRight size={12} />
                                                </Button>
                                            </div>
                                        </CardContent>
                                </Card>
                            </div>
                        </TabsContent>
                    )}
                    {/* ── Footer ── */}
                    <div className="shrink-0 border-t border-border-subtle bg-surface-1 px-6 py-3">
                        <div className="flex h-full items-center justify-between gap-3">
                            <p className={cn("min-w-0 text-xs text-muted-foreground/68 text-pretty", isPageMode ? "max-w-[640px]" : "max-w-[380px]")}>
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
    );

    if (mode === "page") {
        return (
            <div className="flex h-full min-h-0 flex-1 flex-col bg-app-bg">
                {content}
            </div>
        );
    }

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                showCloseButton={false}
                className="!max-w-[920px] !w-[920px] !p-0 !gap-0 overflow-hidden border border-border-subtle bg-card"
            >
                <DialogTitle className="sr-only">
                    {initialData ? "Edit Connection" : "New Connection"}
                </DialogTitle>
                <DialogDescription className="sr-only">
                    Configure a database connection and optionally use Quick Connect presets.
                </DialogDescription>
                {content}
            </DialogContent>
        </Dialog>
    );
};
export default ConnectionDialog;
