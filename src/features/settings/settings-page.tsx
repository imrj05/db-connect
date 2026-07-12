import { startTransition, useMemo, useState } from "react";
import {
    ChevronDown,
    Code2,
    FlaskConical,
    HardDrive,
    Info,
    KeyRound,
    Keyboard,
    Palette,
    ShieldCheck,
    Table2,
    type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/useAppStore";
import { SETTINGS_CONTENT_WIDTH_CLASS } from "./sections/settings-primitives";
import { AppearanceSection } from "./sections/appearance-section";
import { EditorSection } from "./sections/editor-section";
import { TableSection } from "./sections/table-section";
import { StorageSection } from "./sections/storage-section";
import { PrivacySection } from "./sections/privacy-section";
import { LicenseSection } from "./sections/license-section";
import { KeybindingsSection } from "./sections/keybindings-section";
import { ExperimentalSection } from "./sections/experimental-section";
import { AboutSection } from "./sections/about-section";

type Section = "appearance" | "editor" | "table" | "storage" | "privacy" | "license" | "experimental" | "about" | "keybindings";

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
        id: "storage",
        label: "Storage",
        description: "Review local data usage and clear saved client-side records.",
        icon: HardDrive,
    },
    {
        id: "privacy",
        label: "Privacy",
        description: "Control error reporting and anonymous product telemetry sent to our server.",
        icon: ShieldCheck,
    },
    {
        id: "license",
        label: "License",
        description: "Manage activation status for this device and review license metadata.",
        icon: KeyRound,
    },
    {
        id: "keybindings",
        label: "Keybindings",
        description: "Browse all available keyboard shortcuts to navigate and control DB Connect.",
        icon: Keyboard,
    },
    {
        id: "experimental",
        label: "Experimental",
        description: "Try out features that are still in development. Use at your own risk.",
        icon: FlaskConical,
    },
    {
        id: "about",
        label: "About",
        description: "See version information and the technologies powering DB Connect.",
        icon: Info,
    },
];

export function SettingsPage({ onActivate }: { onActivate?: () => void }) {
    const { setActiveView } = useAppStore();
    const [activeSection, setActiveSection] = useState<Section>("appearance");
    const [searchQuery, setSearchQuery] = useState("");
    const filteredNav = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return NAV;
        return NAV.filter(
            (item) =>
                item.label.toLowerCase().includes(q) ||
                item.description.toLowerCase().includes(q) ||
                item.id.toLowerCase().includes(q),
        );
    }, [searchQuery]);
    const activeNav = filteredNav.find((section) => section.id === activeSection) ?? filteredNav[0] ?? NAV[0];
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
        <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-background">
            <div className="flex w-full shrink-0 items-center gap-3 border-b border-border bg-background px-6 py-4">
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
                    <p className="text-[12px] text-muted-foreground">
                        Adjust appearance, editor behavior, AI, storage, licensing, and keybindings.
                    </p>
                </div>

                <div className="hidden md:block w-64">
                    <Input
                        type="search"
                        aria-label="Search settings"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search settings…"
                        className="h-8 text-[12px]"
                    />
                </div>

                <div className="w-48 md:hidden">
                    <Select value={activeSection} onValueChange={handleSectionChange}>
                        <SelectTrigger aria-label="Settings section" size="sm" className="w-full">
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
                className="min-h-0 flex-1 w-full min-w-0 flex-col gap-0 bg-background md:flex-row"
            >
                <aside className="hidden w-56 shrink-0 border-r border-border bg-background md:flex md:flex-col">
                    <div className="px-5 pb-2 pt-6">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Categories</p>
                    </div>

                    <TabsList variant="line" className="h-auto w-full flex-col items-stretch gap-1 bg-transparent px-3 pb-4">
                        {filteredNav.map((item) => {
                            const Icon = item.icon;
                            const isActive = activeSection === item.id;

                            return (
                                <TabsTrigger
                                    key={item.id}
                                    value={item.id}
                                    asChild={false}
                                    className={cn(
                                        "h-10 w-full justify-start gap-3 rounded-md px-4 py-2.5 text-left text-[13px] font-medium after:hidden transition-colors",
                                        "border",
                                        isActive
                                            ? "border-border bg-muted text-foreground shadow-sm"
                                            : "border-transparent bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                                    )}
                                >
                                    <Icon
                                        className={cn(
                                            "size-4 shrink-0 transition-colors",
                                            isActive ? "text-foreground" : "text-muted-foreground",
                                        )}
                                    />
                                    {item.label}
                                </TabsTrigger>
                            );
                        })}
                    </TabsList>
                </aside>

                <ScrollArea className="min-h-0 flex-1 w-full min-w-0">
                    <div className="min-h-full w-full bg-background px-6 py-6">
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
                        <TabsContent value="storage" className="mt-0 flex w-full min-w-0 flex-col gap-6">
                            <StorageSection />
                        </TabsContent>
                        <TabsContent value="privacy" className="mt-0 flex w-full min-w-0 flex-col gap-6">
                            <PrivacySection />
                        </TabsContent>
                        <TabsContent value="license" className="mt-0 flex w-full min-w-0 flex-col gap-6">
                            <LicenseSection
                                onActivate={() => {
                                    setActiveView("main");
                                    onActivate?.();
                                }}
                            />
                        </TabsContent>
                        <TabsContent value="keybindings" className="mt-0 flex w-full min-w-0 flex-col gap-6">
                            <KeybindingsSection />
                        </TabsContent>
                        <TabsContent value="experimental" className="mt-0 flex w-full min-w-0 flex-col gap-6">
                            <ExperimentalSection />
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
