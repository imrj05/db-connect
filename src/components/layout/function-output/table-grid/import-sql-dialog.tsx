import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Database, File, Loader2, Upload, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { tauriApi, detectSqlDumpFormat, type ImportSqlResult } from "@/lib/tauri-api";

// ── Sub-components ────────────────────────────────────────────────────────────

function OptionRow({
    id,
    checked,
    onChange,
    label,
    description,
    disabled = false,
}: {
    id: string;
    checked: boolean;
    onChange: (v: boolean) => void;
    label: string;
    description: string;
    disabled?: boolean;
}) {
    return (
        <div
            className={cn(
                "flex items-center justify-between rounded-lg px-3 py-2.5 border border-border bg-muted/20 gap-3",
                disabled && "opacity-40",
            )}
        >
            <Label
                htmlFor={id}
                className={cn(
                    "flex flex-col gap-0.5 flex-1",
                    !disabled && "cursor-pointer",
                )}
            >
                <span className="text-[11px] font-semibold">{label}</span>
                <span className="text-[10px] text-muted-foreground font-normal leading-snug">
                    {description}
                </span>
            </Label>
            <Checkbox
                id={id}
                checked={checked}
                disabled={disabled}
                onCheckedChange={(v) => onChange(v === true)}
            />
        </div>
    );
}

function ModeButton({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "flex-1 rounded-lg px-3 py-2.5 border text-left transition-colors",
                active
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/40",
            )}
        >
            {children}
        </button>
    );
}

const FORMAT_LABELS: Record<string, string> = {
    phpmyadmin: "phpMyAdmin",
    pg_dump: "pg_dump",
    mysql_workbench: "MySQL Workbench",
    sqlite_cli: "SQLite CLI",
    generic: "Generic SQL",
};

// ── Props ─────────────────────────────────────────────────────────────────────

export type ImportSqlDialogProps = {
    open: boolean;
    connectionId: string;
    currentDatabase: string;
    dbType: string;
    onCancel: () => void;
    onSuccess: () => void;
};

// ── Dialog ────────────────────────────────────────────────────────────────────

type DialogStep = "file-select" | "configure" | "importing" | "done";

export function ImportSqlDialog({
    open,
    connectionId,
    currentDatabase,
    onCancel,
    onSuccess,
}: ImportSqlDialogProps) {
    const [step, setStep] = useState<DialogStep>("file-select");
    const [fileName, setFileName] = useState<string>("");
    const [sqlContent, setSqlContent] = useState<string>("");
    const [detectedFormat, setDetectedFormat] = useState<string>("generic");
    const [detectedDbName, setDetectedDbName] = useState<string | null>(null);
    const [importMode, setImportMode] = useState<"current" | "new">("current");
    const [newDbName, setNewDbName] = useState<string>("");
    const [dropExisting, setDropExisting] = useState(false);
    const [ignoreErrors, setIgnoreErrors] = useState(true);
    const [result, setResult] = useState<ImportSqlResult | null>(null);
    const [importError, setImportError] = useState<string | null>(null);
    const [fileError, setFileError] = useState<string | null>(null);
    const [fileLoading, setFileLoading] = useState(false);

    // Reset state when dialog opens
    useEffect(() => {
        if (open) {
            setStep("file-select");
            setFileName("");
            setSqlContent("");
            setDetectedFormat("generic");
            setDetectedDbName(null);
            setImportMode("current");
            setNewDbName("");
            setDropExisting(false);
            setIgnoreErrors(true);
            setResult(null);
            setImportError(null);
            setFileError(null);
            setFileLoading(false);
        }
    }, [open]);

    const pickFile = useCallback(async () => {
        setFileError(null);
        setFileLoading(true);
        try {
            const filePath = await tauriApi.openFileDialog([
                { name: "SQL Files", extensions: ["sql"] },
            ]);
            if (!filePath) return;
            const content = await tauriApi.readTextFile(filePath as string);
            const { detectedFormat: fmt, detectedDbName: dbName } = detectSqlDumpFormat(content);
            const name =
                (filePath as string).split(/[\\/]/).pop() ?? (filePath as string);
            setFileName(name);
            setSqlContent(content);
            setDetectedFormat(fmt);
            setDetectedDbName(dbName);
            setNewDbName(dbName ?? "");
            setStep("configure");
        } catch (e) {
            setFileError(String(e));
        } finally {
            setFileLoading(false);
        }
    }, []);

    const runImport = useCallback(async () => {
        setStep("importing");
        setImportError(null);
        try {
            const targetDb =
                importMode === "new" ? (newDbName.trim() || null) : null;
            const res = await tauriApi.importSqlFile(
                connectionId,
                sqlContent,
                targetDb,
                dropExisting,
                ignoreErrors,
            );
            setResult(res);
        } catch (e) {
            setImportError(String(e));
        } finally {
            setStep("done");
        }
    }, [connectionId, sqlContent, importMode, newDbName, dropExisting, ignoreErrors]);

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                if (!o && step !== "importing") onCancel();
            }}
        >
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Database size={14} />
                        Import SQL File
                        {currentDatabase && (
                            <Badge
                                variant="secondary"
                                className="font-mono text-[10px] px-1.5 py-0"
                            >
                                {currentDatabase}
                            </Badge>
                        )}
                    </DialogTitle>
                    <DialogDescription>
                        Import a SQL dump into the current database. Supports
                        phpMyAdmin, pg_dump, MySQL Workbench, and SQLite CLI
                        formats.
                    </DialogDescription>
                </DialogHeader>

                {/* ── Step: file-select ──────────────────────────────────── */}
                {step === "file-select" && (
                    <>
                        <div className="flex flex-col items-center justify-center gap-3 py-6 rounded-lg border border-dashed border-border bg-muted/10">
                            <Upload
                                size={28}
                                className="text-muted-foreground/40"
                            />
                            <p className="text-[11px] text-muted-foreground text-center">
                                Choose a .sql file to import
                            </p>
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={pickFile}
                                disabled={fileLoading}
                            >
                                {fileLoading ? (
                                    <>
                                        <Loader2
                                            size={12}
                                            className="animate-spin mr-1.5"
                                        />
                                        Reading…
                                    </>
                                ) : (
                                    "Browse…"
                                )}
                            </Button>
                            {fileError && (
                                <p className="text-[10px] text-destructive text-center max-w-xs">
                                    {fileError}
                                </p>
                            )}
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={onCancel}>
                                Cancel
                            </Button>
                        </DialogFooter>
                    </>
                )}

                {/* ── Step: configure ────────────────────────────────────── */}
                {step === "configure" && (
                    <>
                        <div className="flex flex-col gap-3 py-1">
                            {/* File info */}
                            <div className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 border border-border bg-muted/20">
                                <div className="flex items-center gap-2 min-w-0">
                                    <File
                                        size={12}
                                        className="shrink-0 text-muted-foreground"
                                    />
                                    <span className="text-[11px] font-mono truncate">
                                        {fileName}
                                    </span>
                                    <Badge
                                        variant="outline"
                                        className="text-[9px] px-1.5 py-0 shrink-0 font-normal"
                                    >
                                        {FORMAT_LABELS[detectedFormat] ??
                                            detectedFormat}
                                    </Badge>
                                </div>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 px-2 text-[10px] shrink-0"
                                    onClick={() => setStep("file-select")}
                                >
                                    Change
                                </Button>
                            </div>

                            {/* Import mode */}
                            <div className="flex flex-col gap-1.5">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                    Import Into
                                </Label>
                                <div className="flex gap-2">
                                    <ModeButton
                                        active={importMode === "current"}
                                        onClick={() => setImportMode("current")}
                                    >
                                        <span className="text-[11px] font-semibold block">
                                            Current database
                                        </span>
                                        <span className="text-[10px] font-mono opacity-70">
                                            {currentDatabase || "(none selected)"}
                                        </span>
                                    </ModeButton>
                                    <ModeButton
                                        active={importMode === "new"}
                                        onClick={() => setImportMode("new")}
                                    >
                                        <span className="text-[11px] font-semibold block">
                                            New database
                                        </span>
                                        <span className="text-[10px] opacity-70">
                                            Create from dump
                                        </span>
                                    </ModeButton>
                                </div>
                                {importMode === "new" && (
                                    <Input
                                        value={newDbName}
                                        onChange={(e) =>
                                            setNewDbName(e.target.value)
                                        }
                                        placeholder={
                                            detectedDbName ?? "database name"
                                        }
                                        className="font-mono text-[12px] h-8 mt-1"
                                    />
                                )}
                            </div>

                            {/* Options */}
                            <div className="flex flex-col gap-1.5">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                    Options
                                </Label>
                                <div className="flex flex-col gap-1.5">
                                    <OptionRow
                                        id="import-drop-existing"
                                        checked={dropExisting}
                                        onChange={setDropExisting}
                                        label="Drop existing tables"
                                        description="Prepend DROP TABLE IF EXISTS before each CREATE TABLE"
                                    />
                                    <OptionRow
                                        id="import-ignore-errors"
                                        checked={ignoreErrors}
                                        onChange={setIgnoreErrors}
                                        label="Ignore statement errors"
                                        description="Continue importing even if individual statements fail"
                                    />
                                </div>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => setStep("file-select")}
                            >
                                Back
                            </Button>
                            <Button onClick={runImport}>Import</Button>
                        </DialogFooter>
                    </>
                )}

                {/* ── Step: importing ────────────────────────────────────── */}
                {step === "importing" && (
                    <div className="flex flex-col items-center justify-center gap-3 py-8">
                        <Loader2
                            size={28}
                            className="animate-spin text-muted-foreground"
                        />
                        <p className="text-[12px] text-muted-foreground">
                            Importing…
                        </p>
                        <p className="text-[10px] text-muted-foreground/60">
                            Please wait, this may take a moment for large dumps.
                        </p>
                    </div>
                )}

                {/* ── Step: done ─────────────────────────────────────────── */}
                {step === "done" && (
                    <>
                        <div className="flex flex-col gap-3 py-1">
                            {importError ? (
                                <div className="flex items-start gap-2 rounded-lg px-3 py-2.5 border border-destructive/30 bg-destructive/5">
                                    <XCircle
                                        size={14}
                                        className="shrink-0 text-destructive mt-0.5"
                                    />
                                    <div className="flex flex-col gap-0.5 min-w-0">
                                        <p className="text-[11px] font-semibold text-destructive">
                                            Import failed
                                        </p>
                                        <p className="text-[10px] text-destructive/80 break-words">
                                            {importError}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-start gap-2 rounded-lg px-3 py-2.5 border border-border bg-muted/20">
                                    <CheckCircle2
                                        size={14}
                                        className="shrink-0 text-green-500 mt-0.5"
                                    />
                                    <div className="flex flex-col gap-0.5">
                                        <p className="text-[11px] font-semibold">
                                            Import complete
                                        </p>
                                        <p className="text-[10px] text-muted-foreground">
                                            {result?.executed ?? 0} statements
                                            executed,{" "}
                                            {result?.skipped ?? 0} skipped
                                        </p>
                                    </div>
                                </div>
                            )}

                            {result && result.errors.length > 0 && (
                                <details className="rounded-lg border border-border overflow-hidden">
                                    <summary className="px-3 py-2 text-[11px] text-muted-foreground cursor-pointer hover:bg-muted/20 select-none">
                                        {result.errors.length} error
                                        {result.errors.length !== 1 ? "s" : ""}{" "}
                                        — click to expand
                                    </summary>
                                    <div className="max-h-40 overflow-y-auto px-3 py-2 flex flex-col gap-1.5 bg-muted/10">
                                        {result.errors.map((e, i) => (
                                            <p
                                                key={i}
                                                className="text-[10px] font-mono text-destructive/80 whitespace-pre-wrap break-all"
                                            >
                                                {e}
                                            </p>
                                        ))}
                                    </div>
                                </details>
                            )}
                        </div>

                        <DialogFooter>
                            <Button onClick={onSuccess}>Done</Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
