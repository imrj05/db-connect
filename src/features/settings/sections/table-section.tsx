import { Badge } from "@/components/ui/badge";
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldGroup,
    FieldTitle,
} from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAppStore, type AppSettings } from "@/stores/useAppStore";
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    SETTINGS_CONTROL_CLASS,
    SETTINGS_FIELD_CLASS,
} from "./settings-primitives";

export function TableSection() {
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
                                    aria-label="Rows per page"
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
                                    aria-label="Row density"
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
