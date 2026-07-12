import { useEffect, useState, type ReactNode } from "react";
import {
    CalendarClock,
    Cpu,
    KeyRound,
    RefreshCw,
    ShieldCheck,
    ShieldOff,
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
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty";
import { Item, ItemContent, ItemGroup } from "@/components/ui/item";
import { cn } from "@/lib/utils";
import { licenseDeactivate, licenseGetStored, type StoredLicenseState } from "@/features/licensing/lib/license";
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    getPlanBadgeClass,
} from "./settings-primitives";

export function LicenseSection({ onActivate }: { onActivate: () => void }) {
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
