import { Eye, EyeOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ConnectionConfig } from "@/types";

function FormLabel({
	children,
	required,
}: {
	children: React.ReactNode;
	required?: boolean;
}) {
	return (
		<Label className="mb-1 block text-[10px] font-label font-bold uppercase tracking-[0.1em] text-muted-foreground/70">
			{children}
			{required && <span className="text-destructive ml-0.5">*</span>}
		</Label>
	);
}

export function EngineFields({
	formData,
	showPassword,
	onTogglePassword,
	onPatch,
}: {
	formData: Partial<ConnectionConfig>;
	showPassword: boolean;
	onTogglePassword: () => void;
	onPatch: (partial: Partial<ConnectionConfig>) => void;
}) {
	const isSshTunnelEnabled = !!formData.sshEnabled;

	return (
		<AnimatePresence mode="wait">
			<motion.div
				key={formData.type}
				initial={{ opacity: 0, y: 6 }}
				animate={{ opacity: 1, y: 0 }}
				exit={{ opacity: 0, y: -6 }}
				transition={{ duration: 0.15 }}
				className="flex flex-col gap-3"
			>
				{formData.type === "mongodb" ? (
					<div>
						<FormLabel>
							Connection URI
						</FormLabel>
						<Input
							value={formData.uri || ""}
							onChange={(e) => onPatch({ uri: e.target.value })}
							placeholder="mongodb+srv://user:pass@cluster0.example.net/db"
							className="h-9 border-border-subtle bg-surface-elevated font-mono text-xs"
							name="db-uri"
							autoComplete="off"
						/>
					</div>
				) : formData.type === "sqlite" ? (
					<div>
						<FormLabel>
							Database File Path
						</FormLabel>
						<div className="flex gap-2">
							<Input
								value={formData.database || ""}
								onChange={(e) => onPatch({ database: e.target.value })}
								placeholder="/path/to/database.sqlite"
								className="h-9 flex-1 border-border-subtle bg-surface-elevated font-mono text-xs"
								name="db-file"
								autoComplete="off"
							/>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="h-9 shrink-0 px-3 text-[10px] font-bold uppercase"
								onClick={async () => {
									try {
										const { open } = await import("@tauri-apps/plugin-dialog");
										const path = await open({ multiple: false, directory: false });
										if (typeof path === "string") onPatch({ database: path });
									} catch {}
								}}
							>
								Browse
							</Button>
						</div>
					</div>
				) : (
					<div className="flex flex-col gap-3">
						{/* Host + Port */}
						<div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_108px]">
							<div>
								<FormLabel>{isSshTunnelEnabled ? "Database Host from SSH Server" : "Host"}</FormLabel>
								<Input
									value={formData.host || ""}
									onChange={(e) => onPatch({ host: e.target.value })}
									placeholder={isSshTunnelEnabled ? "127.0.0.1 or private-db.internal" : "localhost"}
									className="h-9 border-border-subtle bg-surface-elevated font-mono text-xs"
									name="db-host"
									autoComplete="off"
								/>
								{isSshTunnelEnabled && (
									<p className="mt-1 text-[10px] leading-snug text-muted-foreground/58">
										This host must be reachable from the SSH server, not from your laptop.
									</p>
								)}
							</div>
							<div>
								<FormLabel>Port</FormLabel>
								<Input
									type="number"
									value={formData.port || ""}
									onChange={(e) => onPatch({ port: parseInt(e.target.value) || 0 })}
									placeholder="5432"
									className="h-9 border-border-subtle bg-surface-elevated font-mono text-xs"
									name="db-port"
									autoComplete="off"
								/>
							</div>
						</div>

						{/* User + Password */}
						<div className="grid gap-3 md:grid-cols-2">
							<div>
								<FormLabel>{formData.type === "redis" ? "Username (optional)" : "Username"}</FormLabel>
								<Input
									value={formData.user || ""}
									onChange={(e) => onPatch({ user: e.target.value })}
									placeholder={formData.type === "redis" ? "default" : "database_user"}
									className="h-9 border-border-subtle bg-surface-elevated font-mono text-xs"
									name="db-username"
									autoComplete="username"
								/>
							</div>
							<div>
								<FormLabel>{formData.type === "redis" ? "Password (optional)" : "Password"}</FormLabel>
								<div className="relative">
									<Input
										type={showPassword ? "text" : "password"}
										value={formData.password || ""}
										onChange={(e) => onPatch({ password: e.target.value })}
										placeholder="••••••••"
										className="h-9 border-border-subtle bg-surface-elevated pr-8 font-mono text-xs"
										name="db-password"
										autoComplete="current-password"
									/>
									<Button
										type="button"
										variant="ghost"
										size="icon-xs"
										onClick={onTogglePassword}
									className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground/40 hover:text-muted-foreground"
								>
										{showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
									</Button>
								</div>
							</div>
						</div>

						{/* Default database */}
						<div>
							<FormLabel>{formData.type === "redis" ? "DB Index" : "Database Name"}</FormLabel>
							<Input
								value={formData.database || ""}
								onChange={(e) => onPatch({ database: e.target.value })}
								placeholder={formData.type === "redis" ? "0" : "e.g. postgres"}
								className="h-9 border-border-subtle bg-surface-elevated font-mono text-xs"
								name="db-database"
								autoComplete="off"
							/>
						</div>
					</div>
				)}
			</motion.div>
		</AnimatePresence>
	);
}
