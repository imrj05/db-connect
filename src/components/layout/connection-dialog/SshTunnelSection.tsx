import { Terminal, Key, FileText, FolderOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ConnectionConfig } from "@/types";

function FormLabel({ children }: { children: React.ReactNode }) {
	return (
		<Label className="block text-[10px] font-label font-bold uppercase tracking-widest text-muted-foreground/70 mb-1.5">
			{children}
		</Label>
	);
}

export function SshTunnelSection({
	formData,
	onPatch,
}: {
	formData: Partial<ConnectionConfig>;
	onPatch: (partial: Partial<ConnectionConfig>) => void;
}) {
	return (
		<div className="space-y-2">
			<div
				onClick={() => onPatch({ sshEnabled: !formData.sshEnabled })}
				className={cn(
					"flex items-center justify-between px-4 py-3 rounded-xl border cursor-pointer transition-all",
					formData.sshEnabled
						? "bg-accent/5 border-accent/20"
						: "bg-muted/20 border-border hover:bg-muted/40",
				)}
			>
				<div className="flex items-center gap-3">
					<div
						className={cn(
							"size-8 rounded-lg flex items-center justify-center transition-colors",
							formData.sshEnabled
								? "bg-accent/10 text-accent-foreground"
								: "bg-muted text-muted-foreground/40",
						)}
					>
						<Terminal size={14} />
					</div>
					<div>
						<p className="text-[12px] font-semibold text-foreground">
							SSH Tunnel
						</p>
						<p className="text-[10px] text-muted-foreground/50">
							Connect via SSH port-forward
						</p>
					</div>
				</div>
				<Switch
					checked={!!formData.sshEnabled}
					onCheckedChange={(checked) => onPatch({ sshEnabled: checked })}
					onClick={(e) => e.stopPropagation()}
					className="shrink-0"
				/>
			</div>

			<AnimatePresence>
				{formData.sshEnabled && (
					<motion.div
						initial={{ opacity: 0, height: 0 }}
						animate={{ opacity: 1, height: "auto" }}
						exit={{ opacity: 0, height: 0 }}
						transition={{ duration: 0.15 }}
						className="overflow-hidden"
					>
						<div className="space-y-3 pt-1 pl-1 border-l-2 border-accent/20 ml-4">
							{/* SSH Host + Port */}
							<div className="grid grid-cols-[1fr_100px] gap-2">
								<div>
									<FormLabel>SSH Host</FormLabel>
									<Input
										value={formData.sshHost ?? ""}
										onChange={(e) => onPatch({ sshHost: e.target.value })}
										placeholder="bastion.example.com"
										className="h-9 bg-muted/30"
									/>
								</div>
								<div>
									<FormLabel>Port</FormLabel>
									<Input
										type="number"
										value={formData.sshPort ?? 22}
										onChange={(e) => onPatch({ sshPort: parseInt(e.target.value) || 22 })}
										className="h-9 bg-muted/30"
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
									className="h-9 bg-muted/30"
								/>
							</div>

							{/* Auth Method tabs */}
							<div>
								<FormLabel>Authentication</FormLabel>
								<div className="flex gap-1 mb-2">
									{(["password", "key"] as const).map((method) => {
										const isKeyAuth = !!(formData.sshKeyPath && formData.sshKeyPath.length > 0);
										const active = method === "key" ? isKeyAuth : !isKeyAuth;
										return (
											<button
												key={method}
												type="button"
												onClick={() => {
													if (method === "key") {
														onPatch({ sshKeyPath: formData.sshKeyPath || " ", sshPassword: undefined });
													} else {
														onPatch({ sshKeyPath: undefined, sshKeyPassphrase: undefined });
													}
												}}
												className={cn(
													"flex items-center gap-1.5 h-7 px-3 rounded-md border text-[11px] font-medium transition-all capitalize",
													active
														? "border-accent/40 bg-accent/10 text-accent-foreground"
														: "border-border/60 text-muted-foreground/60 hover:border-border bg-transparent",
												)}
											>
												{method === "password" ? <Key size={10} /> : <FileText size={10} />}
												{method === "password" ? "Password" : "Key File"}
											</button>
										);
									})}
								</div>

								{/* Password auth */}
								{!(formData.sshKeyPath && formData.sshKeyPath.trim().length > 0) && (
									<Input
										type="password"
										value={formData.sshPassword ?? ""}
										onChange={(e) => onPatch({ sshPassword: e.target.value })}
										placeholder="SSH password"
										className="h-9 bg-muted/30"
									/>
								)}

								{/* Key file auth */}
								{(formData.sshKeyPath && formData.sshKeyPath.trim().length > 0) && (
									<div className="space-y-2">
										<div className="relative">
											<Input
												value={formData.sshKeyPath.trim() === "" ? "" : formData.sshKeyPath}
												onChange={(e) => onPatch({ sshKeyPath: e.target.value })}
												placeholder="~/.ssh/id_rsa"
												className="h-9 bg-muted/30 pr-9"
											/>
											<button
												type="button"
												className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground"
												onClick={async () => {
													try {
														const { open } = await import("@tauri-apps/plugin-dialog");
														const path = await open({ multiple: false, directory: false });
														if (typeof path === "string") onPatch({ sshKeyPath: path });
													} catch {}
												}}
											>
												<FolderOpen size={13} />
											</button>
										</div>
										<Input
											type="password"
											value={formData.sshKeyPassphrase ?? ""}
											onChange={(e) => onPatch({ sshKeyPassphrase: e.target.value })}
											placeholder="Key passphrase (optional)"
											className="h-9 bg-muted/30"
										/>
									</div>
								)}
							</div>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
