import {
    Field,
    FieldContent,
    FieldDescription,
    FieldGroup,
    FieldTitle,
} from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { useAppStore } from "@/stores/useAppStore";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    SETTINGS_CONTROL_CLASS,
    SETTINGS_FIELD_CLASS,
} from "./settings-primitives";

export function PrivacySection() {
    const appSettings = useAppStore((s) => s.appSettings);
    const updateAppSetting = useAppStore((s) => s.updateAppSetting);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Error reporting and telemetry</CardTitle>
                <CardDescription>
                    Reporting is only active when a DSN is configured at build time. Anonymous telemetry never includes SQL,
                    connection names, hosts, usernames, file paths, license keys, or query results.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <FieldGroup>
                    <Field orientation="responsive" className={SETTINGS_FIELD_CLASS}>
                        <FieldContent>
                            <FieldTitle>Error reporting</FieldTitle>
                            <FieldDescription>
                                Send frontend exceptions and native Tauri panics to our server so crashes can be fixed faster.
                            </FieldDescription>
                        </FieldContent>
                        <div className={SETTINGS_CONTROL_CLASS}>
                            <Switch
                                aria-label="Error reporting"
                                checked={appSettings.errorReportingEnabled}
                                onCheckedChange={(v) => updateAppSetting("errorReportingEnabled", v)}
                            />
                        </div>
                    </Field>

                    <Field orientation="responsive" className={SETTINGS_FIELD_CLASS}>
                        <FieldContent>
                            <FieldTitle>Anonymous telemetry</FieldTitle>
                            <FieldDescription>
                                Send coarse usage events, such as app startup, without identifying the user or database.
                            </FieldDescription>
                        </FieldContent>
                        <div className={SETTINGS_CONTROL_CLASS}>
                            <Switch
                                aria-label="Anonymous telemetry"
                                checked={appSettings.anonymousTelemetryEnabled}
                                onCheckedChange={(v) => updateAppSetting("anonymousTelemetryEnabled", v)}
                            />
                        </div>
                    </Field>
                </FieldGroup>
            </CardContent>
        </Card>
    );
}
