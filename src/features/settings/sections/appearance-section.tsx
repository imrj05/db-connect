import { useEffect, useState } from "react";
import { Loader2, Moon, Sun } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldGroup,
    FieldTitle,
} from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DB_FONT_MONO, DB_FONT_MONO_STACK, DB_FONT_SANS, DB_FONT_SANS_STACK, getSystemFonts } from "@/lib/fonts";
import { useAppStore, type AppSettings } from "@/stores/useAppStore";
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    FontPicker,
    SETTINGS_CONTROL_CLASS,
    SETTINGS_FIELD_CLASS,
    SETTINGS_WIDE_CONTROL_CLASS,
} from "./settings-primitives";

export function AppearanceSection() {
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
                                    aria-label="App theme"
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
                                <FieldTitle>UI zoom</FieldTitle>
                                <FieldDescription>Scale the entire workspace up or down.</FieldDescription>
                            </FieldContent>
                            <div className={SETTINGS_CONTROL_CLASS}>
                                <ToggleGroup
                                    type="single"
                                    variant="outline"
                                    size="sm"
                                    spacing={1}
                                    aria-label="UI zoom"
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
