import { Field, FieldContent, FieldDescription, FieldTitle } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { useAppStore } from "@/stores/useAppStore";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "./settings-primitives";

export function ExperimentalSection() {
    const appSettings = useAppStore((s) => s.appSettings);
    const updateAppSetting = useAppStore((s) => s.updateAppSetting);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Experimental Features</CardTitle>
                <CardDescription>
                    These features are under active development and may change or break. Enable at your own risk.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-6">
                    <Field>
                        <FieldContent>
                            <div className="flex items-center gap-3">
                                <div className="flex-1">
                                    <FieldTitle>Schema Editor</FieldTitle>
                                    <FieldDescription>
                                        Enable the interactive schema editor in the ER Diagram view.
                                        Allows creating, editing, and deleting tables, columns, indexes, and foreign keys
                                        directly from the diagram, with migration preview and apply workflow.
                                    </FieldDescription>
                                </div>
                                <Switch
                                    aria-label="Schema editor"
                                    checked={appSettings.experimentalSchemaEditor}
                                    onCheckedChange={(v) => updateAppSetting("experimentalSchemaEditor", v)}
                                />
                            </div>
                        </FieldContent>
                    </Field>
                </div>
            </CardContent>
        </Card>
    );
}
