import { useState } from "react";
import {
    ArrowUpDown,
    Upload,
    Download,
    FileJson,
    FileText,
    Lock,
    Eye,
    EyeOff,
    Loader2,
    ChevronLeft,
    AlertTriangle,
    CheckCircle2,
    X,
} from "lucide-react";
import { ConnectionConfig, ConflictStrategy, ExportFormat, ImportFormat, ImportResult } from "@/types";
import { useAppStore } from "@/store/useAppStore";
import { tauriApi } from "@/lib/tauri-api";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ImportExportDialogProps {
    onClose: () => void;
    onImportComplete: (connections: ConnectionConfig[]) => void;
}

type View = "main" | "export" | "import";

export function ImportExportDialog({ onClose, onImportComplete }: ImportExportDialogProps) {
    const { connections } = useAppStore();

    const [view, setView] = useState<View>("main");

    // ── Export state ──────────────────────────────────────────────────────────
    const [exportFormat, setExportFormat] = useState<ExportFormat>("json");
    const [includePasswords, setIncludePasswords] = useState(false);
    const [exportPassphrase, setExportPassphrase] = useState("");
    const [showExportPass, setShowExportPass] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isExporting, setIsExporting] = useState(false);

    // ── Import state ──────────────────────────────────────────────────────────
    const [importFormat, setImportFormat] = useState<ImportFormat>("json");
    const [conflictStrategy, setConflictStrategy] = useState<ConflictStrategy>("skip");
    const [importPassphrase, setImportPassphrase] = useState("");
    const [showImportPass, setShowImportPass] = useState(false);
    const [requiresPassphrase, setRequiresPassphrase] = useState(false);
    const [pendingContent, setPendingContent] = useState<string | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [importResult, setImportResult] = useState<ImportResult | null>(null);

    // ── Export logic ──────────────────────────────────────────────────────────

    const handleExport = async () => {
        if (includePasswords && !exportPassphrase) {
            toast.error("Enter a passphrase to protect passwords");
            return;
        }
        setIsExporting(true);
        try {
            const content = await tauriApi.exportConnections({
                format: exportFormat,
                includePasswords,
                passphrase: includePasswords ? exportPassphrase : undefined,
                connectionIds: selectedIds.length > 0 ? selectedIds : undefined,
            });

            if (exportFormat === "uri" && includePasswords) {
                toast.warning("URI file contains plaintext passwords — keep it secure");
            }

            const ext = exportFormat === "json" ? "json" : "txt";
            const date = new Date().toISOString().slice(0, 10);
            const savePath = await tauriApi.saveFileDialog(
                `db-connect-export-${date}.${ext}`,
                exportFormat === "json"
                    ? [{ name: "JSON", extensions: ["json"] }]
                    : [{ name: "Text", extensions: ["txt", "env"] }]
            );
            if (!savePath) return;

            await tauriApi.writeTextFile(savePath, content);
            const count = selectedIds.length > 0 ? selectedIds.length : connections.length;
            toast.success(`Exported ${count} connection${count !== 1 ? "s" : ""}`);
            onClose();
        } catch (err) {
            toast.error(`Export failed: ${String(err)}`);
        } finally {
            setIsExporting(false);
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === connections.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(connections.map((c) => c.id));
        }
    };

    const toggleSelectId = (id: string) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    // ── Import logic ──────────────────────────────────────────────────────────

    const handlePickFile = async () => {
        const filters: Array<{ name: string; extensions: string[] }> =
            importFormat === "dbeaver"
                ? [{ name: "DBeaver JSON", extensions: ["json"] }]
                : importFormat === "json"
                ? [{ name: "JSON", extensions: ["json"] }]
                : [{ name: "Text", extensions: ["txt", "env"] }];

        try {
            const filePath = await tauriApi.openFileDialog(filters);
            if (!filePath) return;

            const content = await tauriApi.readTextFile(filePath);

            if (importFormat === "json") {
                const isProtected = await tauriApi.checkExportProtected(content);
                if (isProtected) {
                    setPendingContent(content);
                    setRequiresPassphrase(true);
                    return;
                }
            }

            await executeImport(content);
        } catch (err) {
            toast.error(`Could not read file: ${String(err)}`);
        }
    };

    const executeImport = async (content: string) => {
        setIsImporting(true);
        try {
            const result = await tauriApi.importConnections(content, {
                format: importFormat,
                passphrase: requiresPassphrase ? importPassphrase : undefined,
                conflictStrategy,
            });

            setImportResult(result);
            setPendingContent(null);
            setRequiresPassphrase(false);
            setImportPassphrase("");

            if (result.imported > 0) {
                onImportComplete(result.connections);
                toast.success(`Imported ${result.imported} connection${result.imported !== 1 ? "s" : ""}`);
                if (result.skipped > 0) {
                    toast.info(`Skipped ${result.skipped} (already exist)`);
                }
            } else if (result.skipped > 0) {
                toast.info(`All ${result.skipped} connection${result.skipped !== 1 ? "s" : ""} already exist — nothing imported`);
            }

            // Surface non-password DBeaver warnings as single grouped toast
            const warnings = result.errors.filter((e) => e.startsWith("Password for"));
            const others = result.errors.filter((e) => !e.startsWith("Password for"));
            if (warnings.length > 0) {
                toast.warning(`${warnings.length} password${warnings.length !== 1 ? "s" : ""} not imported (DBeaver encryption)`);
            }
            others.forEach((e) => toast.warning(e));
        } catch (err) {
            toast.error(`Import failed: ${String(err)}`);
        } finally {
            setIsImporting(false);
        }
    };

    // ── Render helpers ────────────────────────────────────────────────────────

    const FormatToggle = ({
        options,
        value,
        onChange,
    }: {
        options: Array<{ value: string; label: string; icon: React.ReactNode }>;
        value: string;
        onChange: (v: string) => void;
    }) => (
        <div className="flex rounded-lg overflow-hidden border border-border/50 bg-muted/30">
            {options.map((opt) => (
                <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange(opt.value)}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-medium transition-colors",
                        value === opt.value
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    {opt.icon}
                    {opt.label}
                </button>
            ))}
        </div>
    );

    // ── Main view ─────────────────────────────────────────────────────────────

    const MainView = () => (
        <div className="flex flex-col gap-3 py-2">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
                Export your connections to share or back up. Import from this app's JSON,
                connection URI strings, or a DBeaver export.
            </p>
            <div className="grid grid-cols-2 gap-3 mt-1">
                <button
                    type="button"
                    onClick={() => setView("export")}
                    className="flex flex-col items-center gap-3 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/40 p-5 transition-colors group"
                >
                    <Upload size={22} className="text-muted-foreground group-hover:text-foreground transition-colors" />
                    <div className="text-center">
                        <div className="text-[12px] font-semibold">Export</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">Save to JSON or URI</div>
                    </div>
                </button>
                <button
                    type="button"
                    onClick={() => setView("import")}
                    className="flex flex-col items-center gap-3 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/40 p-5 transition-colors group"
                >
                    <Download size={22} className="text-muted-foreground group-hover:text-foreground transition-colors" />
                    <div className="text-center">
                        <div className="text-[12px] font-semibold">Import</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">JSON, URI, or DBeaver</div>
                    </div>
                </button>
            </div>
        </div>
    );

    // ── Export view ───────────────────────────────────────────────────────────

    const ExportView = () => (
        <div className="flex flex-col gap-4">
            {/* Format */}
            <div className="space-y-2">
                <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
                    Format
                </span>
                <FormatToggle
                    value={exportFormat}
                    onChange={(v) => setExportFormat(v as ExportFormat)}
                    options={[
                        { value: "json", label: "JSON", icon: <FileJson size={12} /> },
                        { value: "uri", label: "URI / .env", icon: <FileText size={12} /> },
                    ]}
                />
                {exportFormat === "uri" && (
                    <p className="text-[10px] text-muted-foreground">
                        One <code className="font-mono text-[9px] bg-muted px-1 rounded">DATABASE_URL</code> per connection.
                        Compatible with Prisma, Rails, .env files.
                    </p>
                )}
            </div>

            {/* Passwords */}
            <div className="space-y-2">
                <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
                    Passwords
                </span>
                <label className="flex items-center gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={includePasswords}
                        onChange={(e) => setIncludePasswords(e.target.checked)}
                        className="rounded"
                    />
                    <span className="text-[11px]">Include passwords in export</span>
                </label>
                {includePasswords && exportFormat === "json" && (
                    <div className="relative">
                        <Lock size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                        <Input
                            type={showExportPass ? "text" : "password"}
                            value={exportPassphrase}
                            onChange={(e) => setExportPassphrase(e.target.value)}
                            placeholder="Passphrase to protect passwords"
                            className="h-8 pl-8 pr-8 bg-muted/30 text-[11px]"
                        />
                        <button
                            type="button"
                            onClick={() => setShowExportPass((p) => !p)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground"
                        >
                            {showExportPass ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                    </div>
                )}
                {includePasswords && exportFormat === "uri" && (
                    <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
                        <AlertTriangle size={12} className="text-amber-500 shrink-0" />
                        <span className="text-[10px] text-amber-600 dark:text-amber-400">
                            Passwords will be stored as plaintext in the URI file.
                        </span>
                    </div>
                )}
            </div>

            {/* Connection selector */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
                        Connections ({selectedIds.length === 0 ? "all" : `${selectedIds.length} selected`})
                    </span>
                    <button
                        type="button"
                        onClick={toggleSelectAll}
                        className="text-[9px] text-muted-foreground hover:text-foreground"
                    >
                        {selectedIds.length === connections.length && connections.length > 0
                            ? "Deselect all"
                            : "Select all"}
                    </button>
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1 rounded-lg border border-border/40 p-1.5 bg-muted/10">
                    {connections.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground text-center py-2">No connections saved</p>
                    ) : (
                        connections.map((c) => (
                            <label key={c.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded cursor-pointer hover:bg-muted/30">
                                <input
                                    type="checkbox"
                                    checked={selectedIds.length === 0 || selectedIds.includes(c.id)}
                                    onChange={() => {
                                        if (selectedIds.length === 0) {
                                            // "all" selected — deselect this one
                                            setSelectedIds(connections.filter((x) => x.id !== c.id).map((x) => x.id));
                                        } else {
                                            toggleSelectId(c.id);
                                        }
                                    }}
                                    className="rounded"
                                />
                                <span className="text-[11px] truncate">{c.name}</span>
                                <span className="ml-auto text-[9px] text-muted-foreground/50 shrink-0">{c.type}</span>
                            </label>
                        ))
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="flex gap-2 pt-1">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setView("main")}
                    className="text-[11px]"
                >
                    <ChevronLeft size={12} className="mr-1" />
                    Back
                </Button>
                <Button
                    size="sm"
                    onClick={handleExport}
                    disabled={isExporting || connections.length === 0}
                    className="ml-auto text-[11px]"
                >
                    {isExporting ? <Loader2 size={12} className="mr-1.5 animate-spin" /> : <Upload size={12} className="mr-1.5" />}
                    Export
                </Button>
            </div>
        </div>
    );

    // ── Import view ───────────────────────────────────────────────────────────

    const ImportView = () => (
        <div className="flex flex-col gap-4">
            {/* Format */}
            <div className="space-y-2">
                <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
                    Source format
                </span>
                <FormatToggle
                    value={importFormat}
                    onChange={(v) => {
                        setImportFormat(v as ImportFormat);
                        setRequiresPassphrase(false);
                        setPendingContent(null);
                        setImportResult(null);
                    }}
                    options={[
                        { value: "json", label: "db-connect", icon: <FileJson size={12} /> },
                        { value: "uri", label: "URI text", icon: <FileText size={12} /> },
                        { value: "dbeaver", label: "DBeaver", icon: <FileJson size={12} /> },
                    ]}
                />
                {importFormat === "dbeaver" && (
                    <p className="text-[10px] text-muted-foreground">
                        Import from DBeaver's <code className="font-mono text-[9px] bg-muted px-1 rounded">data-sources.json</code>.
                        Passwords are not imported (DBeaver uses proprietary encryption).
                    </p>
                )}
            </div>

            {/* Conflict strategy */}
            <div className="space-y-2">
                <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
                    If connection already exists
                </span>
                <div className="flex rounded-lg overflow-hidden border border-border/50 bg-muted/30">
                    {(["skip", "overwrite", "rename"] as ConflictStrategy[]).map((s) => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => setConflictStrategy(s)}
                            className={cn(
                                "flex-1 py-2 text-[11px] font-medium transition-colors capitalize",
                                conflictStrategy === s
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            {/* Passphrase (shown after reading a protected file) */}
            {requiresPassphrase && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2 rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-2">
                        <Lock size={12} className="text-blue-500 shrink-0" />
                        <span className="text-[10px] text-blue-600 dark:text-blue-400">
                            This export is password-protected. Enter the passphrase to decrypt.
                        </span>
                    </div>
                    <div className="relative">
                        <Input
                            type={showImportPass ? "text" : "password"}
                            value={importPassphrase}
                            onChange={(e) => setImportPassphrase(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && pendingContent) {
                                    executeImport(pendingContent);
                                }
                            }}
                            placeholder="Passphrase"
                            className="h-8 pr-8 bg-muted/30 text-[11px]"
                            autoFocus
                        />
                        <button
                            type="button"
                            onClick={() => setShowImportPass((p) => !p)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground"
                        >
                            {showImportPass ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                    </div>
                </div>
            )}

            {/* Import result summary */}
            {importResult && (
                <div className="rounded-lg border border-border/40 bg-muted/10 p-3 space-y-1">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 size={12} className="text-green-500" />
                        <span className="text-[11px] font-medium">
                            {importResult.imported} imported
                            {importResult.skipped > 0 && `, ${importResult.skipped} skipped`}
                        </span>
                    </div>
                    {importResult.errors.filter((e) => !e.startsWith("Password for")).map((e, i) => (
                        <div key={i} className="flex items-start gap-2">
                            <AlertTriangle size={11} className="text-amber-500 mt-0.5 shrink-0" />
                            <span className="text-[10px] text-muted-foreground">{e}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Footer */}
            <div className="flex gap-2 pt-1">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                        setView("main");
                        setImportResult(null);
                        setRequiresPassphrase(false);
                        setPendingContent(null);
                    }}
                    className="text-[11px]"
                >
                    <ChevronLeft size={12} className="mr-1" />
                    Back
                </Button>
                {requiresPassphrase && pendingContent ? (
                    <Button
                        size="sm"
                        onClick={() => executeImport(pendingContent)}
                        disabled={isImporting || !importPassphrase}
                        className="ml-auto text-[11px]"
                    >
                        {isImporting ? <Loader2 size={12} className="mr-1.5 animate-spin" /> : <Lock size={12} className="mr-1.5" />}
                        Decrypt & Import
                    </Button>
                ) : !importResult ? (
                    <Button
                        size="sm"
                        onClick={handlePickFile}
                        disabled={isImporting}
                        className="ml-auto text-[11px]"
                    >
                        {isImporting ? <Loader2 size={12} className="mr-1.5 animate-spin" /> : <Download size={12} className="mr-1.5" />}
                        Browse file…
                    </Button>
                ) : (
                    <Button
                        size="sm"
                        onClick={handlePickFile}
                        className="ml-auto text-[11px]"
                    >
                        <Download size={12} className="mr-1.5" />
                        Import another…
                    </Button>
                )}
            </div>
        </div>
    );

    const title = view === "main" ? "Import / Export" : view === "export" ? "Export Connections" : "Import Connections";

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="!max-w-[480px] p-0 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border/40">
                    <div className="flex items-center gap-2">
                        <ArrowUpDown size={14} className="text-muted-foreground/60" />
                        <span className="text-[13px] font-semibold">{title}</span>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-muted-foreground/40 hover:text-foreground transition-colors"
                    >
                        <X size={14} />
                    </button>
                </div>

                {/* Body */}
                <div className="px-5 py-4">
                    {view === "main" && <MainView />}
                    {view === "export" && <ExportView />}
                    {view === "import" && <ImportView />}
                </div>
            </DialogContent>
        </Dialog>
    );
}
