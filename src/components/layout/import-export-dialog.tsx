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
} from "lucide-react";
import { ConnectionConfig, ConflictStrategy, ExportFormat, ImportFormat, ImportResult } from "@/types";
import { useAppStore } from "@/store/useAppStore";
import { tauriApi } from "@/lib/tauri-api";
import { toast } from "@/components/ui/sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface ImportExportDialogProps {
    onClose: () => void;
    onImportComplete: (connections: ConnectionConfig[]) => void;
}

type View = "main" | "export" | "import";

export function ImportExportDialog({ onClose, onImportComplete }: ImportExportDialogProps) {
    const { connections } = useAppStore();

    const [view, setView] = useState<View>("main");

    const [exportFormat, setExportFormat] = useState<ExportFormat>("json");
    const [includePasswords, setIncludePasswords] = useState(false);
    const [exportPassphrase, setExportPassphrase] = useState("");
    const [showExportPass, setShowExportPass] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isExporting, setIsExporting] = useState(false);

    const [importFormat, setImportFormat] = useState<ImportFormat>("json");
    const [conflictStrategy, setConflictStrategy] = useState<ConflictStrategy>("skip");
    const [importPassphrase, setImportPassphrase] = useState("");
    const [showImportPass, setShowImportPass] = useState(false);
    const [requiresPassphrase, setRequiresPassphrase] = useState(false);
    const [pendingContent, setPendingContent] = useState<string | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [importResult, setImportResult] = useState<ImportResult | null>(null);

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

    const FormatToggle = ({
        options,
        value,
        onChange,
    }: {
        options: Array<{ value: string; label: string; icon: React.ReactNode }>;
        value: string;
        onChange: (v: string) => void;
    }) => (
        <ToggleGroup
            type="single"
            value={value}
            onValueChange={(next) => {
                if (next) onChange(next);
            }}
            variant="outline"
            size="sm"
            className="grid w-full grid-cols-[repeat(auto-fit,minmax(0,1fr))]"
        >
            {options.map((opt) => (
                <ToggleGroupItem
                    key={opt.value}
                    value={opt.value}
                    className="gap-1.5 px-3 text-[11px] font-medium data-[state=off]:text-muted-foreground"
                >
                    {opt.icon}
                    {opt.label}
                </ToggleGroupItem>
            ))}
        </ToggleGroup>
    );

    const MainView = () => (
        <div className="flex flex-col gap-3 py-2">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
                Export your connections to share or back up. Import from this app&apos;s JSON,
                connection URI strings, or a DBeaver export.
            </p>
            <div className="mt-1 grid grid-cols-2 gap-3">
                <button
                    type="button"
                    onClick={() => setView("export")}
                    className="group flex flex-col items-center gap-3 rounded-md border border-border/50 bg-muted/20 p-5 transition-colors hover:bg-muted/40"
                >
                    <Upload size={22} className="text-muted-foreground transition-colors group-hover:text-foreground" />
                    <div className="text-center">
                        <div className="text-[12px] font-semibold">Export</div>
                        <div className="mt-0.5 text-[10px] text-muted-foreground">Save to JSON or URI</div>
                    </div>
                </button>
                <button
                    type="button"
                    onClick={() => setView("import")}
                    className="group flex flex-col items-center gap-3 rounded-md border border-border/50 bg-muted/20 p-5 transition-colors hover:bg-muted/40"
                >
                    <Download size={22} className="text-muted-foreground transition-colors group-hover:text-foreground" />
                    <div className="text-center">
                        <div className="text-[12px] font-semibold">Import</div>
                        <div className="mt-0.5 text-[10px] text-muted-foreground">JSON, URI, or DBeaver</div>
                    </div>
                </button>
            </div>
        </div>
    );

    const ExportView = () => (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
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
                        One <code className="rounded bg-muted px-1 font-mono text-[9px]">DATABASE_URL</code> per connection.
                        Compatible with Prisma, Rails, .env files.
                    </p>
                )}
            </div>

            <div className="flex flex-col gap-2">
                <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
                    Passwords
                </span>
                <label className="flex cursor-pointer items-center gap-3">
                    <Checkbox
                        checked={includePasswords}
                        onCheckedChange={(checked) => setIncludePasswords(checked === true)}
                    />
                    <span className="text-[11px]">Include passwords in export</span>
                </label>
                {includePasswords && exportFormat === "json" && (
                    <div className="relative">
                        <Lock size={11} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground/50" />
                        <Input
                            type={showExportPass ? "text" : "password"}
                            value={exportPassphrase}
                            onChange={(e) => setExportPassphrase(e.target.value)}
                            placeholder="Passphrase to protect passwords"
                            className="h-8 bg-muted/30 pr-8 pl-8 text-[11px]"
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
                    <Alert className="border-warning/20 bg-warning/10 text-warning">
                        <AlertTriangle className="text-warning" />
                        <AlertTitle className="text-[10px] font-semibold uppercase tracking-wide text-warning">
                            Plaintext Passwords
                        </AlertTitle>
                        <AlertDescription className="text-[10px] text-warning/90">
                            Passwords will be stored as plaintext in the URI file.
                        </AlertDescription>
                    </Alert>
                )}
            </div>

            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
                        Connections ({selectedIds.length === 0 ? "all" : `${selectedIds.length} selected`})
                    </span>
                    <Button
                        type="button"
                        onClick={toggleSelectAll}
                        variant="ghost"
                        size="xs"
                        className="h-auto px-0 text-[9px] text-muted-foreground hover:bg-transparent hover:text-foreground"
                    >
                        {selectedIds.length === connections.length && connections.length > 0
                            ? "Deselect all"
                            : "Select all"}
                    </Button>
                </div>
                <div className="max-h-36 overflow-y-auto rounded-md border border-border/40 bg-muted/10 p-1.5">
                    {connections.length === 0 ? (
                        <p className="py-2 text-center text-[10px] text-muted-foreground">No connections saved</p>
                    ) : (
                        connections.map((c) => (
                            <label key={c.id} className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 hover:bg-muted/30">
                                <Checkbox
                                    checked={selectedIds.length === 0 || selectedIds.includes(c.id)}
                                    onCheckedChange={() => {
                                        if (selectedIds.length === 0) {
                                            setSelectedIds(connections.filter((x) => x.id !== c.id).map((x) => x.id));
                                        } else {
                                            toggleSelectId(c.id);
                                        }
                                    }}
                                />
                                <span className="truncate text-[11px]">{c.name}</span>
                                <span className="ml-auto shrink-0 text-[9px] text-muted-foreground/50">{c.type}</span>
                            </label>
                        ))
                    )}
                </div>
            </div>

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

    const ImportView = () => (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
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
                        Import from DBeaver&apos;s <code className="rounded bg-muted px-1 font-mono text-[9px]">data-sources.json</code>.
                        Passwords are not imported (DBeaver uses proprietary encryption).
                    </p>
                )}
            </div>

            <div className="flex flex-col gap-2">
                <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
                    If connection already exists
                </span>
                <ToggleGroup
                    type="single"
                    value={conflictStrategy}
                    onValueChange={(value) => {
                        if (value === "skip" || value === "overwrite" || value === "rename") {
                            setConflictStrategy(value);
                        }
                    }}
                    variant="outline"
                    size="sm"
                    className="grid w-full grid-cols-3"
                >
                    {(["skip", "overwrite", "rename"] as ConflictStrategy[]).map((s) => (
                        <ToggleGroupItem
                            key={s}
                            value={s}
                            className="text-[11px] font-medium capitalize data-[state=off]:text-muted-foreground"
                        >
                            {s}
                        </ToggleGroupItem>
                    ))}
                </ToggleGroup>
            </div>

            {requiresPassphrase && (
                <div className="flex flex-col gap-2">
                    <Alert className="border-primary/20 bg-primary/10">
                        <Lock className="text-primary" />
                        <AlertTitle className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                            Protected Export
                        </AlertTitle>
                        <AlertDescription className="text-[10px] text-primary/90">
                            This export is password-protected. Enter the passphrase to decrypt.
                        </AlertDescription>
                    </Alert>
                    <div className="relative">
                        <Input
                            type={showImportPass ? "text" : "password"}
                            value={importPassphrase}
                            onChange={(e) => setImportPassphrase(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && pendingContent) {
                                    void executeImport(pendingContent);
                                }
                            }}
                            placeholder="Passphrase"
                            className="h-8 bg-muted/30 pr-8 text-[11px]"
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

            {importResult && (
                <div className="flex flex-col gap-2 rounded-md border border-border/40 bg-muted/10 p-3">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 size={12} className="text-success" />
                        <span className="text-[11px] font-medium">
                            {importResult.imported} imported
                            {importResult.skipped > 0 && `, ${importResult.skipped} skipped`}
                        </span>
                    </div>
                    {importResult.errors.filter((e) => !e.startsWith("Password for")).map((e, i) => (
                        <div key={i} className="flex items-start gap-2">
                            <AlertTriangle size={11} className="mt-0.5 shrink-0 text-warning" />
                            <span className="text-[10px] text-muted-foreground">{e}</span>
                        </div>
                    ))}
                </div>
            )}

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
                        onClick={() => void executeImport(pendingContent)}
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
            <DialogContent className="!max-w-[480px] overflow-hidden rounded-md p-0">
                <DialogHeader className="border-b border-border-subtle bg-surface-2/72 px-4 pt-4 pb-3">
                    <div className="flex items-center gap-2">
                        <ArrowUpDown size={14} className="text-muted-foreground/60" />
                        <DialogTitle className="text-[13px] font-semibold">{title}</DialogTitle>
                    </div>
                    <DialogDescription className="sr-only">
                        Import or export saved database connections.
                    </DialogDescription>
                </DialogHeader>

                <div className="px-4 py-4">
                    {view === "main" && <MainView />}
                    {view === "export" && <ExportView />}
                    {view === "import" && <ImportView />}
                </div>
            </DialogContent>
        </Dialog>
    );
}
