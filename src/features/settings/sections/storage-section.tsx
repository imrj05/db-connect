import { useEffect, useState } from "react";
import { FolderOpen, Loader2, Trash2 } from "lucide-react";
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
    Field,
    FieldContent,
    FieldDescription,
    FieldGroup,
    FieldTitle,
} from "@/components/ui/field";
import { Item, ItemContent } from "@/components/ui/item";
import { tauriApi } from "@/lib/tauri-api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAppStore } from "@/stores/useAppStore";
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

export function StorageSection() {
    const { clearAllHistory, clearAllSavedQueries, connections, queryHistory, savedQueries, appSettings, updateAppSetting } = useAppStore();
    const [dataDir, setDataDir] = useState<string | null>(null);
    const exportDir = appSettings.diagramExportDir;

    const handlePickExportDir = async () => {
        try {
            const picked = await tauriApi.pickDirectory(exportDir || undefined);
            if (picked) {
                updateAppSetting("diagramExportDir", picked);
                toast.success("Default export directory updated");
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to pick directory");
        }
    };

    const handleResetExportDir = () => {
        updateAppSetting("diagramExportDir", "");
        toast.success("Default export directory cleared");
    };

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
                    <CardTitle>Exports</CardTitle>
                    <CardDescription>Default location used when saving ER diagrams as PNG or SVG.</CardDescription>
                </CardHeader>
                <CardContent>
                    <FieldGroup>
                        <Field orientation="responsive" className={SETTINGS_FIELD_CLASS}>
                            <FieldContent>
                                <FieldTitle>Diagram export directory</FieldTitle>
                                <FieldDescription>
                                    {exportDir ? (
                                        <span className="break-all font-mono text-xs">{exportDir}</span>
                                    ) : (
                                        "Not set — the Save dialog will start in the system default location."
                                    )}
                                </FieldDescription>
                            </FieldContent>
                            <div className={cn(SETTINGS_CONTROL_CLASS, "gap-2")}>
                                <Button size="sm" variant="outline" onClick={() => { void handlePickExportDir(); }}>
                                    <FolderOpen data-icon="inline-start" />
                                    {exportDir ? "Change" : "Choose folder"}
                                </Button>
                                {exportDir ? (
                                    <Button size="sm" variant="ghost" onClick={handleResetExportDir}>
                                        Reset
                                    </Button>
                                ) : null}
                            </div>
                        </Field>
                    </FieldGroup>
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
