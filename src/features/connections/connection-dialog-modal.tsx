import { startTransition, useEffect, useRef, useState } from "react";
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
    ShieldAlert,
} from "lucide-react";
import { ConnectionConfig } from "@/types";
import { useAppStore } from "@/stores/useAppStore";
import { useShallow } from "zustand/react/shallow";
import { tauriApi } from "@/lib/tauri-api";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
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
import { DB_COLOR, DB_LOGO as DB_LOGOS } from "@/components/shared/db-ui";
import { EngineSelector } from "@/features/connections/components/engine-selector";
import { GroupSelector } from "@/features/connections/components/group-selector";
import { EngineFields } from "@/features/connections/components/engine-fields";
import { SshTunnelSection } from "@/features/connections/components/ssh-tunnel-section";
import { resolveEnv } from "@/lib/env-safety";
import { EnvBadge } from "@/components/ui/env-badge";
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
const ENGINE_LABELS: Record<string, string> = {
    postgresql: "PostgreSQL",
    mysql: "MySQL",
    sqlite: "SQLite",
    mongodb: "MongoDB",
    redis: "Redis",
};
const DEFAULT_DIALOG_TAB = "quick-connect";
const tabTriggerBaseClass =
    "flex h-7 min-w-[116px] items-center justify-center gap-1.5 rounded-md border px-2.5 text-[11px] font-medium transition-colors";
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
        <div className="flex items-center gap-2 rounded-md border border-border bg-popover px-2.5 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-fg-muted shrink-0">
                Preview
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
                "flex size-5 items-center justify-center rounded-sm border text-[10px] font-bold leading-none",
                active
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border bg-transparent text-muted-foreground/55",
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
    } = useAppStore(
        useShallow((s) => ({
            connections: s.connections,
            addConnection: s.addConnection,
            updateConnection: s.updateConnection,
            deleteConnection: s.deleteConnection,
            connectAndInit: s.connectAndInit,
        })),
    );
    const [isTesting, setIsTesting] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isCancellingConnect, setIsCancellingConnect] = useState(false);
    const [testStatus, setTestStatus] = useState<"idle" | "success" | "error">("idle");
    // Delete confirmation — was a one-click destructive action with no guard (P2).
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const connectCancelRef = useRef(false);
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
    // Auto-suggest a function prefix from the connection name. The guard
    // (prev.prefix === suggested) is critical: without it, setFormData creates a
    // NEW object every time the effect runs, even when the prefix value is
    // identical. In React 19 + StrictMode the effect is double-invoked on mount,
    // and combined with unrelated store updates (the component previously
    // subscribed to the entire store via useAppStore()), the cascade of
    // unnecessary re-renders exceeded React's "Maximum update depth" limit.
    // Returning `prev` (same reference) lets React bail out of the re-render.
    useEffect(() => {
        if (!prefixManuallyEdited && formData.name) {
            const suggested = suggestPrefix(formData.name || "");
            setFormData((prev) =>
                prev.prefix === suggested
                    ? prev
                    : { ...prev, prefix: suggested },
            );
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
        connectCancelRef.current = false;
        setIsCancellingConnect(false);
        setIsConnecting(true);
        try {
            const connected = await connectAndInit(config.id, {
                isCancelled: () => connectCancelRef.current,
            });
            if (connected) {
                onClose();
            } else if (connectCancelRef.current) {
                toast.info("Connection request cancelled");
            }
        } finally {
            setIsConnecting(false);
            setIsCancellingConnect(false);
        }
    };
    const handleCancelConnect = () => {
        connectCancelRef.current = true;
        setIsCancellingConnect(true);
    };
    const handleDelete = () => {
        if (initialData?.id) {
            deleteConnection(initialData.id);
            toast.success("Connection deleted");
            onClose();
        }
    };
    // Whether the connection we're editing is currently connected — surfaced in
    // the delete confirm so the user knows deletion also drops the live session.
    const isCurrentlyConnected = useAppStore(
        (s) => !!initialData?.id && s.connectedIds.includes(initialData.id),
    );
    // ── Render ───────────────────────────────────────────────────────────────────
    const selectedEngine = formData.type ?? "postgresql";
    const SelectedEngineLogo = DB_LOGOS[selectedEngine] ?? DB_LOGOS.postgresql;
    const selectedEngineLabel = ENGINE_LABELS[selectedEngine] ?? "Database";
    // Ambient-safety consistency (P4): resolve the group → env and surface a
    // nudge when a prod/staging connection has no write guardrail. The env-safety
    // system in the title bar (App.tsx) and this dialog must agree.
    const envKind = resolveEnv(formData.group);
    const relevantEnvKind = envKind && envKind !== "local" ? envKind : null;
    const isUnguardedEnv =
        !!relevantEnvKind && (formData.safetyMode ?? "none") === "none";
    const showEnvNudge = isUnguardedEnv;

    // ── Form semantics (P10) ──────────────────────────────────────────────
    // Wrap the dialog body in a <form> (display:contents so layout is unaffected).
    // Enter anywhere submits → Connect now (the primary action). Test/Save/Delete/
    // Close/Cancel are explicitly type="button" so they don't steal submit.
    const [nameTouched, setNameTouched] = useState(false);
    const nameMissing = !formData.name?.trim();
    const showNameError = nameTouched && nameMissing;
    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (nameMissing) {
            setNameTouched(true);
            return;
        }
        void handleConnect();
    };

    const content = (
        <form onSubmit={handleFormSubmit} className="contents">
        <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className={cn(
                "flex flex-col overflow-hidden bg-background",
                mode === "modal" ? "h-[600px]" : "h-full min-h-0",
            )}
        >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-5 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-popover">
                        <SelectedEngineLogo className={cn("text-lg", DB_COLOR[selectedEngine])} />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">
                                {initialData ? "Edit Connection" : "New Connection"}
                            </h2>
                            <Badge variant="outline" className="h-5 rounded-sm px-2 text-[10px]">
                                {selectedEngineLabel}
                            </Badge>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-fg-muted">
                            {initialData
                                ? activeTab === "quick-connect"
                                    ? "Paste a new URI to re-point this connection."
                                    : `Editing ${initialData.name}`
                                : activeTab === "quick-connect"
                                    ? "Start from a URI or local preset."
                                    : "Review details, security, and connect."}
                        </p>
                    </div>
                </div>

                {/* Tabs available in BOTH new and edit mode (P6): previously the
                    stepper was hidden in edit mode, so edit couldn’t reach Quick
                    Connect / URI re-parse. Step badges are only shown for new — edit is
                    a single surface, not a numbered wizard. */}
                <TabsList
                    variant="line"
                    className="grid h-8 auto-cols-fr grid-flow-col shrink-0 bg-card p-0.5"
                >
                    <TabsTrigger
                        value="quick-connect"
                        className={cn(
                            tabTriggerBaseClass,
                            activeTab === "quick-connect"
                                ? "border-border bg-popover text-foreground [&_svg]:text-foreground"
                                : "border-transparent bg-transparent text-fg-muted hover:text-foreground/80 [&_svg]:text-muted-foreground/45",
                        )}
                    >
                        {!initialData && <StepBadge step="1" active={activeTab === "quick-connect"} />}
                        <WandSparkles data-icon="inline-start" />
                        {initialData ? "Re-parse URI" : "Quick Connect"}
                    </TabsTrigger>
                    <TabsTrigger
                        value="details"
                        className={cn(
                            tabTriggerBaseClass,
                            activeTab === "details"
                                ? "border-border bg-popover text-foreground [&_svg]:text-foreground"
                                : "border-transparent bg-transparent text-fg-muted hover:text-foreground/80 [&_svg]:text-muted-foreground/45",
                        )}
                    >
                        {!initialData && <StepBadge step="2" active={activeTab === "details"} />}
                        <LayoutTemplate data-icon="inline-start" />
                        Details
                    </TabsTrigger>
                </TabsList>
            </div>

            <TabsContent value="details" className="min-h-0 flex-1 overflow-hidden">
                <div className="flex h-full min-h-0 flex-col bg-background">
                    <EngineSelector
                        selectedType={selectedEngine}
                        onSelect={handleEngineChange}
                    />

                    <div className="flex-1 overflow-y-auto px-4 py-4">
                        <div className={cn("mx-auto flex w-full flex-col gap-3", isPageMode ? "max-w-6xl" : "max-w-4xl")}>
                            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px]">
                                <div className="flex min-w-0 flex-col gap-3">
                                    <div className="rounded-md border border-border bg-card">
                                        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
                                            <div className="min-w-0">
                                                <p className="shell-section-label">Details</p>
                                                <p className="mt-0.5 truncate text-[11px] text-muted-foreground/64">
                                                    Saved locally as the connection profile.
                                                </p>
                                            </div>
                                            {!initialData && (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setActiveTab("quick-connect")}
                                                    className="h-7 shrink-0 px-2.5 text-[11px]"
                                                >
                                                    Back
                                                </Button>
                                            )}
                                        </div>

                                        <div className="p-3">
                                            <FieldGroup className="gap-3">
                                                <div className="grid gap-2.5 md:grid-cols-2">
                                                    <Field className="gap-1.5">
                                                        <FieldLabel className="text-xs">
                                                            <Tag className="mr-1 inline size-3 opacity-60" />
                                                            Connection Name
                                                            <span className="ml-0.5 text-destructive">*</span>
                                                        </FieldLabel>
                                                        <Input
                                                            value={formData.name || ""}
                                                            onChange={(e) => {
                                                                patch({ name: e.target.value });
                                                                if (e.target.value.trim()) setNameTouched(false);
                                                            }}
                                                            onBlur={() => setNameTouched(true)}
                                                            aria-invalid={showNameError}
                                                            placeholder="e.g. Production Analytics"
                                                            className={cn(
                                                                "h-9 bg-popover text-xs",
                                                                showNameError
                                                                    ? "border-destructive focus-visible:ring-destructive/30"
                                                                    : "border-border",
                                                            )}
                                                        />
                                                        {showNameError && (
                                                            <p className="text-[11px] text-destructive">
                                                                Name is required to save or connect.
                                                            </p>
                                                        )}
                                                    </Field>
                                                    <Field className="gap-1.5">
                                                        <FieldLabel className="text-xs">
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
                                                                className="h-9 flex-1 border-border bg-popover font-mono text-xs"
                                                            />
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => {
                                                                    setPrefixManuallyEdited(false);
                                                                    patch({ prefix: suggestPrefix(formData.name || "") });
                                                                }}
                                                                className="h-9 shrink-0 px-3 text-[10px] font-bold uppercase"
                                                            >
                                                                Auto
                                                            </Button>
                                                        </div>
                                                        {formData.prefix && (
                                                            <FieldDescription className="text-[10px] font-mono text-muted-foreground/46">
                                                                <span className="text-foreground/52">{formData.prefix}_list()</span>
                                                                {" | "}
                                                                <span className="text-foreground/52">{formData.prefix}_query()</span>
                                                                {" | ..."}
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
                                    </div>

                                    <div className="rounded-md border border-border bg-card">
                                        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                                            <CollapsibleTrigger asChild>
                                                <button
                                                    type="button"
                                                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                                                >
                                                    <div className="flex min-w-0 items-center gap-2.5">
                                                        <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-popover text-muted-foreground">
                                                            <Settings2 size={14} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-[13px] font-medium text-foreground">Advanced Options</p>
                                                            <p className="mt-0.5 text-xs text-muted-foreground/62">
                                                                SSL, SSH tunnel, safety mode, and URL preview.
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <ChevronDown
                                                        size={14}
                                                        className={cn(
                                                            "shrink-0 text-muted-foreground/55 transition-transform",
                                                            advancedOpen && "rotate-180",
                                                        )}
                                                    />
                                                </button>
                                            </CollapsibleTrigger>

                                            <CollapsibleContent>
                                                <div className="flex flex-col gap-3 border-t border-border px-4 py-3">
                                                    {formData.type !== "sqlite" && (
                                                        // Outer element is a <div role="button">, NOT a <button>.
                                                        // The <Switch> renders a <button> internally, and nesting
                                                        // <button> inside <button> is invalid HTML — the browser
                                                        // auto-closes the outer button, creating a DOM mismatch
                                                        // with React's vDOM that causes "Maximum update depth
                                                        // exceeded" via infinite reconciliation.
                                                        <div
                                                            role="button"
                                                            tabIndex={0}
                                                            aria-pressed={!!formData.ssl}
                                                            onClick={() => patch({ ssl: !formData.ssl })}
                                                            onKeyDown={(e) => {
                                                                if (e.key === "Enter" || e.key === " ") {
                                                                    e.preventDefault();
                                                                    patch({ ssl: !formData.ssl });
                                                                }
                                                            }}
                                                            className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-md border border-border bg-popover px-3 py-2.5 text-left transition-colors hover:bg-card focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                                                        >
                                                            <div className="min-w-0">
                                                                <p className="text-[12px] font-semibold text-foreground">SSL / TLS Encryption</p>
                                                                <p className="mt-0.5 text-[11px] text-fg-muted">
                                                                    Encrypt traffic in transit for remote or managed databases.
                                                                </p>
                                                            </div>
                                                            {/* The <span> wrapper with stopPropagation is critical: Radix
                                                                Switch renders a hidden <input type="checkbox">
                                                                (SwitchBubbleInput) when inside a <form>. That input has a
                                                                useEffect that dispatches a synthetic "click" event with
                                                                bubbles:true whenever `checked` changes. Without the stopPropagation
                                                                wrapper, that click bubbles to this outer toggle div, which
                                                                toggles the state back → infinite loop → "Maximum update depth
                                                                exceeded". The Switch is purely visual (pointer-events-none);
                                                                the outer div handles all interaction. */}
                                                            <span
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="shrink-0"
                                                            >
                                                                <Switch
                                                                    checked={!!formData.ssl}
                                                                    aria-hidden="true"
                                                                    tabIndex={-1}
                                                                    className="pointer-events-none"
                                                                />
                                                            </span>
                                                        </div>
                                                    )}

                                                    {formData.type !== "sqlite" && (
                                                        <SshTunnelSection formData={formData} onPatch={patch} />
                                                    )}

                                                    <div className="flex items-start gap-3 rounded-md border border-border bg-popover px-3 py-2.5">
                                                        <ShieldAlert size={14} className="mt-0.5 shrink-0 text-foreground/42" />
                                                        <div className="flex min-w-0 flex-1 flex-col gap-2">
                                                            <span className="text-[12px] font-medium text-foreground/82">Safety Mode</span>
                                                            <div className="flex flex-wrap gap-2">
                                                                {(["none", "warn", "read-only"] as const).map((mode) => (
                                                                    <button
                                                                        key={mode}
                                                                        type="button"
                                                                        onClick={() => patch({ safetyMode: mode })}
                                                                        className={cn(
                                                                            "rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors",
                                                                            (formData.safetyMode ?? "none") === mode
                                                                                ? mode === "read-only"
                                                                                    // Read-only is the *protective* mode — paint it success/green, not
                                                                                    // destructive red. Red is reserved for intent that destroys data.
                                                                                    ? "border-success/40 bg-success/15 text-success"
                                                                                    : mode === "warn"
                                                                                        ? "border-accent-orange/40 bg-accent-orange/15 text-accent-orange"
                                                                                        : "border-border bg-muted text-foreground"
                                                                                : "border-border bg-transparent text-foreground/60 hover:border-border hover:text-foreground/80",
                                                                        )}
                                                                    >
                                                                        {mode === "none" ? "None" : mode === "warn" ? "Warn on write" : "Read-only"}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                            <span className="text-[11px] leading-snug text-foreground/42">
                                                                {(formData.safetyMode ?? "none") === "warn"
                                                                    ? "Shows a confirmation dialog before any INSERT, UPDATE, or DELETE."
                                                                    : (formData.safetyMode ?? "none") === "read-only"
                                                                        ? "Blocks all write queries on this connection."
                                                                        : "No restrictions. Queries run without extra prompts."}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <ConnectionUrlPreview formData={formData} />
                                                </div>
                                            </CollapsibleContent>
                                        </Collapsible>
                                    </div>
                                </div>

                                <aside className="flex min-w-0 flex-col gap-3">
                                    <div className="rounded-md border border-border bg-card p-3">
                                        <div className="flex items-center justify-between">
                                            <p className="shell-section-label">Group</p>
                                            {relevantEnvKind && (
                                                <EnvBadge env={relevantEnvKind} icon={relevantEnvKind === "prod"} />
                                            )}
                                        </div>
                                        <div className="mt-2">
                                            <GroupSelector
                                                group={formData.group}
                                                onChange={(g) => patch({ group: g })}
                                            />
                                        </div>
                                        {showEnvNudge && (
                                            <button
                                                type="button"
                                                onClick={() => patch({ safetyMode: "warn" })}
                                                className="mt-3 flex w-full items-start gap-2 rounded-md border border-env-staging/35 bg-env-staging/10 px-2.5 py-2 text-left transition-colors hover:border-env-staging/55 hover:bg-env-staging/15"
                                                style={{ color: "var(--env-staging)" }}
                                            >
                                                <ShieldAlert size={13} className="mt-0.5 shrink-0" />
                                                <span className="min-w-0 flex-1 text-[11px] leading-snug">
                                                    {relevantEnvKind === "prod"
                                                        ? "Production connection with no write protection. Tap to enable “Warn on write” before you risk accidental data loss."
                                                        : "Staging connection with no write protection. Tap to enable “Warn on write”."}
                                                </span>
                                            </button>
                                        )}
                                    </div>

                                    <div className="rounded-md border border-border bg-card p-3">
                                        <p className="shell-section-label">Connection Preview</p>
                                        <div className="mt-2 flex items-center gap-2.5">
                                            <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-popover">
                                                <SelectedEngineLogo className={cn("text-lg", DB_COLOR[selectedEngine])} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="truncate text-[13px] font-semibold text-foreground">
                                                    {formData.name || "Untitled"}
                                                </p>
                                                <p className="text-[11px] text-fg-muted">
                                                    {selectedEngineLabel}
                                                </p>
                                            </div>
                                        </div>
                                        {/* URL preview intentionally only shown once (P5): the same
                                            ConnectionUrlPreview lives in Advanced Options, so we don’t
                                            duplicate it here. */}
                                    </div>
                                </aside>
                            </div>
                        </div>
                    </div>
                </div>
            </TabsContent>

            <TabsContent value="quick-connect" className="min-h-0 flex-1 overflow-hidden">
                    <div className="h-full min-h-0 overflow-y-auto p-4">
                        <div className={cn("mx-auto flex min-w-0 flex-col gap-3", isPageMode ? "max-w-6xl" : "max-w-4xl")}>
                            <Card size="sm" className="!gap-0 border-border bg-card py-0 shadow-none ring-0">
                                <CardHeader className="border-b border-border !py-2.5 !pb-2.5">
                                    <CardTitle className="flex items-center gap-2 text-sm">
                                        <Link2 className="size-4 text-muted-foreground" />
                                        Paste Connection URI
                                    </CardTitle>
                                    <CardDescription className="text-xs">
                                        A valid URI auto-fills engine, host, port, database, and credentials.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="py-3">
                                    <FieldGroup className="gap-2.5">
                                        <Field className="gap-1.5">
                                            <FieldLabel className="text-xs">Connection URI</FieldLabel>
                                            <div className="flex gap-2">
                                                <Input
                                                    value={uriInput}
                                                    onChange={(e) => setUriInput(e.target.value)}
                                                    placeholder="postgresql://user:pass@host:5432/db"
                                                    className="h-9 flex-1 border-border bg-popover font-mono text-[11px]"
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
                                                    className="h-9 shrink-0 px-3 text-[10px] font-bold uppercase"
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

                            <Card size="sm" className="!gap-0 border-border bg-card py-0 shadow-none ring-0">
                                <CardHeader className="border-b border-border !py-2.5 !pb-2.5">
                                    <CardTitle className="flex items-center gap-2 text-sm">
                                        <Zap className="size-4 text-muted-foreground" />
                                        Local Presets
                                    </CardTitle>
                                    <CardDescription className="text-xs">
                                        Choose a starting point, then review the details before saving or connecting.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="py-3">
                                    <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3 lg:grid-cols-5">
                                        {QUICK_PRESETS.map((preset) => {
                                            const Logo = DB_LOGOS[preset.engine];
                                            return (
                                                <button
                                                    key={preset.label}
                                                    type="button"
                                                    onClick={() => handlePreset(preset)}
                                                    className="group flex min-h-[58px] items-center gap-2.5 rounded-md border border-border bg-popover p-2.5 text-left transition-colors hover:border-border hover:bg-muted"
                                                >
                                                    <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card">
                                                        <Logo className={cn("text-lg", DB_COLOR[preset.engine])} />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate text-[12px] font-semibold text-foreground">
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
                                                    <ArrowRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

            <div className="shrink-0 border-t border-border bg-card px-5 py-2.5">
                <div className="flex h-full items-center justify-between gap-3">
                    <p className={cn("min-w-0 text-[11px] text-muted-foreground/68 text-pretty", isPageMode ? "max-w-[640px]" : "max-w-[390px]")}>
                        {isConnecting
                            ? isCancellingConnect
                                ? "Cancelling the connection request..."
                                : "Checking database availability and connecting..."
                            : !formData.name
                                ? "Add a connection name to save it or connect."
                                : isDirty
                                    ? "Save keeps this view open. Connect saves first and closes on success."
                                    : "Saved in the background. You can keep editing, close, or connect now."}
                    </p>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleTest}
                            disabled={isTesting || isConnecting}
                            className={cn(
                                "h-7 px-2.5 text-[11px] font-medium gap-1.5",
                                // Success → success/green, NOT primary blue. Primary must stay
                                // reserved for the real primary action (Connect now), otherwise
                                // passing Test visually competes with Connect (P1).
                                testStatus === "success" &&
                                "bg-success/10 text-success border-success/25",
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
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowDeleteConfirm(true)}
                                className="h-7 px-2.5 text-[11px] font-medium text-destructive/60 hover:text-destructive hover:bg-destructive/10 gap-1.5"
                            >
                                <Trash2 size={11} />
                                Delete
                            </Button>
                        )}
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={onClose}
                            disabled={isConnecting}
                            className="h-7 px-2.5 text-[11px] font-medium"
                        >
                            Close
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleSave}
                            disabled={isConnecting || !formData.name || !isDirty}
                            className="h-7 px-2.5 text-[11px] font-medium gap-1.5"
                        >
                            {/* Keep button label constant. Save state lives next to it as a
                                checkmark dot, not as a relabelled disabled button — "Saved" as
                                a button label is both action and status and trains users to
                                ignore disabled controls (P1). */}
                            {!isDirty && initialData && (
                                <span
                                    aria-hidden="true"
                                    className="size-1.5 rounded-full bg-success"
                                    title="All changes saved"
                                />
                            )}
                            Save
                        </Button>
                        <Button
                            type="submit"
                            size="sm"
                            // No onClick: the surrounding <form onSubmit={handleFormSubmit}>
                            // handles the submit. Keeping onClick too would double-fire handleConnect.
                            disabled={isConnecting || !formData.name}
                            className="h-7 px-3 text-[11px] font-medium gap-1.5 active:scale-[0.97]"
                        >
                            {isConnecting ? (
                                <Loader2 size={11} className="animate-spin" />
                            ) : (
                                <CheckCircle2 size={11} />
                            )}
                            {isConnecting
                                ? isCancellingConnect
                                    ? "Cancelling..."
                                    : "Connecting..."
                                : "Connect now"}
                        </Button>
                        {isConnecting && !isCancellingConnect && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleCancelConnect}
                                className="h-7 px-2.5 text-[11px] font-medium"
                            >
                                Cancel
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </Tabs>
        </form>
    );

    // Delete confirmation — irreversible; reuses the shared AlertDialog primitive
    // (P2: delete was previously one click with no guard).
    const deleteConfirmDialog = (
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
            <AlertDialogContent className="max-w-sm">
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete connection?</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                        <div className="flex flex-col gap-2">
                            <span>
                                <span className="font-mono text-foreground">
                                    {initialData?.name ?? "this connection"}
                                </span>{' '}
                                will be permanently removed from your saved connections.
                            </span>
                            {isCurrentlyConnected && (
                                <span className="text-warning">
                                    This connection is currently active and will be disconnected.
                                </span>
                            )}
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        variant="destructive"
                        onClick={() => {
                            setShowDeleteConfirm(false);
                            handleDelete();
                        }}
                    >
                        <Trash2 size={12} />
                        Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );

    if (mode === "page") {
        return (
            <div className="flex h-full min-h-0 flex-1 flex-col bg-background">
                {content}
                {deleteConfirmDialog}
            </div>
        );
    }

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                showCloseButton={false}
                className="!max-w-[920px] !w-[min(920px,calc(100vw-24px))] !p-0 !gap-0 overflow-hidden border border-border bg-card"
            >
                <DialogTitle className="sr-only">
                    {initialData ? "Edit Connection" : "New Connection"}
                </DialogTitle>
                <DialogDescription className="sr-only">
                    Configure a database connection and optionally use Quick Connect presets.
                </DialogDescription>
                {content}
            </DialogContent>
            {deleteConfirmDialog}
        </Dialog>
    );
};
export default ConnectionDialog;
