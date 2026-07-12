import { Badge } from "@/components/ui/badge";
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldGroup,
    FieldTitle,
} from "@/components/ui/field";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAppStore, type AppSettings, type EditorThemeOption } from "@/stores/useAppStore";
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    EDITOR_DARK_THEMES,
    EDITOR_LIGHT_THEMES,
    QUERY_ROW_LIMIT_OPTIONS,
    QUERY_SQL_SIZE_OPTIONS,
    SETTINGS_CONTROL_CLASS,
    SETTINGS_FIELD_CLASS,
    SETTINGS_WIDE_CONTROL_CLASS,
    formatBytes,
} from "./settings-primitives";

export function EditorSection() {
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
                                    aria-label="Editor font size"
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
                                    <SelectTrigger aria-label="Dark editor theme" className={SETTINGS_WIDE_CONTROL_CLASS}>
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
                                    <SelectTrigger aria-label="Light editor theme" className={SETTINGS_WIDE_CONTROL_CLASS}>
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
                                    aria-label="Word wrap"
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
                                    aria-label="Tab size"
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
                    <CardTitle>Query safety limits</CardTitle>
                    <CardDescription>Protect the app and connected databases from oversized SQL, long-running queries, and very large result sets.</CardDescription>
                    <CardAction>
                        <div className="flex flex-wrap gap-1.5">
                            <Badge variant="secondary">{appSettings.queryTimeoutSecs}s</Badge>
                            <Badge variant="secondary">{formatBytes(appSettings.queryMaxSqlBytes)}</Badge>
                            <Badge variant="secondary">{appSettings.queryMaxResultRows.toLocaleString()} rows</Badge>
                        </div>
                    </CardAction>
                </CardHeader>
                <CardContent>
                    <FieldGroup>
                        <Field orientation="responsive" className={SETTINGS_FIELD_CLASS}>
                            <FieldContent>
                                <FieldTitle>Query timeout</FieldTitle>
                                <FieldDescription>Maximum seconds a single query may run before timing out.</FieldDescription>
                            </FieldContent>
                            <div className={SETTINGS_CONTROL_CLASS}>
                                <ToggleGroup
                                    type="single"
                                    variant="outline"
                                    size="sm"
                                    spacing={1}
                                    aria-label="Query timeout"
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
                        <Field orientation="responsive" className={SETTINGS_FIELD_CLASS}>
                            <FieldContent>
                                <FieldTitle>Max SQL size</FieldTitle>
                                <FieldDescription>SQL editor queries larger than this are blocked before execution.</FieldDescription>
                            </FieldContent>
                            <div className={SETTINGS_CONTROL_CLASS}>
                                <ToggleGroup
                                    type="single"
                                    variant="outline"
                                    size="sm"
                                    spacing={1}
                                    aria-label="Max SQL size"
                                    value={String(appSettings.queryMaxSqlBytes)}
                                    onValueChange={(value) => {
                                        if (!value) return;
                                        updateAppSetting("queryMaxSqlBytes", Number(value));
                                    }}
                                >
                                    {QUERY_SQL_SIZE_OPTIONS.map((option) => (
                                        <ToggleGroupItem key={option.value} value={String(option.value)}>{option.label}</ToggleGroupItem>
                                    ))}
                                </ToggleGroup>
                            </div>
                        </Field>
                        <Field orientation="responsive" className={SETTINGS_FIELD_CLASS}>
                            <FieldContent>
                                <FieldTitle>Max result rows</FieldTitle>
                                <FieldDescription>Query and table results are capped to this many rows before rendering.</FieldDescription>
                            </FieldContent>
                            <div className={SETTINGS_CONTROL_CLASS}>
                                <ToggleGroup
                                    type="single"
                                    variant="outline"
                                    size="sm"
                                    spacing={1}
                                    aria-label="Max result rows"
                                    value={String(appSettings.queryMaxResultRows)}
                                    onValueChange={(value) => {
                                        if (!value) return;
                                        updateAppSetting("queryMaxResultRows", Number(value));
                                    }}
                                >
                                    {QUERY_ROW_LIMIT_OPTIONS.map((rows) => (
                                        <ToggleGroupItem key={rows} value={String(rows)}>{rows.toLocaleString()}</ToggleGroupItem>
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
