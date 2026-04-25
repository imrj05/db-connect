import { Key, FileText, FolderOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ConnectionConfig } from "@/types";

function FormLabel({ children }: { children: React.ReactNode }) {
    return (
        <Label className="mb-1 block text-[11px] font-label font-bold uppercase tracking-[0.16em] text-muted-foreground/65">
            {children}
        </Label>
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
                "flex items-center gap-2 border px-2.5 py-2 text-left transition-colors",
                active
                    ? "border-primary/24 bg-primary/5 text-foreground"
                    : "border-border-subtle bg-surface-2 hover:border-border hover:bg-surface-3 text-muted-foreground/80",
            )}
        >
            <Icon size={12} className="shrink-0" />
            <span className="text-xs font-medium">{title}</span>
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
        <div>
            {/* Toggle row */}
            <div
                className="flex cursor-pointer items-center justify-between gap-3"
                onClick={() => onPatch({ sshEnabled: !tunnelEnabled })}
            >
                <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-foreground">SSH Tunnel</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground/60">
                        Route the connection through a bastion host.
                    </p>
                </div>
                <Switch
                    checked={tunnelEnabled}
                    onCheckedChange={(checked) => onPatch({ sshEnabled: checked })}
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0"
                />
            </div>

            {/* Expanded fields */}
            <AnimatePresence initial={false}>
                {tunnelEnabled && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        className="overflow-hidden"
                    >
                        <div className="mt-4 space-y-4 border-t border-border-subtle pt-4">
                            {/* Host + Port */}
                            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_96px]">
                                <div>
                                    <FormLabel>SSH Host</FormLabel>
                                    <Input
                                        value={formData.sshHost ?? ""}
                                        onChange={(e) => onPatch({ sshHost: e.target.value })}
                                        placeholder="bastion.example.com"
                                        className="h-9 border-border-subtle bg-background text-xs"
                                    />
                                </div>
                                <div>
                                    <FormLabel>Port</FormLabel>
                                    <Input
                                        type="number"
                                        value={formData.sshPort ?? 22}
                                        onChange={(e) => onPatch({ sshPort: parseInt(e.target.value) || 22 })}
                                        className="h-9 border-border-subtle bg-background font-mono text-xs"
                                    />
                                </div>
                            </div>

                            {/* SSH User */}
                            <div>
                                <FormLabel>SSH User</FormLabel>
                                <Input
                                    value={formData.sshUser ?? ""}
                                    onChange={(e) => onPatch({ sshUser: e.target.value })}
                                    placeholder="ubuntu"
                                    className="h-9 border-border-subtle bg-background text-xs"
                                />
                            </div>

                            {/* Auth method */}
                            <div>
                                <p className="shell-section-label mb-2 text-muted-foreground/55">Auth Method</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <AuthMethodButton
                                        active={!isKeyAuth}
                                        icon={Key}
                                        title="Password"
                                        onClick={() => onPatch({ sshKeyPath: undefined, sshKeyPassphrase: undefined })}
                                    />
                                    <AuthMethodButton
                                        active={isKeyAuth}
                                        icon={FileText}
                                        title="SSH Key File"
                                        onClick={() => onPatch({ sshKeyPath: formData.sshKeyPath ?? "", sshPassword: undefined })}
                                    />
                                </div>
                            </div>

                            {/* Password input */}
                            {!isKeyAuth && (
                                <div>
                                    <FormLabel>Password</FormLabel>
                                    <Input
                                        type="password"
                                        value={formData.sshPassword ?? ""}
                                        onChange={(e) => onPatch({ sshPassword: e.target.value })}
                                        placeholder="SSH password"
                                        className="h-9 border-border-subtle bg-background text-xs"
                                    />
                                </div>
                            )}

                            {/* Key auth inputs */}
                            {isKeyAuth && (
                                <div className="space-y-3">
                                    <div>
                                        <FormLabel>Private Key Path</FormLabel>
                                        <div className="relative">
                                            <Input
                                                value={formData.sshKeyPath ?? ""}
                                                onChange={(e) => onPatch({ sshKeyPath: e.target.value })}
                                                placeholder="~/.ssh/id_rsa"
                                                className="h-9 border-border-subtle bg-background pr-9 font-mono text-xs"
                                            />
                                            <button
                                                type="button"
                                                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground/50 transition-colors hover:bg-surface-2 hover:text-foreground"
                                                onClick={async () => {
                                                    try {
                                                        const { open } = await import("@tauri-apps/plugin-dialog");
                                                        const path = await open({ multiple: false, directory: false });
                                                        if (typeof path === "string") onPatch({ sshKeyPath: path });
                                                    } catch {}
                                                }}
                                            >
                                                <FolderOpen size={12} />
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <FormLabel>Key Passphrase</FormLabel>
                                        <Input
                                            type="password"
                                            value={formData.sshKeyPassphrase ?? ""}
                                            onChange={(e) => onPatch({ sshKeyPassphrase: e.target.value })}
                                            placeholder="Passphrase (optional)"
                                            className="h-9 border-border-subtle bg-background text-xs"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
