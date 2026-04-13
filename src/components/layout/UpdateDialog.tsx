import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Download, ExternalLink } from "lucide-react";

export interface UpdateInfo {
	available: boolean;
	version: string | null;
	current_version: string;
	body: string | null;
}

interface UpdateDialogProps {
	open: boolean;
	updateInfo: UpdateInfo;
	onSkip: () => void;
}

export function UpdateDialog({ open, updateInfo, onSkip }: UpdateDialogProps) {
	const [phase, setPhase] = useState<"prompt" | "downloading" | "done">("prompt");

	useEffect(() => {
		if (!open) setPhase("prompt");
	}, [open]);

	// install_update downloads and installs synchronously — the app restarts on completion
	const handleInstall = async () => {
		setPhase("downloading");
		try {
			await invoke("install_update");
			setPhase("done");
		} catch (err) {
			console.error("Update install failed:", err);
			onSkip();
		}
	};

	const changelogUrl = `https://github.com/imrj05/db-connect/releases/tag/v${updateInfo.version}`;

	return (
		<AlertDialog open={open} onOpenChange={(o) => { if (!o && phase === "prompt") onSkip(); }}>
			<AlertDialogContent className="max-w-md">
				<AlertDialogHeader>
					<AlertDialogTitle>
						{phase === "done" ? "Restarting…" : "Update Available"}
					</AlertDialogTitle>
					<AlertDialogDescription asChild>
						<div className="flex flex-col gap-3 text-left">
							{phase === "prompt" && (
								<>
									<div className="flex items-center gap-2 text-xs">
										<span className="font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
											{updateInfo.current_version}
										</span>
										<span className="text-muted-foreground/50">→</span>
										<span className="font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold">
											{updateInfo.version}
										</span>
									</div>
									{updateInfo.body && (
										<div className="max-h-64 overflow-y-auto scrollbar-thin rounded-md bg-muted/50 p-3 border">
											<div className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed font-mono">
												{updateInfo.body}
											</div>
										</div>
									)}
									<a
										href={changelogUrl}
										target="_blank"
										rel="noopener noreferrer"
										className="inline-flex items-center gap-1 text-xs text-primary hover:underline w-fit"
										onClick={(e) => e.stopPropagation()}
									>
										<ExternalLink size={11} />
										View full changelog on GitHub
									</a>
								</>
							)}
							{phase === "downloading" && (
								<p className="text-xs text-muted-foreground">
									Downloading and installing update… DB Connect will restart automatically.
								</p>
							)}
							{phase === "done" && (
								<p className="text-xs text-muted-foreground">
									Update installed. Restarting now…
								</p>
							)}
						</div>
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					{phase === "prompt" && (
						<>
							<Button variant="outline" size="sm" onClick={onSkip}>
								Skip
							</Button>
							<Button size="sm" className="gap-2" onClick={handleInstall}>
								<Download size={12} />
								Update Now
							</Button>
						</>
					)}
					{(phase === "downloading" || phase === "done") && (
						<Button variant="outline" size="sm" disabled className="gap-2">
							<Loader2 size={12} className="animate-spin" />
							{phase === "done" ? "Restarting…" : "Installing…"}
						</Button>
					)}
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
