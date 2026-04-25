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
		<Label className="mb-2 block text-[11px] font-label font-bold uppercase tracking-[0.12em] text-muted-foreground/72">
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
	return (
		<AnimatePresence mode="wait">
			<motion.div
				key={formData.type}
				initial={{ opacity: 0, y: 6 }}
				animate={{ opacity: 1, y: 0 }}
				exit={{ opacity: 0, y: -6 }}
				transition={{ duration: 0.15 }}
				className="space-y-4"
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
className="h-12 border-border-subtle bg-background font-mono text-sm"
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
							className="h-12 flex-1 border-border-subtle bg-background font-mono text-sm"
							name="db-file"
								autoComplete="off"
							/>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="h-12 shrink-0 rounded-sm px-4 text-[10px] font-bold uppercase tracking-widest"
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
					<div className="space-y-5">
						{/* Host + Port */}
						<div className="grid grid-cols-3 gap-4">
							<div className="col-span-2">
								<FormLabel>Host</FormLabel>
								<Input
									value={formData.host || ""}
									onChange={(e) => onPatch({ host: e.target.value })}
									placeholder="localhost"
							className="h-12 border-border-subtle bg-background font-mono text-sm"
							name="db-host"
									autoComplete="off"
								/>
							</div>
							<div>
								<FormLabel>Port</FormLabel>
								<Input
									type="number"
									value={formData.port || ""}
									onChange={(e) => onPatch({ port: parseInt(e.target.value) || 0 })}
									placeholder="5432"
							className="h-12 border-border-subtle bg-background font-mono text-sm"
							name="db-port"
									autoComplete="off"
								/>
							</div>
						</div>

						{/* User + Password */}
						{formData.type !== "redis" && (
							<div className="grid grid-cols-2 gap-4">
								<div>
									<FormLabel>Username</FormLabel>
									<Input
										value={formData.user || ""}
										onChange={(e) => onPatch({ user: e.target.value })}
										placeholder="database_user"
									className="h-12 border-border-subtle bg-background font-mono text-sm"
									name="db-username"
										autoComplete="username"
									/>
								</div>
								<div>
									<FormLabel>Password</FormLabel>
									<div className="relative">
										<Input
											type={showPassword ? "text" : "password"}
										value={formData.password || ""}
										onChange={(e) => onPatch({ password: e.target.value })}
										placeholder="••••••••"
									className="h-12 border-border-subtle bg-background pr-9 font-mono text-sm"
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
						)}

						{/* Default database */}
						{formData.type !== "redis" && (
							<div>
								<FormLabel>Database Name</FormLabel>
								<Input
									value={formData.database || ""}
									onChange={(e) => onPatch({ database: e.target.value })}
									placeholder="e.g. postgres"
								className="h-12 border-border-subtle bg-background font-mono text-sm"
								name="db-database"
									autoComplete="off"
								/>
							</div>
						)}
					</div>
				)}
			</motion.div>
		</AnimatePresence>
	);
}
