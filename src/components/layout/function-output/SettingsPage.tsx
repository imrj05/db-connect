import { useEffect, useRef, useState } from "react";
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
    ArrowLeft,
    Check,
    ChevronDown,
    Loader2,
    Bot,
    Wand2,
    ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { getSystemFonts, DB_FONT_SANS, DB_FONT_MONO, DB_FONT_SANS_STACK, DB_FONT_MONO_STACK } from "@/lib/fonts";
import { useAppStore, AppSettings, EditorThemeOption, UiDarkThemeOption, UiLightThemeOption } from "@/store/useAppStore";
import { tauriApi, type AiProvider } from "@/lib/tauri-api";
import { licenseGetStored, licenseDeactivate, type StoredLicenseState } from "@/lib/license";
import packageJson from "../../../../package.json";

type Section = "appearance" | "editor" | "table" | "ai" | "storage" | "license" | "about";

const NAV: { id: Section; label: string; icon: React.ReactNode }[] = [
    { id: "appearance", label: "Appearance", icon: <Palette size={13} /> },
    { id: "editor",     label: "Editor",     icon: <Code2 size={13} /> },
    { id: "table",      label: "Table",      icon: <Table2 size={13} /> },
    { id: "ai",         label: "AI",         icon: <Bot size={13} /> },
    { id: "storage",    label: "Storage",    icon: <HardDrive size={13} /> },
    { id: "license",    label: "License",    icon: <KeyRound size={13} /> },
    { id: "about",      label: "About",      icon: <Info size={13} /> },
];

function SectionHeading({ children }: { children: React.ReactNode }) {
    return (
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground/40 mb-3">
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
                    <p className="text-[12px] text-muted-foreground/50 mt-0.5 leading-snug">{description}</p>
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
                        "px-2.5 h-6 rounded-md text-[12px] font-bold transition-colors",
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

// ── Reusable font picker with scroll-to-selected on open ─────────────────────
function FontPicker({
    fonts,
    value,
    fallbackStack,
    defaultAlias,
    defaultAliasStack,
    placeholder,
    onSelect,
}: {
    fonts: { value: string; label: string; isMono: boolean }[];
    value: string;
    fallbackStack: string;
    defaultAlias: string;
    defaultAliasStack: string;
    placeholder: string;
    onSelect: (v: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const listRef = useRef<HTMLDivElement>(null);

    // When the list opens, scroll the selected item into view
    useEffect(() => {
        if (!open) return;
        // Let the DOM paint before scrolling
        const id = requestAnimationFrame(() => {
            const el = listRef.current?.querySelector<HTMLElement>("[data-font-selected='true']");
            el?.scrollIntoView({ block: "nearest" });
        });
        return () => cancelAnimationFrame(id);
    }, [open]);

    const displayLabel = value === defaultAlias
        ? fonts.find(f => f.value === defaultAlias)?.label ?? defaultAlias
        : fonts.find(f => f.value === value)?.label ?? value;

    const displayStack = value === defaultAlias
        ? defaultAliasStack
        : `"${value}", ${fallbackStack}`;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className="h-7 w-44 justify-between text-[13px] font-normal"
                >
                    <span className="truncate" style={{ fontFamily: displayStack }}>
                        {displayLabel}
                    </span>
                    <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0" align="start">
                <Command>
                    <CommandInput placeholder={placeholder} className="h-9 text-[13px]" />
                    <CommandList className="max-h-60" ref={listRef}>
                        <CommandEmpty>No fonts found.</CommandEmpty>
                        {fonts.map((f) => {
                            const isSelected = value === f.value;
                            const fontStack = f.value === defaultAlias
                                ? defaultAliasStack
                                : `"${f.value}", ${fallbackStack}`;
                            return (
                                <CommandItem
                                    key={f.value}
                                    value={f.value}
                                    onSelect={() => { onSelect(f.value); setOpen(false); }}
                                    className="text-[13px]"
                                    data-font-selected={isSelected ? "true" : undefined}
                                >
                                    <span style={{ fontFamily: fontStack }}>{f.label}</span>
                                    {isSelected && <Check className="ml-auto h-4 w-4" />}
                                </CommandItem>
                            );
                        })}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

function AppearanceSection() {
    const { theme, setTheme, appSettings, updateAppSetting } = useAppStore();
    const [systemFonts, setSystemFonts] = useState<{ value: string; label: string; isMono: boolean }[]>([]);
    const [loadingFonts, setLoadingFonts] = useState(true);

    useEffect(() => {
        getSystemFonts().then(fonts => {
            setSystemFonts(fonts);
            setLoadingFonts(false);
        }).catch(() => {
            // Handle error - just show empty
            setLoadingFonts(false);
        });
    }, []);

    const sansFonts = systemFonts.filter(f => !f.isMono);
    const monoFonts = systemFonts.filter(f => f.isMono);

    const uiDarkThemes: { value: UiDarkThemeOption; label: string }[] = [
        { value: "dark", label: "Dark" },
        { value: "dim", label: "Dim" },
        { value: "midnight", label: "Midnight" },
        { value: "catppuccin-mocha", label: "Catppuccin Mocha" },
        { value: "nord", label: "Nord" },
        { value: "dracula", label: "Dracula" },
        { value: "one-dark", label: "One Dark" },
        { value: "github-dark", label: "GitHub Dark" },
        { value: "slack-dark", label: "Slack Dark" },
        { value: "linear", label: "Linear" },
        { value: "voyage", label: "Voyage" },
        { value: "astro", label: "Astro" },
        { value: "night-owl", label: "Night Owl" },
        { value: "borland", label: "Borland" },
        { value: "metals", label: "Metals" },
    ];

    const uiLightThemes: { value: UiLightThemeOption; label: string }[] = [
        { value: "light", label: "Light" },
        { value: "sunrise", label: "Sunrise" },
        { value: "cream", label: "Cream" },
        { value: "catppuccin-latte", label: "Catppuccin Latte" },
        { value: "nord-light", label: "Nord Light" },
        { value: "github-light", label: "GitHub Light" },
        { value: "slack-zen", label: "Slack Zen" },
        { value: "linear-light", label: "Linear Light" },
        { value: "voyage-light", label: "Voyage Light" },
        { value: "astro-light", label: "Astro Light" },
        { value: "spring", label: "Spring" },
        { value: "monokai-light", label: "Monokai Light" },
        { value: "solarized-light", label: "Solarized Light" },
        { value: "dracula-light", label: "Dracula Light" },
    ];

    return (
        <div>
            <SectionHeading>Appearance</SectionHeading>
            <SettingRow label="App Theme" description="Choose your preferred colour scheme">
                <div className="flex items-center gap-1 bg-muted/50 border border-border/60 rounded-lg p-0.5">
                    {(["dark", "light"] as const).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTheme(t)}
                            className={cn(
                                "flex items-center gap-1.5 h-7 px-3 rounded-md text-[12px] font-bold transition-all capitalize",
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
            {theme === "dark" ? (
                <SettingRow label="Dark Mode Theme" description="Choose the dark variant">
                    <Select
                        value={appSettings.uiDarkTheme}
                        onValueChange={(v) => updateAppSetting("uiDarkTheme", v as UiDarkThemeOption)}
                    >
                        <SelectTrigger className="h-7 w-40">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {uiDarkThemes.map((t) => (
                                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </SettingRow>
            ) : (
                <SettingRow label="Light Mode Theme" description="Choose the light variant">
                    <Select
                        value={appSettings.uiLightTheme}
                        onValueChange={(v) => updateAppSetting("uiLightTheme", v as UiLightThemeOption)}
                    >
                        <SelectTrigger className="h-7 w-40">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {uiLightThemes.map((t) => (
                                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </SettingRow>
            )}
            <SettingRow label="UI Zoom" description="Scale the entire interface up or down">
                <SegmentedControl<AppSettings["uiZoom"]>
                    options={[100, 110, 125, 140, 150]}
                    value={appSettings.uiZoom}
                    onChange={(v) => updateAppSetting("uiZoom", v)}
                    format={(v) => `${v}%`}
                />
            </SettingRow>
            <SettingRow label="Font" description="Sans-serif UI font">
                {loadingFonts ? (
                    <div className="h-7 w-44 flex items-center gap-2 text-[13px] text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading fonts...
                    </div>
                ) : (
                    <FontPicker
                        fonts={sansFonts}
                        value={appSettings.uiFontFamily}
                        fallbackStack="sans-serif"
                        defaultAlias={DB_FONT_SANS}
                        defaultAliasStack={DB_FONT_SANS_STACK}
                        placeholder="Search font..."
                        onSelect={(v) => updateAppSetting("uiFontFamily", v)}
                    />
                )}
            </SettingRow>
            <SettingRow label="Monospace Font" description="Code and data display font">
                {loadingFonts ? (
                    <div className="h-7 w-44 flex items-center gap-2 text-[13px] text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading fonts...
                    </div>
                ) : (
                    <FontPicker
                        fonts={monoFonts}
                        value={appSettings.monoFontFamily}
                        fallbackStack="monospace"
                        defaultAlias={DB_FONT_MONO}
                        defaultAliasStack={DB_FONT_MONO_STACK}
                        placeholder="Search font..."
                        onSelect={(v) => updateAppSetting("monoFontFamily", v)}
                    />
                )}
            </SettingRow>
        </div>
    );
}

function EditorSection() {
    const { appSettings, updateAppSetting } = useAppStore();

    const darkEditorThemes: { value: EditorThemeOption; label: string }[] = [
        { value: "dark-one-dark", label: "One Dark" },
        { value: "dark-monokai", label: "Monokai" },
        { value: "dark-palenight", label: "Palenight" },
        { value: "dark-dracula", label: "Dracula" },
    ];

    const lightEditorThemes: { value: EditorThemeOption; label: string }[] = [
        { value: "light-github", label: "GitHub Light" },
        { value: "light-solarized", label: "Solarized Light" },
        { value: "light-white-pine", label: "White Pine" },
        { value: "light-soft-white", label: "Soft White" },
    ];

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
            <SettingRow
                label="Dark Theme"
                description="SQL syntax highlighting for dark mode"
            >
                <Select
                    value={appSettings.editorDarkTheme}
                    onValueChange={(v) => updateAppSetting("editorDarkTheme", v as EditorThemeOption)}
                >
                    <SelectTrigger className="h-7 w-36">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {darkEditorThemes.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </SettingRow>
            <SettingRow
                label="Light Theme"
                description="SQL syntax highlighting for light mode"
            >
                <Select
                    value={appSettings.editorLightTheme}
                    onValueChange={(v) => updateAppSetting("editorLightTheme", v as EditorThemeOption)}
                >
                    <SelectTrigger className="h-7 w-36">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {lightEditorThemes.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
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

function AiSection() {
    const { appSettings, updateAppSetting } = useAppStore();
    const PROVIDERS: { id: AiProvider; label: string }[] = [
        { id: "openrouter", label: "OpenRouter" },
        { id: "opencode", label: "OpenCode" },
        { id: "openai", label: "OpenAI" },
        { id: "codex", label: "Codex (OpenAI)" },
        { id: "github-copilot", label: "GitHub Copilot" },
        { id: "anthropic", label: "Anthropic" },
        { id: "groq", label: "Groq" },
        { id: "gemini", label: "Google Gemini" },
    ];
    const PROVIDER_GUIDE: Record<AiProvider, { keysUrl: string; helper: string; placeholder: string }> = {
        openrouter: {
            keysUrl: "https://openrouter.ai/settings/keys",
            helper: "Use OAuth or an API key to power AI in DB Connect.",
            placeholder: "sk-or-v1-...",
        },
        opencode: {
            keysUrl: "https://openrouter.ai/settings/keys",
            helper: "OpenCode provider uses OpenRouter-compatible API keys.",
            placeholder: "sk-or-v1-...",
        },
        openai: {
            keysUrl: "https://platform.openai.com/api-keys",
            helper: "Create a secret key in OpenAI dashboard for DB Connect.",
            placeholder: "sk-...",
        },
        codex: {
            keysUrl: "https://platform.openai.com/api-keys",
            helper: "Codex uses OpenAI API keys and models in DB Connect.",
            placeholder: "sk-...",
        },
        "github-copilot": {
            keysUrl: "https://github.com/settings/tokens",
            helper: "Use a GitHub token with models access for GitHub Models/Copilot APIs.",
            placeholder: "github_pat_...",
        },
        anthropic: {
            keysUrl: "https://console.anthropic.com/settings/keys",
            helper: "Create an Anthropic API key for DB Connect.",
            placeholder: "sk-ant-...",
        },
        groq: {
            keysUrl: "https://console.groq.com/keys",
            helper: "Create a Groq API key for DB Connect.",
            placeholder: "gsk_...",
        },
        gemini: {
            keysUrl: "https://aistudio.google.com/app/apikey",
            helper: "Create a Gemini API key in Google AI Studio.",
            placeholder: "AIza...",
        },
    };
    const MODEL_PRESETS: Record<AiProvider, { id: string; label: string }[]> = {
        openrouter: [
            { id: "openrouter/free", label: "OpenRouter Free Router" },
            { id: "meta-llama/llama-3.3-70b-instruct:free", label: "Llama 3.3 70B :free" },
            { id: "qwen/qwen-2.5-coder-32b-instruct:free", label: "Qwen 2.5 Coder :free" },
            { id: "deepseek/deepseek-r1:free", label: "DeepSeek R1 :free" },
        ],
        opencode: [
            { id: "openrouter/free", label: "OpenRouter Free Router" },
            { id: "openai/gpt-4.1-mini", label: "OpenRouter GPT-4.1 Mini" },
            { id: "anthropic/claude-3.5-haiku", label: "OpenRouter Claude 3.5 Haiku" },
        ],
        openai: [
            { id: "gpt-4o-mini", label: "GPT-4o Mini" },
            { id: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
        ],
        codex: [
            { id: "gpt-5", label: "GPT-5" },
            { id: "gpt-5-mini", label: "GPT-5 Mini" },
        ],
        "github-copilot": [
            { id: "openai/gpt-4.1-mini", label: "OpenAI GPT-4.1 Mini" },
            { id: "openai/gpt-4o-mini", label: "OpenAI GPT-4o Mini" },
            { id: "deepseek/deepseek-r1", label: "DeepSeek R1" },
        ],
        anthropic: [
            { id: "claude-3-5-haiku-latest", label: "Claude 3.5 Haiku" },
            { id: "claude-3-7-sonnet-latest", label: "Claude 3.7 Sonnet" },
        ],
        groq: [
            { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant" },
            { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B Versatile" },
        ],
        gemini: [
            { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
            { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
        ],
    };

    const [status, setStatus] = useState<{ provider: string; authMode: string; configured: boolean; maskedKey: string | null } | null>(null);
    const [apiKeyInput, setApiKeyInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [oauthLoading, setOauthLoading] = useState(false);
    const [oauthFlowId, setOauthFlowId] = useState<string | null>(null);

    const providerLabel = PROVIDERS.find((p) => p.id === appSettings.aiProvider)?.label ?? "AI Provider";
    const providerGuide = PROVIDER_GUIDE[appSettings.aiProvider];
    const oauthSupported = appSettings.aiProvider === "openrouter";
    const activeModelPresets = MODEL_PRESETS[appSettings.aiProvider] ?? [];
    const selectedPreset = activeModelPresets.some((m) => m.id === appSettings.aiDefaultModel)
        ? appSettings.aiDefaultModel
        : "custom";

    useEffect(() => {
        if (!oauthSupported && appSettings.aiAuthMode !== "api_key") {
            updateAppSetting("aiAuthMode", "api_key");
        }
    }, [oauthSupported, appSettings.aiAuthMode, updateAppSetting]);

    const loadStatus = async () => {
        try {
            const s = await tauriApi.aiGetCredentialStatus(appSettings.aiProvider);
            setStatus(s);
        } catch {
            setStatus(null);
        }
    };

    useEffect(() => {
        loadStatus();
    }, [appSettings.aiProvider]);

    const handleSaveApiKey = async () => {
        if (!apiKeyInput.trim()) return;
        setLoading(true);
        try {
            const s = await tauriApi.aiSaveApiKey(appSettings.aiProvider, apiKeyInput.trim());
            setStatus(s);
            setApiKeyInput("");
        } finally {
            setLoading(false);
        }
    };

    const handleTestApiKey = async () => {
        if (!apiKeyInput.trim()) return;
        setLoading(true);
        try {
            await tauriApi.aiTestApiKey(appSettings.aiProvider, apiKeyInput.trim());
        } finally {
            setLoading(false);
        }
    };

    const handleOAuthConnect = async () => {
        if (!oauthSupported) return;
        setOauthLoading(true);
        try {
            const begin = await tauriApi.openrouterOauthBegin();
            setOauthFlowId(begin.flowId);
            await tauriApi.openExternalUrl(begin.authUrl);
            const s = await tauriApi.openrouterOauthComplete(begin.flowId);
            setStatus(s);
        } finally {
            setOauthLoading(false);
            setOauthFlowId(null);
        }
    };

    const handleClearCredential = async () => {
        setLoading(true);
        try {
            await tauriApi.aiClearCredential(appSettings.aiProvider);
            await loadStatus();
            setApiKeyInput("");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <SectionHeading>AI</SectionHeading>
            <SettingRow
                label="Enable AI"
                description="Turn on AI-assisted SQL generation in the editor"
            >
                <Switch
                    checked={appSettings.aiEnabled}
                    onCheckedChange={(v) => updateAppSetting("aiEnabled", !!v)}
                />
            </SettingRow>
            <SettingRow
                label="Provider"
                description="Model provider used by SQL assistant"
            >
                <Select
                    value={appSettings.aiProvider}
                    onValueChange={(v) => updateAppSetting("aiProvider", v as AppSettings["aiProvider"])}
                >
                    <SelectTrigger className="h-7 w-44">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {PROVIDERS.map((provider) => (
                            <SelectItem key={provider.id} value={provider.id}>{provider.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </SettingRow>
            <SettingRow
                label="Auth Mode"
                description="Choose API key or OAuth auth-code flow"
            >
                <Select
                    value={appSettings.aiAuthMode}
                    onValueChange={(v) => updateAppSetting("aiAuthMode", v as "api_key" | "oauth")}
                >
                    <SelectTrigger className="h-7 w-44">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="api_key">API Key</SelectItem>
                        {oauthSupported && <SelectItem value="oauth">OAuth (Localhost)</SelectItem>}
                    </SelectContent>
                </Select>
            </SettingRow>
            <SettingRow
                label="Default Model"
                description={`${providerLabel} model id`}
            >
                <div className="flex items-center gap-2">
                    <Select
                        value={selectedPreset}
                        onValueChange={(v) => {
                            if (v === "custom") return;
                            updateAppSetting("aiDefaultModel", v);
                        }}
                    >
                        <SelectTrigger className="h-7 w-56">
                            <SelectValue placeholder="Choose preset" />
                        </SelectTrigger>
                        <SelectContent>
                            {activeModelPresets.map((preset) => (
                                <SelectItem key={preset.id} value={preset.id}>
                                    {preset.label}
                                </SelectItem>
                            ))}
                            <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                    </Select>
                    <Input
                        value={appSettings.aiDefaultModel}
                        onChange={(e) => updateAppSetting("aiDefaultModel", e.target.value || activeModelPresets[0]?.id || "openrouter/free")}
                        className="h-7 w-72 text-[12px] font-mono"
                        placeholder={activeModelPresets[0]?.id || "openrouter/free"}
                    />
                </div>
            </SettingRow>

            <SettingRow
                label="API Key Portal"
                description={providerGuide.helper}
            >
                <Button
                    size="xs"
                    variant="outline"
                    className="h-7 gap-1.5"
                    onClick={() => tauriApi.openExternalUrl(providerGuide.keysUrl)}
                >
                    Open Keys Page
                    <ExternalLink size={10} />
                </Button>
            </SettingRow>

            {appSettings.aiAuthMode === "api_key" || !oauthSupported ? (
                <>
                    <SettingRow
                        label={`${providerLabel} API Key`}
                        description={status?.configured && status.maskedKey
                            ? `Saved: ${status.maskedKey}`
                            : "Paste key and save securely"}
                    >
                        <div className="flex items-center gap-2">
                            <Input
                                type="password"
                                value={apiKeyInput}
                                onChange={(e) => setApiKeyInput(e.target.value)}
                                className="h-7 w-72 text-[12px] font-mono"
                                placeholder={providerGuide.placeholder}
                            />
                            <Button
                                size="xs"
                                variant="outline"
                                onClick={handleTestApiKey}
                                disabled={loading || !apiKeyInput.trim()}
                                className="h-7"
                            >
                                {loading ? <Loader2 size={11} className="animate-spin" /> : "Test"}
                            </Button>
                            <Button
                                size="xs"
                                onClick={handleSaveApiKey}
                                disabled={loading || !apiKeyInput.trim()}
                                className="h-7"
                            >
                                Save
                            </Button>
                        </div>
                    </SettingRow>
                    {status?.configured && (
                        <SettingRow
                            label="Remove Credential"
                            description={`Clear stored ${providerLabel} credential`}
                        >
                            <Button
                                size="xs"
                                variant="outline"
                                onClick={handleClearCredential}
                                disabled={loading}
                                className="h-7"
                            >
                                Remove
                            </Button>
                        </SettingRow>
                    )}
                </>
            ) : (
                <>
                    <SettingRow
                        label="OAuth Connection"
                        description={status?.configured
                            ? `Connected (${status.authMode})${status.maskedKey ? ` · ${status.maskedKey}` : ""}`
                            : `Connect ${providerLabel} via browser and localhost callback`}
                    >
                        <div className="flex items-center gap-2">
                            <Button
                                size="xs"
                                onClick={handleOAuthConnect}
                                disabled={oauthLoading}
                                className="h-7 gap-1.5"
                            >
                                {oauthLoading ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
                                {oauthLoading ? "Waiting..." : "Connect"}
                            </Button>
                            {status?.configured && (
                                <Button
                                    size="xs"
                                    variant="outline"
                                    onClick={handleClearCredential}
                                    disabled={loading || oauthLoading}
                                    className="h-7"
                                >
                                    Disconnect
                                </Button>
                            )}
                        </div>
                    </SettingRow>
                    {oauthFlowId && (
                        <div className="mt-2 rounded-md border border-border/50 bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
                            Waiting for browser callback... keep this dialog open.
                        </div>
                    )}
                </>
            )}
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

            <div className="py-2.5 space-y-1.5">
                <p className="text-[13px] font-semibold text-foreground">Data Location</p>
                <p className="text-[12px] text-muted-foreground/50">
                    Connections and saved queries are stored here, encrypted.
                </p>
                {dataDir && (
                    <div className="flex items-center gap-2 mt-1.5 px-2.5 py-1.5 rounded-lg bg-muted/40 border border-border/50">
                        <FolderOpen size={11} className="text-muted-foreground/40 shrink-0" />
                        <span className="text-[11px] font-mono text-muted-foreground/60 truncate">
                            {dataDir}
                        </span>
                    </div>
                )}
            </div>

            <Separator className="my-1" />

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
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">
                            {stat.label}
                        </span>
                    </div>
                ))}
            </div>

            <Separator className="my-1" />

            <SettingRow
                label="Query History"
                description={`${totalHistory} entries across all connections`}
            >
                <Button
                    variant={confirmClear === "history" ? "destructive" : "outline"}
                    size="xs"
                    onClick={() => handleClear("history")}
                    className="gap-1.5 text-[11px] font-bold uppercase tracking-wider h-7"
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
                    className="gap-1.5 text-[11px] font-bold uppercase tracking-wider h-7"
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
                    <span className="text-[12px]">Loading…</span>                </div>
            </div>
        );
    }

    if (!state) {
        return (
            <div>
                <SectionHeading>License</SectionHeading>
                <div className="flex flex-col items-center gap-4 py-8 text-center">
                <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-muted/50 border border-border/50">
                        <ShieldOff size={20} className="text-muted-foreground/30" />
                    </div>
                    <div>
                        <p className="text-[13px] font-semibold text-foreground">Not activated</p>
                        <p className="text-[12px] text-muted-foreground/50 mt-0.5">
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

            <div className={cn(
                "flex items-center gap-2.5 px-3 py-2.5 rounded-lg border mb-4",
                isExpired
                    ? "bg-destructive/10 border-destructive/20 text-destructive"
                    : "bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400",
            )}>
                {isExpired
                    ? <ShieldOff size={14} className="shrink-0" />
                    : <ShieldCheck size={14} className="shrink-0" />}
                <span className="text-[13px] font-semibold">
                    {isExpired ? "License expired" : "License active"}
                </span>
                <span className={cn(
                    "ml-auto px-2 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider border",
                    planColor,
                )}>
                    {license.plan}
                </span>
            </div>

            <div className="space-y-0">
                <SettingRow label="License Key">
                    <span className="text-[12px] font-mono text-muted-foreground/70 tracking-wider">
                        {maskedKey}
                    </span>
                </SettingRow>

                <SettingRow label="Email">
                    <span className="text-[12px] font-mono text-muted-foreground/70">
                        {license.email}
                    </span>
                </SettingRow>

                <SettingRow
                    label="Expires"
                    description={isExpired ? "Renew your license to continue." : undefined}
                >
                    <span className={cn(
                        "flex items-center gap-1.5 text-[12px] font-mono",
                        isExpired ? "text-destructive" : "text-muted-foreground/70",
                    )}>
                        <CalendarClock size={11} className="shrink-0" />
                        {formatDate(license.expiry)}
                    </span>
                </SettingRow>

                <SettingRow label="Max Devices">
                    <span className="text-[12px] font-mono text-muted-foreground/70">
                        {license.max_devices}
                    </span>
                </SettingRow>

                <SettingRow label="Device ID">
                    <span className="flex items-center gap-1.5 text-[12px] font-mono text-muted-foreground/70">
                        <Cpu size={11} className="shrink-0" />
                        {activation.device_id.slice(0, 8)}…
                    </span>
                </SettingRow>

                <SettingRow label="Last Validated">
                    <span className="text-[12px] text-muted-foreground/60">
                        {formatDateTime(activation.last_validated_at)}
                    </span>
                </SettingRow>
            </div>

            <Separator className="my-4" />

            <div className="flex items-center justify-between">
                <div>
                    <p className="text-[13px] font-semibold text-foreground">Deactivate</p>
                    <p className="text-[12px] text-muted-foreground/50 mt-0.5">
                        Frees this device slot so you can activate on another machine.
                    </p>
                </div>
                <Button
                    variant={confirmDeactivate ? "destructive" : "outline"}
                    size="xs"
                    onClick={handleDeactivate}
                    className="gap-1.5 text-[11px] font-bold uppercase tracking-wider h-7 shrink-0"
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

            <div className="flex items-center gap-4 py-3">
                <div className="size-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Table2 size={22} className="text-primary" />
                </div>
                <div>
                    <p className="text-[15px] font-black text-foreground">DB Connect</p>
                    <p className="text-[12px] text-muted-foreground/60">Version {packageJson.version}</p>
                </div>
            </div>

            <Separator className="my-3" />

            <div className="space-y-1.5">
                {[
                    ["Built with", "Tauri 2 · React 19 · TypeScript"],
                    ["UI",         "Tailwind CSS v4 · shadcn/ui"],
                    ["Database",   "SQLx · sqlx-sqlite · AES-256-GCM"],
                    ["Editor",     "CodeMirror 6"],
                    ["Grid",       "TanStack Table v8"],
                ].map(([label, value]) => (
                    <div key={label} className="flex items-baseline gap-2 py-1">
                        <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/40 w-20 shrink-0">
                            {label}
                        </span>
                        <span className="text-[12px] font-mono text-muted-foreground/70">
                            {value}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function SettingsPage({ onActivate }: { onActivate?: () => void }) {
    const { setActiveView } = useAppStore();
    const [activeSection, setActiveSection] = useState<Section>("appearance");

    return (
        <div className="h-full flex flex-col bg-surface-1 overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border-subtle bg-surface-elevated/65 shrink-0">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setActiveView("main")}
                    className="shrink-0"
                >
                    <ArrowLeft size={16} />
                </Button>
                <span className="text-[14px] font-semibold text-foreground">Settings</span>
            </div>
            <div className="flex flex-1 overflow-hidden">
                <div className="w-48 shrink-0 bg-surface-2/72 border-r border-border-subtle flex flex-col py-3 gap-0.5 px-2">
                    <p className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground/40 px-2 pb-2 pt-1">
                        Settings
                    </p>
                    {NAV.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveSection(item.id)}
                            className={cn(
                                "flex items-center gap-2.5 h-7 px-2.5 rounded-md text-[12px] font-semibold transition-colors text-left w-full",
                                activeSection === item.id
                                    ? "bg-surface-selected/82 text-foreground"
                                    : "text-muted-foreground/60 hover:text-foreground hover:bg-surface-3",
                            )}
                        >
                            <span className={cn(
                                "shrink-0",
                                activeSection === item.id ? "text-foreground" : "text-muted-foreground/40",
                            )}>
                                {item.icon}
                            </span>
                            {item.label}
                        </button>
                    ))}
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-5">
                    {activeSection === "appearance" && <AppearanceSection />}
                    {activeSection === "editor"     && <EditorSection />}
                    {activeSection === "table"      && <TableSection />}
                    {activeSection === "ai"         && <AiSection />}
                    {activeSection === "storage"    && <StorageSection />}
                    {activeSection === "license"    && (
                        <LicenseSection onActivate={() => {
                            setActiveView("main");
                            onActivate?.();
                        }} />
                    )}
                    {activeSection === "about"      && <AboutSection />}
                </div>
            </div>
        </div>
    );
}
