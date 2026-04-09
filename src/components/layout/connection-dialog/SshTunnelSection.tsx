import {
    Terminal,
    Key,
    FileText,
    FolderOpen,
    ArrowRight,
    Server,
    Shield,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ConnectionConfig } from "@/types";

function FormLabel({ children }: { children: React.ReactNode }) {
    return (
        <Label className="mb-1 block text-[9px] font-label font-bold uppercase tracking-[0.16em] text-muted-foreground/65">
            {children}
        </Label>
    );
}

function SecurityChip({
    label,
    value,
    icon: Icon,
    active = false,
}: {
    label: string;
    value: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    active?: boolean;
}) {
    return (
        <div
            className={cn(
                "rounded-lg border px-2.5 py-2 transition-colors",
                active
                    ? "border-accent/25 bg-accent/[0.06]"
                    : "border-border/70 bg-background/75",
            )}
        >
            <div className="flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[0.16em] text-muted-foreground/55">
                <Icon size={10} className="opacity-70" />
                <span>{label}</span>
            </div>
            <p className="mt-1 text-[10px] font-medium text-foreground">
                {value}
            </p>
        </div>
    );
}

function AuthMethodButton({
    active,
    icon: Icon,
    title,
    onClick,
}: {
    active: boolean;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    title: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-all",
                active
                    ? "border-accent/35 bg-accent/[0.08]"
                    : "border-border/70 bg-background/75 hover:border-border hover:bg-muted/20",
            )}
        >
            <div
                className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-md border transition-colors",
                    active
                        ? "border-accent/25 bg-accent/10 text-foreground"
                        : "border-border/70 bg-muted/20 text-muted-foreground/65",
                )}
            >
                <Icon size={12} />
            </div>
            <p className="min-w-0 text-[10px] font-semibold text-foreground">
                {title}
            </p>
            <span
                className={cn(
                    "ml-auto rounded-full border px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.16em]",
                    active
                        ? "border-accent/30 bg-accent/10 text-foreground/80"
                        : "border-transparent bg-muted/30 text-muted-foreground/55",
                )}
            >
                {active ? "On" : "Off"}
            </span>
        </button>
    );
}

export function SshTunnelSection({
    formData,
    onPatch,
}: {
    formData: Partial<ConnectionConfig>;
    onPatch: (partial: Partial<ConnectionConfig>) => void;
}) {
    const isKeyAuth =
        formData.sshKeyPath !== undefined ||
        formData.sshKeyPassphrase !== undefined;
    const tunnelEnabled = !!formData.sshEnabled;

    return (
        <div className="space-y-2">
            <div
                className={cn(
                    "overflow-hidden rounded-2xl border transition-all",
                    tunnelEnabled
                        ? "border-accent/25 bg-accent/5"
                        : "border-border bg-muted/15 hover:bg-muted/25",
                )}
            >
                <div
                    onClick={() => onPatch({ sshEnabled: !tunnelEnabled })}
                    className="flex cursor-pointer items-start justify-between gap-3 px-3.5 py-3"
                >
                    <div className="flex min-w-0 items-start gap-2.5">
                        <div
                            className={cn(
                                "flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors",
                                tunnelEnabled
                                    ? "border-accent/25 bg-accent/10 text-foreground"
                                    : "border-border/70 bg-muted/20 text-muted-foreground/55",
                            )}
                        >
                            <Terminal size={13} />
                        </div>
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                                <p className="text-[11px] font-semibold text-foreground">
                                    SSH Tunnel
                                </p>
                                <span
                                    className={cn(
                                        "rounded-full border px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.16em]",
                                        tunnelEnabled
                                            ? "border-accent/30 bg-accent/10 text-foreground/80"
                                            : "border-transparent bg-muted/30 text-muted-foreground/55",
                                    )}
                                >
                                    {tunnelEnabled ? "Enabled" : "Optional"}
                                </span>
                            </div>
                            <p className="mt-0.5 text-[9px] leading-relaxed text-muted-foreground/60">
                                Route the connection through a bastion host.
                            </p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[9px] text-muted-foreground/55">
                                <span className="rounded-full border border-border/70 bg-background/70 px-1.5 py-0.5">
                                    Client
                                </span>
                                <ArrowRight size={9} />
                                <span className="rounded-full border border-border/70 bg-background/70 px-1.5 py-0.5">
                                    SSH Host
                                </span>
                                <ArrowRight size={9} />
                                <span className="rounded-full border border-border/70 bg-background/70 px-1.5 py-0.5">
                                    Database
                                </span>
                            </div>
                        </div>
                    </div>
                    <Switch
                        checked={tunnelEnabled}
                        onCheckedChange={(checked) =>
                            onPatch({ sshEnabled: checked })
                        }
                        onClick={(e) => e.stopPropagation()}
                        className="mt-0.5 shrink-0"
                    />
                </div>

                <AnimatePresence initial={false}>
                    {tunnelEnabled && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.18, ease: "easeOut" }}
                            className="overflow-hidden border-t border-border/70"
                        >
                            <div className="space-y-3 px-3.5 py-3">
                                <div className="grid gap-1.5 md:grid-cols-3">
                                    <SecurityChip
                                        label="Tunnel Host"
                                        value={
                                            formData.sshHost?.trim() ||
                                            "Set bastion hostname"
                                        }
                                        icon={Server}
                                        active={!!formData.sshHost?.trim()}
                                    />
                                    <SecurityChip
                                        label="Port"
                                        value={String(formData.sshPort ?? 22)}
                                        icon={Terminal}
                                        active
                                    />
                                    <SecurityChip
                                        label="Authentication"
                                        value={
                                            isKeyAuth
                                                ? "SSH key file"
                                                : "Password"
                                        }
                                        icon={isKeyAuth ? FileText : Key}
                                        active
                                    />
                                </div>

                                <div className="grid gap-2.5 md:grid-cols-[minmax(0,1fr)_96px]">
                                    <div>
                                        <FormLabel>SSH Host</FormLabel>
                                        <Input
                                            value={formData.sshHost ?? ""}
                                            onChange={(e) =>
                                                onPatch({
                                                    sshHost: e.target.value,
                                                })
                                            }
                                            placeholder="bastion.example.com"
                                            className="h-9 border-border/70 bg-background/80 text-[12px]"
                                        />
                                    </div>
                                    <div>
                                        <FormLabel>Port</FormLabel>
                                        <Input
                                            type="number"
                                            value={formData.sshPort ?? 22}
                                            onChange={(e) =>
                                                onPatch({
                                                    sshPort:
                                                        parseInt(
                                                            e.target.value,
                                                        ) || 22,
                                                })
                                            }
                                            className="h-9 border-border/70 bg-background/80 font-mono text-[12px]"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <FormLabel>SSH User</FormLabel>
                                    <Input
                                        value={formData.sshUser ?? ""}
                                        onChange={(e) =>
                                            onPatch({
                                                sshUser: e.target.value,
                                            })
                                        }
                                        placeholder="ubuntu"
                                        className="h-9 border-border/70 bg-background/80 text-[12px]"
                                    />
                                </div>

                                <div className="rounded-xl border border-border/70 bg-background/60 p-2.5">
                                    <div className="flex items-center gap-2.5">
                                        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/20 text-muted-foreground/65">
                                            <Shield size={12} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-semibold text-foreground">
                                                Authentication Method
                                            </p>
                                            <p className="mt-0.5 text-[9px] leading-relaxed text-muted-foreground/60">
                                                Choose password or key-based
                                                access.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-2 grid gap-1.5 md:grid-cols-2">
                                        <AuthMethodButton
                                            active={!isKeyAuth}
                                            icon={Key}
                                            title="Password"
                                            onClick={() =>
                                                onPatch({
                                                    sshKeyPath: undefined,
                                                    sshKeyPassphrase:
                                                        undefined,
                                                })
                                            }
                                        />
                                        <AuthMethodButton
                                            active={isKeyAuth}
                                            icon={FileText}
                                            title="SSH Key File"
                                            onClick={() =>
                                                onPatch({
                                                    sshKeyPath:
                                                        formData.sshKeyPath ??
                                                        "",
                                                    sshPassword: undefined,
                                                })
                                            }
                                        />
                                    </div>

                                    {!isKeyAuth && (
                                        <div className="mt-2 rounded-lg border border-border/70 bg-muted/15 p-2.5">
                                            <FormLabel>Password</FormLabel>
                                            <Input
                                                type="password"
                                                value={
                                                    formData.sshPassword ?? ""
                                                }
                                                onChange={(e) =>
                                                    onPatch({
                                                        sshPassword:
                                                            e.target.value,
                                                    })
                                                }
                                                placeholder="SSH password"
                                                className="h-9 border-border/70 bg-background/80 text-[12px]"
                                            />
                                        </div>
                                    )}

                                    {isKeyAuth && (
                                        <div className="mt-2 space-y-2 rounded-lg border border-border/70 bg-muted/15 p-2.5">
                                            <div>
                                                <FormLabel>
                                                    Private Key Path
                                                </FormLabel>
                                                <div className="relative">
                                                    <Input
                                                        value={
                                                            formData.sshKeyPath ??
                                                            ""
                                                        }
                                                        onChange={(e) =>
                                                            onPatch({
                                                                sshKeyPath:
                                                                    e.target
                                                                        .value,
                                                            })
                                                        }
                                                        placeholder="~/.ssh/id_rsa"
                                                        className="h-9 border-border/70 bg-background/80 pr-9 font-mono text-[11px]"
                                                    />
                                                    <button
                                                        type="button"
                                                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground/50 transition-colors hover:bg-muted/30 hover:text-foreground"
                                                        onClick={async () => {
                                                            try {
                                                                const { open } =
                                                                    await import(
                                                                        "@tauri-apps/plugin-dialog"
                                                                    );
                                                                const path =
                                                                    await open({
                                                                        multiple:
                                                                            false,
                                                                        directory:
                                                                            false,
                                                                    });
                                                                if (
                                                                    typeof path ===
                                                                    "string"
                                                                ) {
                                                                    onPatch({
                                                                        sshKeyPath:
                                                                            path,
                                                                    });
                                                                }
                                                            } catch {}
                                                        }}
                                                    >
                                                        <FolderOpen size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                            <Input
                                                type="password"
                                                value={
                                                    formData.sshKeyPassphrase ??
                                                    ""
                                                }
                                                onChange={(e) =>
                                                    onPatch({
                                                        sshKeyPassphrase:
                                                            e.target.value,
                                                    })
                                                }
                                                placeholder="Key passphrase (optional)"
                                                className="h-9 border-border/70 bg-background/80 text-[12px]"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
