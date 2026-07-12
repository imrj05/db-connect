import { useState } from "react";
import { Download, Loader2, Table2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Item, ItemContent, ItemGroup } from "@/components/ui/item";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import type { UpdateInfo } from "@/features/updates/update-dialog";
import packageJson from "../../../../package.json";
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "./settings-primitives";

export function AboutSection() {
    const [updateStatus, setUpdateStatus] = useState<"idle" | "checking" | "available" | "uptodate" | "error">("idle");
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
    const [installing, setInstalling] = useState(false);

    const handleCheckUpdate = async () => {
        setUpdateStatus("checking");
        setUpdateInfo(null);
        try {
            const info = await invoke<UpdateInfo>("check_for_updates");
            if (info.available) {
                setUpdateInfo(info);
                setUpdateStatus("available");
            } else {
                setUpdateStatus("uptodate");
            }
        } catch {
            setUpdateStatus("error");
        }
    };

    const handleInstall = async () => {
        setInstalling(true);
        try {
            await invoke("install_update");
        } catch (err) {
            console.error("Update install failed:", err);
            toast.error("Update installation failed");
            setInstalling(false);
        }
    };

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
                <CardContent className="flex flex-col gap-4">
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

                    {/* Check for updates */}
                    <div className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-medium text-foreground">Updates</span>
                            <span className="text-xs text-muted-foreground">
                                {updateStatus === "idle" && "Check whether a newer version is available."}
                                {updateStatus === "checking" && "Checking for updates…"}
                                {updateStatus === "uptodate" && `You're on the latest version (${packageJson.version}).`}
                                {updateStatus === "error" && "Unable to check for updates. Check your connection."}
                                {updateStatus === "available" && updateInfo && (
                                    <>Version <span className="font-mono font-semibold text-primary">{updateInfo.version}</span> is available</>
                                )}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            {updateStatus === "available" && !installing && (
                                <Button size="sm" className="h-7 gap-1.5 text-[11px]" onClick={handleInstall}>
                                    <Download size={11} />
                                    Update
                                </Button>
                            )}
                            {installing && (
                                <Button size="sm" className="h-7 gap-1.5 text-[11px]" disabled>
                                    <Loader2 size={11} className="animate-spin" />
                                    Installing…
                                </Button>
                            )}
                            {updateStatus !== "checking" && !installing && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-[11px]"
                                    onClick={handleCheckUpdate}
                                >
                                    {updateStatus === "idle" || updateStatus === "error" ? (
                                        "Check"
                                    ) : (
                                        "Check again"
                                    )}
                                </Button>
                            )}
                            {updateStatus === "checking" && (
                                <Button variant="outline" size="sm" className="h-7 text-[11px]" disabled>
                                    <Loader2 size={11} className="animate-spin" />
                                    Checking…
                                </Button>
                            )}
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
