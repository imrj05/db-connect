import { Key, FileText, FolderOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { ControlLabel } from "@/components/ui/control-label";
import { cn } from "@/lib/utils";
import { ConnectionConfig } from "@/types";

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
                "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left transition-colors",
                active
                    ? "border-primary/24 bg-primary/5 text-foreground"
                    : "border-border bg-card hover:border-border hover:bg-muted text-muted-foreground/80",
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
        <div className="rounded-md border border-border bg-popover px-3 py-2.5">
            {/* Toggle row — <div role="button">, NOT a <button>.
                The <Switch> renders a <button> internally; nesting <button>
                inside <button> is invalid HTML and causes "Maximum update
                depth exceeded" via DOM/vDOM mismatch. */}
            <div
                role="button"
                tabIndex={0}
                aria-pressed={tunnelEnabled}
                onClick={() => onPatch({ sshEnabled: !tunnelEnabled })}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onPatch({ sshEnabled: !tunnelEnabled });
                    }
                }}
                className="flex w-full cursor-pointer items-center justify-between gap-3 text-left transition-colors hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none rounded-sm -mx-1 px-1 py-0.5"
            >
                <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-foreground">SSH Tunnel</p>
                    <p className="mt-0.5 text-[11px] text-fg-muted">
                        Route the connection through a bastion host.
                    </p>
                </div>
                <span
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0"
                >
                    <Switch
                        checked={tunnelEnabled}
                        aria-hidden="true"
                        tabIndex={-1}
                        className="pointer-events-none"
                    />
                </span>
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
                        <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
                            {/* Host + Port */}
                            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_96px]">
                                <div>
                                    <ControlLabel>SSH Host</ControlLabel>
                                    <Input
                                        value={formData.sshHost ?? ""}
                                        onChange={(e) => onPatch({ sshHost: e.target.value })}
                                        placeholder="bastion.example.com"
                                        className="h-9 border-border bg-card text-xs"
                                    />
                                </div>
                                <div>
                                    <ControlLabel>Port</ControlLabel>
                                    <Input
                                        type="number"
                                        value={formData.sshPort ?? 22}
                                        onChange={(e) => onPatch({ sshPort: parseInt(e.target.value) || 22 })}
                                        className="h-9 border-border bg-card font-mono text-xs"
                                    />
                                </div>
                            </div>

                            {/* SSH User */}
                            <div>
                                <ControlLabel>SSH User</ControlLabel>
                                <Input
                                    value={formData.sshUser ?? ""}
                                    onChange={(e) => onPatch({ sshUser: e.target.value })}
                                    placeholder="ubuntu"
                                    className="h-9 border-border bg-card text-xs"
                                />
                            </div>

                            {/* Auth method */}
                            <div>
                                <p className="shell-section-label mb-1.5 text-muted-foreground/55">Auth Method</p>
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
                                    <ControlLabel>Password</ControlLabel>
                                    <Input
                                        type="password"
                                        value={formData.sshPassword ?? ""}
                                        onChange={(e) => onPatch({ sshPassword: e.target.value })}
                                        placeholder="SSH password"
                                        className="h-9 border-border bg-card text-xs"
                                    />
                                </div>
                            )}

                            {/* Key auth inputs */}
                            {isKeyAuth && (
                                <div className="flex flex-col gap-2.5">
                                    <div>
                                        <ControlLabel>Private Key Path</ControlLabel>
                                        <div className="relative">
                                            <Input
                                                value={formData.sshKeyPath ?? ""}
                                                onChange={(e) => onPatch({ sshKeyPath: e.target.value })}
                                                placeholder="~/.ssh/id_rsa"
                                                className="h-9 border-border bg-card pr-9 font-mono text-xs"
                                            />
                                            <button
                                                type="button"
                                                aria-label="Browse for SSH private key file"
                                                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-fg-muted transition-colors hover:bg-card hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
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
                                        <ControlLabel>Key Passphrase</ControlLabel>
                                        <Input
                                            type="password"
                                            value={formData.sshKeyPassphrase ?? ""}
                                            onChange={(e) => onPatch({ sshKeyPassphrase: e.target.value })}
                                            placeholder="Passphrase (optional)"
                                            className="h-9 border-border bg-card text-xs"
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
