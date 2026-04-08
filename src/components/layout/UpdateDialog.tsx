import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, Download, ExternalLink } from "lucide-react";

export interface UpdateInfo {
	available: boolean;
	version: string | null;
	current_version: string;
	body: string | null;
}

interface UpdateProgressPayload {
	chunkLength: number;
	contentLength: number | null;
}

interface UpdateDialogProps {
	open: boolean;
	updateInfo: UpdateInfo;
	onSkip: () => void;
}

export function UpdateDialog({ open, updateInfo, onSkip }: UpdateDialogProps) {
	const [phase, setPhase] = useState<"prompt" | "downloading" | "done">("prompt");
	const [progress, setProgress] = useState(0);
	const [downloaded, setDownloaded] = useState(0);
	const [totalBytes, setTotalBytes] = useState<number | null>(null);

	useEffect(() => {
		if (!open) {
			setPhase("prompt");
			setProgress(0);
			setDownloaded(0);
			setTotalBytes(null);
		}
	}, [open]);

	useEffect(() => {
		if (phase !== "downloading") return;

		const unlistenProgress = listen<UpdateProgressPayload>("update-progress", (event) => {
			const { chunkLength, contentLength } = event.payload;
			setDownloaded((prev) => {
				const next = prev + chunkLength;
				if (contentLength && contentLength > 0) {
					setTotalBytes(contentLength);
					setProgress(Math.round((next / contentLength) * 100));
				}
				return next;
			});
		});

		const unlistenFinished = listen("update-finished", () => {
			setProgress(100);
			setPhase("done");
		});

		return () => {
			unlistenProgress.then((fn) => fn());
			unlistenFinished.then((fn) => fn());
		};
	}, [phase]);

	const handleInstall = async () => {
		setPhase("downloading");
		try {
			await invoke("install_update");
		} catch (err) {
			console.error("Update install failed:", err);
			onSkip();
		}
	};

	const formatBytes = (bytes: number) => {
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	};

	const changelogUrl = `https://github.com/imrj05/db-connect/releases/tag/v${updateInfo.version}`;

	return (
		<AlertDialog open={open} onOpenChange={(o) => { if (!o && phase === "prompt") onSkip(); }}>
			<AlertDialogContent className="max-w-sm">
				<AlertDialogHeader>
					<AlertDialogTitle>
						{phase === "done" ? "Update Ready to Install" : "Update Available"}
					</AlertDialogTitle>
					<AlertDialogDescription asChild>
						<div className="flex flex-col gap-2 text-left">
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
										<p className="text-xs text-muted-foreground line-clamp-3">
											{updateInfo.body}
										</p>
									)}
									<a
										href={changelogUrl}
										target="_blank"
										rel="noopener noreferrer"
										className="inline-flex items-center gap-1 text-xs text-primary hover:underline w-fit"
										onClick={(e) => e.stopPropagation()}
									>
										<ExternalLink size={11} />
										View full changelog
									</a>
								</>
							)}
							{phase === "downloading" && (
								<div className="flex flex-col gap-2.5">
									<div className="flex items-center justify-between text-xs text-muted-foreground">
										<span>Downloading update…</span>
										<span>
											{totalBytes
												? `${formatBytes(downloaded)} / ${formatBytes(totalBytes)}`
												: `${formatBytes(downloaded)}`}
										</span>
									</div>
									<Progress value={progress} className="h-1.5" />
								</div>
							)}
							{phase === "done" && (
								<p className="text-xs text-muted-foreground">
									The update has been downloaded. DB Connect will restart to apply it.
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
					{phase === "downloading" && (
						<Button variant="outline" size="sm" disabled className="gap-2">
							<Loader2 size={12} className="animate-spin" />
							Installing…
						</Button>
					)}
					{phase === "done" && (
						<Button size="sm" onClick={handleInstall}>
							Restart Now
						</Button>
					)}
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
