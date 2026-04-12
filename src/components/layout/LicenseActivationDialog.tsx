import { useState, useEffect } from "react";
import { KeyRound, Loader2, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@/components/ui/dialog";
import { activateLicenseOnline, licenseGetDeviceId, licenseGetDeviceName } from "@/lib/license";
import type { OfflineCheckResult } from "@/lib/license";

const DEFAULT_SERVER_URL = "https://db-connect.rajeshwarkashyap.in";

const REASON_LABELS: Record<string, string> = {
	missing_license: "No license found on this device.",
	not_activated: "This device has not been activated.",
	device_mismatch: "License is bound to a different device.",
	expired: "Your license has expired.",
	invalid_signature: "License file is invalid or tampered.",
	corrupt_license: "License file is corrupt or unreadable.",
};

function reasonLabel(reason?: string): string {
	if (!reason) return "License verification failed.";
	for (const [key, label] of Object.entries(REASON_LABELS)) {
		if (reason.startsWith(key)) return label;
	}
	return reason;
}

interface Props {
	open: boolean;
	reason?: string;
	onActivated: (result: OfflineCheckResult) => void;
	onClose: () => void;
}

export function LicenseActivationDialog({ open, reason, onActivated, onClose }: Props) {
	const [licenseKey, setLicenseKey] = useState("");
	const [deviceName, setDeviceName] = useState("");
	const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);
	const [showAdvanced, setShowAdvanced] = useState(false);
	const [phase, setPhase] = useState<"idle" | "loading" | "success" | "error">("idle");
	const [errorMsg, setErrorMsg] = useState("");
	const [deviceId, setDeviceId] = useState("");

	useEffect(() => {
		if (!open) {
			// Reset form when dialog closes (unless success)
			if (phase !== "success") {
				setPhase("idle");
				setErrorMsg("");
			}
			return;
		}
		licenseGetDeviceName().then(setDeviceName).catch(() => setDeviceName("My Device"));
		licenseGetDeviceId().then(setDeviceId).catch(() => {});
	}, [open]);

	const handleActivate = async () => {
		const key = licenseKey.trim().toUpperCase();
		if (!key) {
			setErrorMsg("Please enter your license key.");
			setPhase("error");
			return;
		}
		if (!deviceName.trim()) {
			setErrorMsg("Please enter a device name.");
			setPhase("error");
			return;
		}
		setPhase("loading");
		setErrorMsg("");
		try {
			const result = await activateLicenseOnline({
				licenseKey: key,
				deviceName: deviceName.trim(),
				serverUrl: serverUrl.trim().replace(/\/$/, ""),
			});
			if (result.ok) {
				setPhase("success");
				setTimeout(() => onActivated(result), 700);
			} else {
				setPhase("error");
				setErrorMsg(reasonLabel(result.reason));
			}
		} catch (err) {
			setPhase("error");
			setErrorMsg(err instanceof Error ? err.message : "Activation failed. Please try again.");
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && phase !== "loading") handleActivate();
	};

	return (
		<Dialog open={open} onOpenChange={(o) => { if (!o && phase !== "loading") onClose(); }}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<div className="flex items-center gap-3">
						<div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 shrink-0">
							<KeyRound size={17} className="text-primary" />
						</div>
						<div>
							<DialogTitle>Activate DB Connect</DialogTitle>
							<DialogDescription className="mt-0.5">
								Enter your license key to unlock all features.
							</DialogDescription>
						</div>
					</div>
				</DialogHeader>

				{/* Reason banner — shown when user opens from the title bar badge */}
				{reason && reason !== "missing_license" && (
					<div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs">
						<AlertCircle size={13} className="shrink-0" />
						<span>{reasonLabel(reason)}</span>
					</div>
				)}

				{phase === "success" ? (
					<div className="flex flex-col items-center gap-3 py-6 text-center">
						<CheckCircle2 size={36} className="text-green-500" />
						<p className="text-sm font-medium">License activated!</p>
						<p className="text-xs text-muted-foreground">DB Connect is now unlocked.</p>
					</div>
				) : (
					<div className="flex flex-col gap-4">
						{/* License key */}
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="license-key" className="text-xs font-medium">License Key</Label>
							<Input
								id="license-key"
								placeholder="DBK-XXXX-XXXX-XXXX-XXXX"
								value={licenseKey}
								onChange={(e) => {
									setLicenseKey(e.target.value);
									if (phase === "error") setPhase("idle");
								}}
								onKeyDown={handleKeyDown}
								disabled={phase === "loading"}
								className="font-mono text-sm tracking-wider"
								autoFocus
								spellCheck={false}
							/>
						</div>

						{/* Device name */}
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="device-name" className="text-xs font-medium">Device Name</Label>
							<Input
								id="device-name"
								placeholder="My MacBook Pro"
								value={deviceName}
								onChange={(e) => setDeviceName(e.target.value)}
								onKeyDown={handleKeyDown}
								disabled={phase === "loading"}
								className="text-sm"
							/>
							{deviceId && (
								<p className="text-[10px] text-muted-foreground font-mono">
									Device ID: {deviceId.slice(0, 8)}…
								</p>
							)}
						</div>

						{/* Error */}
						{phase === "error" && errorMsg && (
							<div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
								<AlertCircle size={13} className="shrink-0 mt-0.5" />
								<span>{errorMsg}</span>
							</div>
						)}

						{/* Activate */}
						<Button className="w-full gap-2" onClick={handleActivate} disabled={phase === "loading"}>
							{phase === "loading" ? (
								<><Loader2 size={13} className="animate-spin" /> Activating…</>
							) : (
								<><KeyRound size={13} /> Activate License</>
							)}
						</Button>

						{/* Advanced */}
						<div className="border-t border-border pt-3">
							<button
								type="button"
								onClick={() => setShowAdvanced((v) => !v)}
								className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
							>
								{showAdvanced ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
								Advanced settings
							</button>
							{showAdvanced && (
								<div className="mt-3 flex flex-col gap-1.5">
									<Label htmlFor="server-url" className="text-xs font-medium">License Server URL</Label>
									<Input
										id="server-url"
										placeholder="https://your-server.com"
										value={serverUrl}
										onChange={(e) => setServerUrl(e.target.value)}
										disabled={phase === "loading"}
										className="text-xs font-mono"
										spellCheck={false}
									/>
								</div>
							)}
						</div>

						<p className="text-center text-xs text-muted-foreground">
							Don&apos;t have a license?{" "}
							<a
								href="https://db-connect.rajeshwarkashyap.in/pricing"
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-0.5 text-primary hover:underline"
							>
								Purchase one <ExternalLink size={10} className="ml-0.5" />
							</a>
						</p>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
