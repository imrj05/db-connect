import { startTransition, type ReactNode, useEffect, useRef, useState } from "react";
import {
    Bot,
    CalendarClock,
    Check,
    ChevronDown,
    Code2,
    Cpu,
    ExternalLink,
    FolderOpen,
    HardDrive,
    Info,
    KeyRound,
    Loader2,
    Moon,
    Palette,
    RefreshCw,
    ShieldCheck,
    ShieldOff,
    Sun,
    Table2,
    Trash2,
    Wand2,
    type LucideIcon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogMedia,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card as BaseCard,
    CardAction as BaseCardAction,
    CardContent as BaseCardContent,
    CardDescription,
    CardHeader as BaseCardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty";
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldGroup,
    FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Item, ItemContent, ItemGroup } from "@/components/ui/item";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { getSystemFonts, DB_FONT_MONO, DB_FONT_MONO_STACK, DB_FONT_SANS, DB_FONT_SANS_STACK } from "@/lib/fonts";
import { licenseDeactivate, licenseGetStored, type StoredLicenseState } from "@/lib/license";
import { tauriApi, type AiProvider } from "@/lib/tauri-api";
import { cn } from "@/lib/utils";
import {
    useAppStore,
    type AppSettings,
    type EditorThemeOption,
    type UiDarkThemeOption,
    type UiLightThemeOption,
} from "@/store/useAppStore";
import packageJson from "../../../../package.json";

type Section = "appearance" | "editor" | "table" | "ai" | "storage" | "license" | "about";

const NAV: { id: Section; label: string; description: string; icon: LucideIcon }[] = [
    {
        id: "appearance",
        label: "Appearance",
        description: "Tune the app theme, zoom level, and fonts used across the workspace.",
        icon: Palette,
    },
    {
        id: "editor",
        label: "Editor",
        description: "Choose editor typography and syntax highlighting for light and dark modes.",
        icon: Code2,
    },
    {
        id: "table",
        label: "Table",
        description: "Set sensible defaults for browsing large result sets and table pages.",
        icon: Table2,
    },
    {
        id: "ai",
        label: "AI",
        description: "Configure providers, models, and credentials for the SQL assistant.",
        icon: Bot,
    },
    {
        id: "storage",
        label: "Storage",
        description: "Review local data usage and clear saved client-side records.",
        icon: HardDrive,
    },
    {
        id: "license",
        label: "License",
        description: "Manage activation status for this device and review license metadata.",
        icon: KeyRound,
    },
    {
        id: "about",
        label: "About",
        description: "See version information and the technologies powering DB Connect.",
        icon: Info,
    },
];

const UI_DARK_THEMES: { value: UiDarkThemeOption; label: string }[] = [
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
    { value: "cursor-dark", label: "Cursor Dark" },
    { value: "ember", label: "Ember" },
];

const UI_LIGHT_THEMES: { value: UiLightThemeOption; label: string }[] = [
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
    { value: "cursor", label: "Cursor" },
    { value: "ember", label: "Ember" },
];

const EDITOR_DARK_THEMES: { value: EditorThemeOption; label: string }[] = [
    { value: "dark-one-dark", label: "One Dark" },
    { value: "dark-monokai", label: "Monokai" },
    { value: "dark-palenight", label: "Palenight" },
    { value: "dark-dracula", label: "Dracula" },
];

const EDITOR_LIGHT_THEMES: { value: EditorThemeOption; label: string }[] = [
    { value: "light-github", label: "GitHub Light" },
    { value: "light-solarized", label: "Solarized Light" },
    { value: "light-white-pine", label: "White Pine" },
    { value: "light-soft-white", label: "Soft White" },
];

const AI_PROVIDERS: { id: AiProvider; label: string }[] = [
    { id: "openrouter", label: "OpenRouter" },
    { id: "opencode", label: "OpenCode" },
    { id: "openai", label: "OpenAI" },
    { id: "codex", label: "Codex (OpenAI)" },
    { id: "github-copilot", label: "GitHub Copilot" },
    { id: "anthropic", label: "Anthropic" },
    { id: "groq", label: "Groq" },
    { id: "gemini", label: "Google Gemini" },
];

const AI_PROVIDER_GUIDE: Record<AiProvider, { keysUrl: string; helper: string; placeholder: string }> = {
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
        helper: "Use a GitHub token with models access for GitHub Models or Copilot APIs.",
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

const AI_MODEL_PRESETS: Record<AiProvider, { id: string; label: string }[]> = {
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

const SETTINGS_FIELD_CLASS = "gap-4 border-b border-border/50 pb-4 last:border-0 last:pb-0";
const SETTINGS_CONTROL_CLASS = "flex w-full min-w-0 shrink-0 justify-start";
const SETTINGS_CONTENT_WIDTH_CLASS = "flex w-full min-w-0 flex-col gap-6";
const SETTINGS_WIDE_CONTROL_CLASS = "w-full";
const SETTINGS_XL_CONTROL_CLASS = "w-full";

function Card({ className, ...props }: React.ComponentProps<typeof BaseCard>) {
    return (
        <BaseCard
            className={cn("w-full min-w-0 rounded-none border border-border-subtle bg-surface-2 py-0 ring-0 shadow-none", className)}
            {...props}
        />
    );
}

function CardHeader({ className, ...props }: React.ComponentProps<typeof BaseCardHeader>) {
    return (
        <BaseCardHeader
            className={cn("rounded-none border-b border-border-subtle px-4 py-5", className)}
            {...props}
        />
    );
}

function CardContent({ className, ...props }: React.ComponentProps<typeof BaseCardContent>) {
    return <BaseCardContent className={cn("px-4 py-5", className)} {...props} />;
}

function CardAction({ className, ...props }: React.ComponentProps<typeof BaseCardAction>) {
    return <BaseCardAction className={cn("self-start", className)} {...props} />;
}

function getPlanBadgeClass(plan: string) {
    switch (plan.toLowerCase()) {
        case "pro":
            return "border-primary/20 bg-primary/10 text-primary";
        case "starter":
            return "border-accent/30 bg-accent/50 text-accent-foreground";
        case "lifetime":
            return "border-warning/20 bg-warning/10 text-warning";
        default:
            return "border-border bg-muted text-muted-foreground";
    }
}

function FontPicker({
    fonts,
    value,
    fallbackStack,
    defaultAlias,
    defaultAliasStack,
    placeholder,
    onSelect,
    className,
}: {
    fonts: { value: string; label: string; isMono: boolean }[];
    value: string;
    fallbackStack: string;
    defaultAlias: string;
    defaultAliasStack: string;
    placeholder: string;
    onSelect: (value: string) => void;
    className?: string;
}) {
    const [open, setOpen] = useState(false);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const id = requestAnimationFrame(() => {
            const selectedItem = listRef.current?.querySelector<HTMLElement>("[data-font-selected='true']");
            selectedItem?.scrollIntoView({ block: "nearest" });
        });

        return () => cancelAnimationFrame(id);
    }, [open]);

    const displayLabel = value === defaultAlias
        ? fonts.find((font) => font.value === defaultAlias)?.label ?? defaultAlias
        : fonts.find((font) => font.value === value)?.label ?? value;

    const displayStack = value === defaultAlias
        ? defaultAliasStack
        : `"${value}", ${fallbackStack}`;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" className={cn("h-8 w-full justify-between text-sm font-normal", className)}>
                    <span className="truncate" style={{ fontFamily: displayStack }}>
                        {displayLabel}
                    </span>
                    <ChevronDown data-icon="inline-end" className="opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 max-w-[calc(100vw-2rem)] p-0">
                <div ref={listRef}>
                    <Command>
                        <CommandInput placeholder={placeholder} />
                        <CommandList className="max-h-60">
                            <CommandEmpty>No fonts found.</CommandEmpty>
                            <CommandGroup>
                                {fonts.map((font) => {
                                    const isSelected = value === font.value;
                                    const fontStack = font.value === defaultAlias
                                        ? defaultAliasStack
                                        : `"${font.value}", ${fallbackStack}`;

                                    return (
                                        <CommandItem
                                            key={font.value}
                                            value={font.value}
                                            onSelect={() => {
                                                onSelect(font.value);
                                                setOpen(false);
                                            }}
                                            data-font-selected={isSelected ? "true" : undefined}
                                        >
                                            <span style={{ fontFamily: fontStack }}>{font.label}</span>
                                            {isSelected ? <Check className="ml-auto" /> : null}
                                        </CommandItem>
                                    );
                                })}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </div>
            </PopoverContent>
        </Popover>
    );
}

function AppearanceSection() {
    const { theme, setTheme, appSettings, updateAppSetting } = useAppStore();
    const [systemFonts, setSystemFonts] = useState<{ value: string; label: string; isMono: boolean }[]>([]);
    const [loadingFonts, setLoadingFonts] = useState(true);

    useEffect(() => {
        let cancelled = false;

        void getSystemFonts()
            .then((fonts) => {
                if (cancelled) {
                    return;
                }

                setSystemFonts(fonts);
                setLoadingFonts(false);
            })
            .catch(() => {
                if (cancelled) {
                    return;
                }

                setLoadingFonts(false);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const sansFonts = systemFonts.filter((font) => !font.isMono);
    const monoFonts = systemFonts.filter((font) => font.isMono);
    const surfaceThemes = theme === "dark" ? UI_DARK_THEMES : UI_LIGHT_THEMES;

    return (
        <div className="flex flex-col gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Theme and scale</CardTitle>
                    <CardDescription>Match the app chrome to your preferred contrast and interface density.</CardDescription>
                    <CardAction>
                        <Badge variant="secondary" className="capitalize">
                            {theme}
                        </Badge>
                    </CardAction>
                </CardHeader>
                <CardContent>
                    <FieldGroup>
                        <Field orientation="responsive" className={SETTINGS_FIELD_CLASS}>
                            <FieldContent>
                                <FieldTitle>App theme</FieldTitle>
                                <FieldDescription>Choose your preferred colour scheme.</FieldDescription>
                            </FieldContent>
                            <div className={SETTINGS_CONTROL_CLASS}>
                                <ToggleGroup
                                    type="single"
                                    variant="outline"
                                    size="sm"
                                    spacing={1}
                                    value={theme}
                                    onValueChange={(value) => {
                                        if (!value) {
                                            return;
                                        }

                                        setTheme(value as "dark" | "light");
                                    }}
                                >
                                    <ToggleGroupItem value="dark">
                                        <Moon data-icon="inline-start" />
                                        Dark
                                    </ToggleGroupItem>
                                    <ToggleGroupItem value="light">
                                        <Sun data-icon="inline-start" />
                                        Light
                                    </ToggleGroupItem>
                                </ToggleGroup>
                            </div>
                        </Field>

                        <Field orientation="responsive" className={SETTINGS_FIELD_CLASS}>
                            <FieldContent>
                                <FieldTitle>{theme === "dark" ? "Dark mode theme" : "Light mode theme"}</FieldTitle>
                                <FieldDescription>
                                    Pick the {theme === "dark" ? "dark" : "light"} surface variant used throughout the app.
                                </FieldDescription>
                            </FieldContent>
                            <div className={SETTINGS_CONTROL_CLASS}>
                                <Select
                                    value={theme === "dark" ? appSettings.uiDarkTheme : appSettings.uiLightTheme}
                                    onValueChange={(value) => {
                                        if (theme === "dark") {
                                            updateAppSetting("uiDarkTheme", value as UiDarkThemeOption);
                                            return;
                                        }

                                        updateAppSetting("uiLightTheme", value as UiLightThemeOption);
                                    }}
                                >
                                    <SelectTrigger className={SETTINGS_WIDE_CONTROL_CLASS}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectGroup>
                                            {surfaceThemes.map((option) => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectGroup>
                                    </SelectContent>
                                </Select>
                            </div>
                        </Field>

                        <Field orientation="responsive" className={SETTINGS_FIELD_CLASS}>
                            <FieldContent>
                                <FieldTitle>UI zoom</FieldTitle>
                                <FieldDescription>Scale the entire workspace up or down.</FieldDescription>
                            </FieldContent>
                            <div className={SETTINGS_CONTROL_CLASS}>
                                <ToggleGroup
                                    type="single"
                                    variant="outline"
                                    size="sm"
                                    spacing={1}
                                    value={String(appSettings.uiZoom)}
                                    onValueChange={(value) => {
                                        if (!value) {
                                            return;
                                        }

                                        updateAppSetting("uiZoom", Number(value) as AppSettings["uiZoom"]);
                                    }}
                                >
                                    {[100, 110, 125, 140, 150].map((zoom) => (
                                        <ToggleGroupItem key={zoom} value={String(zoom)}>
                                            {zoom}%
                                        </ToggleGroupItem>
                                    ))}
                                </ToggleGroup>
                            </div>
                        </Field>
                    </FieldGroup>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Typography</CardTitle>
                    <CardDescription>Choose the fonts used for interface chrome and monospace data views.</CardDescription>
                    <CardAction>
                        <Badge variant="outline">{loadingFonts ? "Loading" : `${systemFonts.length} fonts`}</Badge>
                    </CardAction>
                </CardHeader>
                <CardContent>
                    <FieldGroup>
                        <Field orientation="responsive" className={SETTINGS_FIELD_CLASS}>
                            <FieldContent>
                                <FieldTitle>Interface font</FieldTitle>
                                <FieldDescription>Sans-serif font used for labels, tabs, and window chrome.</FieldDescription>
                            </FieldContent>
                            <div className={SETTINGS_CONTROL_CLASS}>
                                {loadingFonts ? (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Loader2 className="animate-spin" />
                                        Loading fonts
                                    </div>
                                ) : (
                                    <FontPicker
                                        fonts={sansFonts}
                                        value={appSettings.uiFontFamily}
                                        fallbackStack="sans-serif"
                                        defaultAlias={DB_FONT_SANS}
                                        defaultAliasStack={DB_FONT_SANS_STACK}
                                        placeholder="Search font..."
                                        className={SETTINGS_WIDE_CONTROL_CLASS}
                                        onSelect={(value) => updateAppSetting("uiFontFamily", value)}
                                    />
                                )}
                            </div>
                        </Field>

                        <Field orientation="responsive" className={SETTINGS_FIELD_CLASS}>
                            <FieldContent>
                                <FieldTitle>Monospace font</FieldTitle>
                                <FieldDescription>Used in editors, query results, and schema details.</FieldDescription>
                            </FieldContent>
                            <div className={SETTINGS_CONTROL_CLASS}>
                                {loadingFonts ? (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Loader2 className="animate-spin" />
                                        Loading fonts
                                    </div>
                                ) : (
                                    <FontPicker
                                        fonts={monoFonts}
                                        value={appSettings.monoFontFamily}
                                        fallbackStack="monospace"
                                        defaultAlias={DB_FONT_MONO}
                                        defaultAliasStack={DB_FONT_MONO_STACK}
                                        placeholder="Search font..."
                                        className={SETTINGS_WIDE_CONTROL_CLASS}
                                        onSelect={(value) => updateAppSetting("monoFontFamily", value)}
                                    />
                                )}
                            </div>
                        </Field>
                    </FieldGroup>
                </CardContent>
            </Card>
        </div>
    );
}

function EditorSection() {
    const { appSettings, updateAppSetting } = useAppStore();

    return (
        <div className="flex flex-col gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Editor typography</CardTitle>
                    <CardDescription>Keep SQL readable at the density you prefer.</CardDescription>
                    <CardAction>
                        <Badge variant="secondary">{appSettings.editorFontSize}px</Badge>
                    </CardAction>
                </CardHeader>
                <CardContent>
                    <FieldGroup>
                        <Field orientation="responsive" className={SETTINGS_FIELD_CLASS}>
                            <FieldContent>
                                <FieldTitle>Font size</FieldTitle>
                                <FieldDescription>Size of text in the SQL editor.</FieldDescription>
                            </FieldContent>
                            <div className={SETTINGS_CONTROL_CLASS}>
                                <ToggleGroup
                                    type="single"
                                    variant="outline"
                                    size="sm"
                                    spacing={1}
                                    value={String(appSettings.editorFontSize)}
                                    onValueChange={(value) => {
                                        if (!value) {
                                            return;
                                        }

                                        updateAppSetting("editorFontSize", Number(value) as AppSettings["editorFontSize"]);
                                    }}
                                >
                                    {[12, 13, 14, 16].map((size) => (
                                        <ToggleGroupItem key={size} value={String(size)}>
                                            {size}px
                                        </ToggleGroupItem>
                                    ))}
                                </ToggleGroup>
                            </div>
                        </Field>
                    </FieldGroup>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Syntax highlighting</CardTitle>
                    <CardDescription>Pick the CodeMirror theme used for each app appearance mode.</CardDescription>
                </CardHeader>
                <CardContent>
                    <FieldGroup>
                        <Field orientation="responsive" className={SETTINGS_FIELD_CLASS}>
                            <FieldContent>
                                <FieldTitle>Dark theme</FieldTitle>
                                <FieldDescription>SQL syntax highlighting used when the app is in dark mode.</FieldDescription>
                            </FieldContent>
                            <div className={SETTINGS_CONTROL_CLASS}>
                                <Select
                                    value={appSettings.editorDarkTheme}
                                    onValueChange={(value) => updateAppSetting("editorDarkTheme", value as EditorThemeOption)}
                                >
                                    <SelectTrigger className={SETTINGS_WIDE_CONTROL_CLASS}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectGroup>
                                            {EDITOR_DARK_THEMES.map((option) => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectGroup>
                                    </SelectContent>
                                </Select>
                            </div>
                        </Field>

                        <Field orientation="responsive" className={SETTINGS_FIELD_CLASS}>
                            <FieldContent>
                                <FieldTitle>Light theme</FieldTitle>
                                <FieldDescription>SQL syntax highlighting used when the app is in light mode.</FieldDescription>
                            </FieldContent>
                            <div className={SETTINGS_CONTROL_CLASS}>
                                <Select
                                    value={appSettings.editorLightTheme}
                                    onValueChange={(value) => updateAppSetting("editorLightTheme", value as EditorThemeOption)}
                                >
                                    <SelectTrigger className={SETTINGS_WIDE_CONTROL_CLASS}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectGroup>
                                            {EDITOR_LIGHT_THEMES.map((option) => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectGroup>
                                    </SelectContent>
                                </Select>
                            </div>
                        </Field>
                    </FieldGroup>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Editing behaviour</CardTitle>
                    <CardDescription>Word wrap and indentation settings for the SQL editor.</CardDescription>
                </CardHeader>
                <CardContent>
                    <FieldGroup>
                        <Field orientation="responsive" className={SETTINGS_FIELD_CLASS}>
                            <FieldContent>
                                <FieldTitle>Word wrap</FieldTitle>
                                <FieldDescription>Wrap long lines instead of scrolling horizontally.</FieldDescription>
                            </FieldContent>
                            <div className={SETTINGS_CONTROL_CLASS}>
                                <Switch
                                    checked={appSettings.editorWordWrap}
                                    onCheckedChange={(v) => updateAppSetting("editorWordWrap", v)}
                                />
                            </div>
                        </Field>
                        <Field orientation="responsive" className={SETTINGS_FIELD_CLASS}>
                            <FieldContent>
                                <FieldTitle>Tab size</FieldTitle>
                                <FieldDescription>Number of spaces inserted when pressing Tab.</FieldDescription>
                            </FieldContent>
                            <div className={SETTINGS_CONTROL_CLASS}>
                                <ToggleGroup
                                    type="single"
                                    variant="outline"
                                    size="sm"
                                    spacing={1}
                                    value={String(appSettings.editorTabSize)}
                                    onValueChange={(value) => {
                                        if (!value) return;
                                        updateAppSetting("editorTabSize", Number(value) as AppSettings["editorTabSize"]);
                                    }}
                                >
                                    <ToggleGroupItem value="2">2</ToggleGroupItem>
                                    <ToggleGroupItem value="4">4</ToggleGroupItem>
                                </ToggleGroup>
                            </div>
                        </Field>
                    </FieldGroup>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Query execution</CardTitle>
                    <CardDescription>Timeout applied to every query. Long-running queries are cancelled after this threshold.</CardDescription>
                    <CardAction>
                        <Badge variant="secondary">{appSettings.queryTimeoutSecs}s</Badge>
                    </CardAction>
                </CardHeader>
                <CardContent>
                    <FieldGroup>
                        <Field orientation="responsive" className={SETTINGS_FIELD_CLASS}>
                            <FieldContent>
                                <FieldTitle>Query timeout</FieldTitle>
                                <FieldDescription>Maximum seconds a single query may run before being cancelled.</FieldDescription>
                            </FieldContent>
                            <div className={SETTINGS_CONTROL_CLASS}>
                                <ToggleGroup
                                    type="single"
                                    variant="outline"
                                    size="sm"
                                    spacing={1}
                                    value={String(appSettings.queryTimeoutSecs)}
                                    onValueChange={(value) => {
                                        if (!value) return;
                                        updateAppSetting("queryTimeoutSecs", Number(value));
                                    }}
                                >
                                    {[10, 30, 60, 120, 300].map((s) => (
                                        <ToggleGroupItem key={s} value={String(s)}>{s}s</ToggleGroupItem>
                                    ))}
                                </ToggleGroup>
                            </div>
                        </Field>
                    </FieldGroup>
                </CardContent>
            </Card>
        </div>
    );
}

function TableSection() {
    const { appSettings, updateAppSetting } = useAppStore();

    return (
        <div className="flex flex-col gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Grid defaults</CardTitle>
                    <CardDescription>Keep pagination predictable when browsing tables and query results.</CardDescription>
                    <CardAction>
                        <Badge variant="secondary">{appSettings.tablePageSize} rows</Badge>
                    </CardAction>
                </CardHeader>
                <CardContent>
                    <FieldGroup>
                        <Field orientation="responsive" className={SETTINGS_FIELD_CLASS}>
                            <FieldContent>
                                <FieldTitle>Rows per page</FieldTitle>
                                <FieldDescription>Number of rows fetched per page in table view.</FieldDescription>
                            </FieldContent>
                            <div className={SETTINGS_CONTROL_CLASS}>
                                <ToggleGroup
                                    type="single"
                                    variant="outline"
                                    size="sm"
                                    spacing={1}
                                    value={String(appSettings.tablePageSize)}
                                    onValueChange={(value) => {
                                        if (!value) {
                                            return;
                                        }

                                        updateAppSetting("tablePageSize", Number(value) as AppSettings["tablePageSize"]);
                                    }}
                                >
                                    {[25, 50, 100, 200].map((size) => (
                                        <ToggleGroupItem key={size} value={String(size)}>
                                            {size}
                                        </ToggleGroupItem>
                                    ))}
                                </ToggleGroup>
                            </div>
                        </Field>
                    </FieldGroup>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Row density</CardTitle>
                    <CardDescription>Controls the height of rows in table and query result views.</CardDescription>
                    <CardAction>
                        <Badge variant="secondary" className="capitalize">{appSettings.rowDensity}</Badge>
                    </CardAction>
                </CardHeader>
                <CardContent>
                    <FieldGroup>
                        <Field orientation="responsive" className={SETTINGS_FIELD_CLASS}>
                            <FieldContent>
                                <FieldTitle>Density</FieldTitle>
                                <FieldDescription>Compact saves vertical space; comfortable gives more breathing room.</FieldDescription>
                            </FieldContent>
                            <div className={SETTINGS_CONTROL_CLASS}>
                                <ToggleGroup
                                    type="single"
                                    variant="outline"
                                    size="sm"
                                    spacing={1}
                                    value={appSettings.rowDensity}
                                    onValueChange={(value) => {
                                        if (!value) return;
                                        updateAppSetting("rowDensity", value as AppSettings["rowDensity"]);
                                    }}
                                >
                                    {(["compact", "default", "comfortable"] as const).map((d) => (
                                        <ToggleGroupItem key={d} value={d} className="capitalize">
                                            {d}
                                        </ToggleGroupItem>
                                    ))}
                                </ToggleGroup>
                            </div>
                        </Field>
                    </FieldGroup>
                </CardContent>
            </Card>
        </div>
    );
}

function AiSection() {
    const { appSettings, updateAppSetting } = useAppStore();
    const [status, setStatus] = useState<{
        provider: string;
        authMode: string;
        configured: boolean;
        maskedKey: string | null;
    } | null>(null);
    const [apiKeyInput, setApiKeyInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [oauthLoading, setOauthLoading] = useState(false);
    const [oauthFlowId, setOauthFlowId] = useState<string | null>(null);

    const providerLabel = AI_PROVIDERS.find((provider) => provider.id === appSettings.aiProvider)?.label ?? "AI Provider";
    const providerGuide = AI_PROVIDER_GUIDE[appSettings.aiProvider];
    const oauthSupported = appSettings.aiProvider === "openrouter";
    const activeModelPresets = AI_MODEL_PRESETS[appSettings.aiProvider] ?? [];
    const selectedPreset = activeModelPresets.some((model) => model.id === appSettings.aiDefaultModel)
        ? appSettings.aiDefaultModel
        : "custom";

    useEffect(() => {
        if (!oauthSupported && appSettings.aiAuthMode !== "api_key") {
            updateAppSetting("aiAuthMode", "api_key");
        }
    }, [oauthSupported, appSettings.aiAuthMode, updateAppSetting]);

    const loadStatus = async () => {
        try {
            const nextStatus = await tauriApi.aiGetCredentialStatus(appSettings.aiProvider);
            setStatus(nextStatus);
        } catch {
            setStatus(null);
        }
    };

    useEffect(() => {
        void loadStatus();
    }, [appSettings.aiProvider]);

    const handleSaveApiKey = async () => {
        if (!apiKeyInput.trim()) {
            return;
        }

        setLoading(true);

        try {
            const nextStatus = await tauriApi.aiSaveApiKey(appSettings.aiProvider, apiKeyInput.trim());
            setStatus(nextStatus);
            setApiKeyInput("");
        } finally {
            setLoading(false);
        }
    };

    const handleTestApiKey = async () => {
        if (!apiKeyInput.trim()) {
            return;
        }

        setLoading(true);

        try {
            await tauriApi.aiTestApiKey(appSettings.aiProvider, apiKeyInput.trim());
        } finally {
            setLoading(false);
        }
    };

    const handleOAuthConnect = async () => {
        if (!oauthSupported) {
            return;
        }

        setOauthLoading(true);

        try {
            const begin = await tauriApi.openrouterOauthBegin();
            setOauthFlowId(begin.flowId);
            await tauriApi.openExternalUrl(begin.authUrl);
            const nextStatus = await tauriApi.openrouterOauthComplete(begin.flowId);
            setStatus(nextStatus);
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
        <div className="flex flex-col gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Assistant preferences</CardTitle>
                    <CardDescription>Turn the SQL assistant on and choose how DB Connect should authenticate.</CardDescription>
                    <CardAction>
                        <Badge variant={appSettings.aiEnabled ? "secondary" : "outline"}>
                            {appSettings.aiEnabled ? "Enabled" : "Disabled"}
                        </Badge>
                    </CardAction>
                </CardHeader>
                <CardContent>
                    <FieldGroup>
                        <Field orientation="responsive" className={SETTINGS_FIELD_CLASS}>
                            <FieldContent>
                                <FieldTitle>Enable AI</FieldTitle>
                                <FieldDescription>Turn on AI-assisted SQL generation in the editor.</FieldDescription>
                            </FieldContent>
                            <div className={SETTINGS_CONTROL_CLASS}>
                                <Switch
                                    checked={appSettings.aiEnabled}
                                    onCheckedChange={(value) => updateAppSetting("aiEnabled", Boolean(value))}
                                />
                            </div>
                        </Field>

                        <Field orientation="responsive" className={SETTINGS_FIELD_CLASS}>
                            <FieldContent>
                                <FieldTitle>Provider</FieldTitle>
                                <FieldDescription>Choose the model provider used by the SQL assistant.</FieldDescription>
                            </FieldContent>
                            <div className={SETTINGS_CONTROL_CLASS}>
                                <Select
                                    value={appSettings.aiProvider}
                                    onValueChange={(value) => updateAppSetting("aiProvider", value as AppSettings["aiProvider"])}
                                >
                                    <SelectTrigger className={SETTINGS_WIDE_CONTROL_CLASS}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectGroup>
                                            {AI_PROVIDERS.map((provider) => (
                                                <SelectItem key={provider.id} value={provider.id}>
                                                    {provider.label}
                                                </SelectItem>
                                            ))}
                                        </SelectGroup>
                                    </SelectContent>
                                </Select>
                            </div>
                        </Field>

                        <Field orientation="responsive" className={SETTINGS_FIELD_CLASS}>
                            <FieldContent>
                                <FieldTitle>Auth mode</FieldTitle>
                                <FieldDescription>
                                    {oauthSupported
                                        ? "Choose between a saved API key and the OpenRouter OAuth flow."
                                        : "This provider currently authenticates with API keys only."}
                                </FieldDescription>
                            </FieldContent>
                            <div className={SETTINGS_CONTROL_CLASS}>
                                <Select
                                    value={appSettings.aiAuthMode}
                                    onValueChange={(value) => updateAppSetting("aiAuthMode", value as "api_key" | "oauth")}
                                >
                                    <SelectTrigger className={SETTINGS_WIDE_CONTROL_CLASS}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectGroup>
                                            <SelectItem value="api_key">API Key</SelectItem>
                                            {oauthSupported ? <SelectItem value="oauth">OAuth (Localhost)</SelectItem> : null}
                                        </SelectGroup>
                                    </SelectContent>
                                </Select>
                            </div>
                        </Field>
                    </FieldGroup>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Model defaults</CardTitle>
                    <CardDescription>Choose the default model identifier sent with new AI requests.</CardDescription>
                    <CardAction>
                        <Badge variant="outline">{providerLabel}</Badge>
                    </CardAction>
                </CardHeader>
                <CardContent>
                    <FieldGroup>
                        <Field orientation="responsive" className={SETTINGS_FIELD_CLASS}>
                            <FieldContent>
                                <FieldTitle>Default model</FieldTitle>
                                <FieldDescription>Pick a preset or enter a custom model id for {providerLabel}.</FieldDescription>
                            </FieldContent>
                            <div className={cn("flex w-full shrink-0 flex-col gap-2", SETTINGS_XL_CONTROL_CLASS)}>
                                <div className="flex flex-col gap-2 sm:flex-row">
                                    <Select
                                        value={selectedPreset}
                                        onValueChange={(value) => {
                                            if (value === "custom") {
                                                return;
                                            }

                                            updateAppSetting("aiDefaultModel", value);
                                        }}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Choose preset" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectGroup>
                                                {activeModelPresets.map((preset) => (
                                                    <SelectItem key={preset.id} value={preset.id}>
                                                        {preset.label}
                                                    </SelectItem>
                                                ))}
                                                <SelectItem value="custom">Custom</SelectItem>
                                            </SelectGroup>
                                        </SelectContent>
                                    </Select>
                                    <Input
                                        value={appSettings.aiDefaultModel}
                                        onChange={(event) => updateAppSetting(
                                            "aiDefaultModel",
                                            event.target.value || activeModelPresets[0]?.id || "openrouter/free",
                                        )}
                                        className="w-full font-mono"
                                        placeholder={activeModelPresets[0]?.id || "openrouter/free"}
                                    />
                                </div>
                            </div>
                        </Field>

                        <Field orientation="responsive" className={SETTINGS_FIELD_CLASS}>
                            <FieldContent>
                                <FieldTitle>API key portal</FieldTitle>
                                <FieldDescription>{providerGuide.helper}</FieldDescription>
                            </FieldContent>
                            <div className={SETTINGS_CONTROL_CLASS}>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                        void tauriApi.openExternalUrl(providerGuide.keysUrl);
                                    }}
                                >
                                    Open keys page
                                    <ExternalLink data-icon="inline-end" />
                                </Button>
                            </div>
                        </Field>
                    </FieldGroup>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Credential</CardTitle>
                    <CardDescription>Store a provider credential locally for this device.</CardDescription>
                    <CardAction>
                        <Badge variant={status?.configured ? "secondary" : "outline"}>
                            {status?.configured ? "Configured" : "Missing"}
                        </Badge>
                    </CardAction>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    <Alert className={cn(status?.configured ? "border-success/20 bg-success/10 text-success" : "border-border/60 bg-muted/30")}>
                        {status?.configured ? <ShieldCheck /> : <ShieldOff />}
                        <AlertTitle>{status?.configured ? "Credential ready" : "Credential required"}</AlertTitle>
                        <AlertDescription className={cn(status?.configured ? "text-success/80" : "text-muted-foreground")}>
                            {status?.configured
                                ? status.maskedKey
                                    ? `${providerLabel} is configured with ${status.maskedKey}.`
                                    : `${providerLabel} is configured for this device.`
                                : `Add an API key or connect ${providerLabel} before using AI-assisted SQL generation.`}
                        </AlertDescription>
                    </Alert>

                    {oauthFlowId ? (
                        <Alert className="border-primary/20 bg-primary/5 text-primary">
                            <Loader2 className="animate-spin" />
                            <AlertTitle>Waiting for browser callback</AlertTitle>
                            <AlertDescription className="text-primary/80">
                                Keep this settings page open while the OAuth flow returns to the app.
                            </AlertDescription>
                        </Alert>
                    ) : null}

                    <FieldGroup>
                        {appSettings.aiAuthMode === "api_key" || !oauthSupported ? (
                            <>
                                <Field orientation="responsive" className={SETTINGS_FIELD_CLASS}>
                                    <FieldContent>
                                        <FieldTitle>{providerLabel} API key</FieldTitle>
                                        <FieldDescription>
                                            {status?.configured && status.maskedKey
                                                ? `Saved on this device as ${status.maskedKey}.`
                                                : "Paste a provider key and save it securely."}
                                        </FieldDescription>
                                    </FieldContent>
                                    <div className={cn("flex w-full shrink-0 flex-col gap-2", SETTINGS_XL_CONTROL_CLASS)}>
                                        <Input
                                            type="password"
                                            value={apiKeyInput}
                                            onChange={(event) => setApiKeyInput(event.target.value)}
                                            className="w-full font-mono"
                                            placeholder={providerGuide.placeholder}
                                        />
                                        <div className="flex flex-wrap justify-end gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={handleTestApiKey}
                                                disabled={loading || !apiKeyInput.trim()}
                                            >
                                                {loading ? <Loader2 data-icon="inline-start" className="animate-spin" /> : null}
                                                Test key
                                            </Button>
                                            <Button size="sm" onClick={handleSaveApiKey} disabled={loading || !apiKeyInput.trim()}>
                                                {loading ? <Loader2 data-icon="inline-start" className="animate-spin" /> : null}
                                                Save key
                                            </Button>
                                        </div>
                                    </div>
                                </Field>

                                {status?.configured ? (
                                    <Field orientation="responsive" className={SETTINGS_FIELD_CLASS}>
                                        <FieldContent>
                                            <FieldTitle>Remove saved credential</FieldTitle>
                                            <FieldDescription>Clear the stored {providerLabel} credential from this device.</FieldDescription>
                                        </FieldContent>
                                        <div className={SETTINGS_CONTROL_CLASS}>
                                            <Button size="sm" variant="outline" onClick={handleClearCredential} disabled={loading}>
                                                <Trash2 data-icon="inline-start" />
                                                Remove credential
                                            </Button>
                                        </div>
                                    </Field>
                                ) : null}
                            </>
                        ) : (
                            <Field orientation="responsive" className={SETTINGS_FIELD_CLASS}>
                                <FieldContent>
                                    <FieldTitle>OAuth connection</FieldTitle>
                                    <FieldDescription>
                                        {status?.configured
                                            ? `Connected via ${status.authMode}${status.maskedKey ? ` · ${status.maskedKey}` : ""}.`
                                            : `Connect ${providerLabel} in your browser and finish the localhost callback.`}
                                    </FieldDescription>
                                </FieldContent>
                                <div className={SETTINGS_CONTROL_CLASS}>
                                    <div className="flex flex-wrap gap-2">
                                        <Button size="sm" onClick={handleOAuthConnect} disabled={oauthLoading}>
                                            {oauthLoading ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Wand2 data-icon="inline-start" />}
                                            {oauthLoading ? "Waiting..." : "Connect"}
                                        </Button>
                                        {status?.configured ? (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={handleClearCredential}
                                                disabled={loading || oauthLoading}
                                            >
                                                Disconnect
                                            </Button>
                                        ) : null}
                                    </div>
                                </div>
                            </Field>
                        )}
                    </FieldGroup>
                </CardContent>
            </Card>
        </div>
    );
}

function StorageSection() {
    const { clearAllHistory, clearAllSavedQueries, connections, queryHistory, savedQueries } = useAppStore();
    const [dataDir, setDataDir] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        void tauriApi.getAppDataDir()
            .then((path) => {
                if (!cancelled) {
                    setDataDir(path);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setDataDir(null);
                }
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const totalHistory = queryHistory.length;

    return (
        <div className="flex flex-col gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Local data</CardTitle>
                    <CardDescription>Connections and saved queries are stored locally in an encrypted app directory.</CardDescription>
                    <CardAction>
                        <Badge variant="outline">Local only</Badge>
                    </CardAction>
                </CardHeader>
                <CardContent>
                    {dataDir ? (
                        <Item variant="outline" className="items-start bg-muted/20">
                            <FolderOpen className="mt-0.5 text-muted-foreground" />
                            <ItemContent className="gap-1">
                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">App data directory</p>
                                <p className="break-all font-mono text-sm text-foreground/80">{dataDir}</p>
                            </ItemContent>
                        </Item>
                    ) : (
                        <Alert className="border-border/60 bg-muted/30">
                            <Loader2 className="animate-spin" />
                            <AlertTitle>Resolving local data directory</AlertTitle>
                            <AlertDescription>
                                The app is checking where encrypted settings and saved queries live on this device.
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Usage snapshot</CardTitle>
                    <CardDescription>A quick summary of locally stored connections, queries, and history.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-3 md:grid-cols-3">
                        {[
                            { label: "Connections", value: connections.length },
                            { label: "Saved Queries", value: savedQueries.length },
                            { label: "History Entries", value: totalHistory },
                        ].map((stat) => (
                            <div key={stat.label} className="flex flex-col gap-1 rounded-xl border border-border/60 bg-muted/20 px-4 py-4">
                                <span className="text-2xl font-semibold tabular-nums text-foreground">{stat.value}</span>
                                <span className="text-sm text-muted-foreground">{stat.label}</span>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Cleanup</CardTitle>
                    <CardDescription>Remove local history or saved queries from this device.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    <Alert className="border-warning/20 bg-warning/10 text-warning">
                        <Trash2 />
                        <AlertTitle>Destructive actions</AlertTitle>
                        <AlertDescription className="text-warning/80">
                            These changes affect only local app data and cannot be undone.
                        </AlertDescription>
                    </Alert>

                    <FieldGroup>
                        <Field orientation="responsive" className={SETTINGS_FIELD_CLASS}>
                            <FieldContent>
                                <FieldTitle>Query history</FieldTitle>
                                <FieldDescription>{totalHistory} entries across all connections.</FieldDescription>
                            </FieldContent>
                            <div className={SETTINGS_CONTROL_CLASS}>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button size="sm" variant="outline" disabled={totalHistory === 0}>
                                            <Trash2 data-icon="inline-start" />
                                            Clear history
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent size="sm">
                                        <AlertDialogHeader>
                                            <AlertDialogMedia className="bg-destructive/10 text-destructive">
                                                <Trash2 />
                                            </AlertDialogMedia>
                                            <AlertDialogTitle>Clear query history?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Remove every saved history entry across all connections on this device.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction variant="destructive" onClick={clearAllHistory}>
                                                Clear history
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </Field>

                        <Field orientation="responsive" className={SETTINGS_FIELD_CLASS}>
                            <FieldContent>
                                <FieldTitle>Saved queries</FieldTitle>
                                <FieldDescription>{savedQueries.length} saved queries.</FieldDescription>
                            </FieldContent>
                            <div className={SETTINGS_CONTROL_CLASS}>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button size="sm" variant="outline" disabled={savedQueries.length === 0}>
                                            <Trash2 data-icon="inline-start" />
                                            Clear saved queries
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent size="sm">
                                        <AlertDialogHeader>
                                            <AlertDialogMedia className="bg-destructive/10 text-destructive">
                                                <Trash2 />
                                            </AlertDialogMedia>
                                            <AlertDialogTitle>Clear saved queries?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Remove all stored saved queries from this device.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction variant="destructive" onClick={clearAllSavedQueries}>
                                                Clear queries
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </Field>
                    </FieldGroup>
                </CardContent>
            </Card>
        </div>
    );
}

function LicenseSection({ onActivate }: { onActivate: () => void }) {
    const [state, setState] = useState<StoredLicenseState | null | "loading">("loading");

    useEffect(() => {
        let cancelled = false;

        void licenseGetStored()
            .then((nextState) => {
                if (!cancelled) {
                    setState(nextState);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setState(null);
                }
            });

        return () => {
            cancelled = true;
        };
    }, []);

    if (state === "loading") {
        return (
            <div className="flex flex-col gap-6">
                <Card>
                    <CardContent className="flex items-center gap-2 py-8 text-muted-foreground">
                        <RefreshCw className="animate-spin" />
                        <span>Loading stored license information.</span>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!state) {
        return (
            <div className="flex flex-col gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>No active license</CardTitle>
                        <CardDescription>Activate a key to unlock licensed features on this device.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Empty className="border border-dashed border-border/70 bg-muted/20">
                            <EmptyHeader>
                                <EmptyMedia variant="icon" className="size-12 rounded-xl bg-muted text-muted-foreground">
                                    <ShieldOff />
                                </EmptyMedia>
                                <EmptyTitle className="text-base">License not activated</EmptyTitle>
                                <EmptyDescription>
                                    Add your DB Connect license key to enable all paid features.
                                </EmptyDescription>
                            </EmptyHeader>
                            <EmptyContent>
                                <Button onClick={onActivate}>
                                    <KeyRound data-icon="inline-start" />
                                    Activate license
                                </Button>
                            </EmptyContent>
                        </Empty>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const { activation, license } = state;
    const maskedKey = license.license_key.replace(
        /^(DBK-[A-Z0-9]{4}-)([A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4})$/,
        (_, prefix) => `${prefix}****-****-****`,
    );
    const isExpired = new Date(license.expiry) < new Date();
    const maskedDeviceId = activation.device_id.length > 8 ? `${activation.device_id.slice(0, 8)}...` : activation.device_id;

    const formatDate = (iso: string) => {
        try {
            return new Date(iso).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
            });
        } catch {
            return iso;
        }
    };

    const formatDateTime = (iso: string | null) => {
        if (!iso) {
            return "Never";
        }

        try {
            return new Date(iso).toLocaleString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            });
        } catch {
            return iso;
        }
    };

    const details: { label: string; value: ReactNode }[] = [
        {
            label: "License key",
            value: <p className="font-mono text-sm tracking-wider text-foreground/80">{maskedKey}</p>,
        },
        {
            label: "Email",
            value: <p className="font-mono text-sm text-foreground/80">{license.email}</p>,
        },
        {
            label: "Expires",
            value: (
                <div className={cn("flex items-center gap-2 text-sm font-mono", isExpired ? "text-destructive" : "text-foreground/80")}>
                    <CalendarClock className="shrink-0" />
                    {formatDate(license.expiry)}
                </div>
            ),
        },
        {
            label: "Max devices",
            value: <p className="font-mono text-sm text-foreground/80">{license.max_devices}</p>,
        },
        {
            label: "Device ID",
            value: (
                <div className="flex items-center gap-2 text-sm font-mono text-foreground/80">
                    <Cpu className="shrink-0" />
                    {maskedDeviceId}
                </div>
            ),
        },
        {
            label: "Last validated",
            value: <p className="text-sm text-foreground/80">{formatDateTime(activation.last_validated_at)}</p>,
        },
    ];

    const handleDeactivate = async () => {
        await licenseDeactivate().catch(() => { });
        setState(null);
    };

    return (
        <div className="flex flex-col gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>License status</CardTitle>
                    <CardDescription>Activation and renewal state for this device.</CardDescription>
                    <CardAction>
                        <Badge variant="outline" className={cn("capitalize", getPlanBadgeClass(license.plan))}>
                            {license.plan}
                        </Badge>
                    </CardAction>
                </CardHeader>
                <CardContent>
                    <Alert className={cn(
                        isExpired
                            ? "border-destructive/20 bg-destructive/10 text-destructive"
                            : "border-success/20 bg-success/10 text-success",
                    )}>
                        {isExpired ? <ShieldOff /> : <ShieldCheck />}
                        <AlertTitle>{isExpired ? "License expired" : "License active"}</AlertTitle>
                        <AlertDescription className={cn(isExpired ? "text-destructive/80" : "text-success/80")}>
                            {isExpired
                                ? `This license expired on ${formatDate(license.expiry)}.`
                                : `This device is licensed through ${formatDate(license.expiry)}.`}
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Activation details</CardTitle>
                    <CardDescription>The currently stored license and device metadata.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ItemGroup className="gap-3">
                        {details.map((detail) => (
                            <Item key={detail.label} variant="outline" size="sm" className="items-start bg-muted/10">
                                <ItemContent className="gap-1">
                                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{detail.label}</p>
                                    {detail.value}
                                </ItemContent>
                            </Item>
                        ))}
                    </ItemGroup>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Deactivate this device</CardTitle>
                    <CardDescription>Free this activation slot so the license can be used on another machine.</CardDescription>
                    <CardAction>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button size="sm" variant="outline">
                                    <ShieldOff data-icon="inline-start" />
                                    Deactivate
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent size="sm">
                                <AlertDialogHeader>
                                    <AlertDialogMedia className="bg-destructive/10 text-destructive">
                                        <ShieldOff />
                                    </AlertDialogMedia>
                                    <AlertDialogTitle>Deactivate this device?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This removes the local activation and frees one device slot for the same license.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction variant="destructive" onClick={handleDeactivate}>
                                        Deactivate device
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </CardAction>
                </CardHeader>
                <CardContent>
                    <Alert className="border-warning/20 bg-warning/10 text-warning">
                        <ShieldOff />
                        <AlertTitle>Device slot will be released</AlertTitle>
                        <AlertDescription className="text-warning/80">
                            You may need to reactivate the license key before using licensed features on this machine again.
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        </div>
    );
}

function AboutSection() {
    const metadata = [
        { label: "Built with", value: "Tauri 2 · React 19 · TypeScript" },
        { label: "UI", value: "Tailwind CSS v4 · shadcn/ui" },
        { label: "Database", value: "SQLx · sqlx-sqlite · AES-256-GCM" },
        { label: "Editor", value: "CodeMirror 6" },
        { label: "Grid", value: "TanStack Table v8" },
    ];

    return (
        <div className="flex flex-col gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>DB Connect</CardTitle>
                    <CardDescription>A desktop SQL workspace for connections, editing, and table exploration.</CardDescription>
                    <CardAction>
                        <Badge variant="secondary">Version {packageJson.version}</Badge>
                    </CardAction>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-muted/20 p-4 sm:flex-row sm:items-start">
                        <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <Table2 />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <p className="text-sm font-medium text-foreground">Built for focused desktop database work</p>
                            <p className="text-sm leading-6 text-muted-foreground">
                                DB Connect combines connection management, SQL authoring, query history, and encrypted local storage in a single Tauri app.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Runtime stack</CardTitle>
                    <CardDescription>The main platform pieces and libraries currently bundled with the app.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ItemGroup className="gap-3">
                        {metadata.map((item) => (
                            <Item key={item.label} variant="outline" size="sm" className="items-start bg-muted/10">
                                <ItemContent className="gap-1">
                                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.label}</p>
                                    <p className="text-sm text-foreground/80">{item.value}</p>
                                </ItemContent>
                            </Item>
                        ))}
                    </ItemGroup>
                </CardContent>
            </Card>
        </div>
    );
}

export function SettingsPage({ onActivate }: { onActivate?: () => void }) {
    const { setActiveView } = useAppStore();
    const [activeSection, setActiveSection] = useState<Section>("appearance");
    const activeNav = NAV.find((section) => section.id === activeSection) ?? NAV[0];
    const ActiveIcon = activeNav.icon;

    const handleSectionChange = (value: string) => {
        if (!value || value === activeSection) {
            return;
        }

        startTransition(() => {
            setActiveSection(value as Section);
        });
    };

    return (
        <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-app-bg">
            <div className="flex w-full shrink-0 items-center gap-3 border-b border-border-subtle bg-surface-1 px-6 py-4">
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Back to workspace"
                    onClick={() => setActiveView("main")}
                    className="shrink-0"
                >
                    <ChevronDown className="rotate-90" />
                </Button>

                <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold tracking-tight text-foreground">Settings</p>
                    <p className="text-[12px] text-muted-foreground/70">
                        Adjust appearance, editor behavior, AI, storage, and licensing.
                    </p>
                </div>

                <div className="w-48 md:hidden">
                    <Select value={activeSection} onValueChange={handleSectionChange}>
                        <SelectTrigger size="sm" className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                {NAV.map((item) => (
                                    <SelectItem key={item.id} value={item.id}>
                                        {item.label}
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <Tabs
                value={activeSection}
                onValueChange={handleSectionChange}
                orientation="vertical"
                className="min-h-0 flex-1 w-full min-w-0 flex-col gap-0 bg-app-bg md:flex-row"
            >
                <aside className="hidden w-64 shrink-0 border-r border-border-subtle bg-surface-1 md:flex md:flex-col">
                    <div className="px-4 py-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Categories</p>
                    </div>

                    <TabsList variant="line" className="h-auto w-full items-stretch gap-1 bg-transparent p-2">
                        {NAV.map((item) => {
                            const Icon = item.icon;
                            const isActive = activeSection === item.id;

                            return (
                                <TabsTrigger
                                    key={item.id}
                                    value={item.id}
                                    className={cn(
                                        "h-10 justify-start gap-2.5 rounded-none border px-3 text-left text-sm font-medium after:hidden",
                                        isActive
                                            ? "border-border-subtle bg-surface-2 text-foreground"
                                            : "border-transparent bg-transparent text-muted-foreground hover:bg-surface-3 hover:text-foreground",
                                    )}
                                >
                                    <Icon data-icon="inline-start" className={cn(isActive ? "text-foreground" : "text-muted-foreground/70")} />
                                    {item.label}
                                </TabsTrigger>
                            );
                        })}
                    </TabsList>
                </aside>

                <ScrollArea className="min-h-0 flex-1 w-full min-w-0">
                    <div className="min-h-full w-full bg-app-bg px-6 py-6">
                        <div className={SETTINGS_CONTENT_WIDTH_CLASS}>
                            <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                <ActiveIcon />
                                <span>{activeNav.label}</span>
                            </div>
                            <div className="flex flex-col gap-1">
                                <h2 className="text-2xl font-semibold tracking-tight text-foreground">{activeNav.label}</h2>
                                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{activeNav.description}</p>
                            </div>
                            </div>

                        <TabsContent value="appearance" className="mt-0 flex w-full min-w-0 flex-col gap-6">
                            <AppearanceSection />
                        </TabsContent>
                        <TabsContent value="editor" className="mt-0 flex w-full min-w-0 flex-col gap-6">
                            <EditorSection />
                        </TabsContent>
                        <TabsContent value="table" className="mt-0 flex w-full min-w-0 flex-col gap-6">
                            <TableSection />
                        </TabsContent>
                        <TabsContent value="ai" className="mt-0 flex w-full min-w-0 flex-col gap-6">
                            <AiSection />
                        </TabsContent>
                        <TabsContent value="storage" className="mt-0 flex w-full min-w-0 flex-col gap-6">
                            <StorageSection />
                        </TabsContent>
                        <TabsContent value="license" className="mt-0 flex w-full min-w-0 flex-col gap-6">
                            <LicenseSection
                                onActivate={() => {
                                    setActiveView("main");
                                    onActivate?.();
                                }}
                            />
                        </TabsContent>
                        <TabsContent value="about" className="mt-0 flex w-full min-w-0 flex-col gap-6">
                            <AboutSection />
                        </TabsContent>
                        </div>
                    </div>
                </ScrollArea>
            </Tabs>
        </div>
    );
}
