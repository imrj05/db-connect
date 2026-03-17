import { useEffect, useState } from 'react';
import {
    Shield, Globe, Database, Key, Server, Tag,
    Loader2, FileText, CheckCircle2, Trash2, Hash,
    Wifi, WifiOff, Eye, EyeOff, ChevronRight,
} from 'lucide-react';
import { ConnectionConfig } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { tauriApi } from '@/lib/tauri-api';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { suggestPrefix } from '@/lib/db-functions';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ConnectionDialogProps {
    onClose: () => void;
    initialData?: ConnectionConfig;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const ENGINE_DEFAULTS: Record<string, Partial<ConnectionConfig>> = {
    postgresql: { host: 'localhost', port: 5432, user: 'postgres', database: 'postgres' },
    mysql:      { host: 'localhost', port: 3306, user: 'root',     database: 'mysql'    },
    sqlite:     { database: 'local.sqlite'                                               },
    mongodb:    { uri: 'mongodb://localhost:27017'                                       },
    redis:      { host: 'localhost', port: 6379                                          },
};

const DATABASE_ENGINES = [
    {
        id: 'postgresql', label: 'PostgreSQL',
        color: '#3B82F6', bg: 'bg-blue-500/10', text: 'text-blue-400',
        border: 'border-blue-500/30', ring: 'ring-blue-500/20',
        abbr: 'PG',
        description: 'Advanced open source RDBMS',
    },
    {
        id: 'mysql', label: 'MySQL',
        color: '#06B6D4', bg: 'bg-cyan-500/10', text: 'text-cyan-400',
        border: 'border-cyan-500/30', ring: 'ring-cyan-500/20',
        abbr: 'MY',
        description: 'World\'s most popular open source DB',
    },
    {
        id: 'sqlite', label: 'SQLite',
        color: '#64748B', bg: 'bg-slate-500/10', text: 'text-slate-400',
        border: 'border-slate-500/30', ring: 'ring-slate-500/20',
        abbr: 'LT',
        description: 'Lightweight embedded database',
    },
    {
        id: 'mongodb', label: 'MongoDB',
        color: '#10B981', bg: 'bg-emerald-500/10', text: 'text-emerald-400',
        border: 'border-emerald-500/30', ring: 'ring-emerald-500/20',
        abbr: 'MG',
        description: 'Flexible document database',
    },
    {
        id: 'redis', label: 'Redis',
        color: '#EF4444', bg: 'bg-red-500/10', text: 'text-red-400',
        border: 'border-red-500/30', ring: 'ring-red-500/20',
        abbr: 'RD',
        description: 'In-memory data structure store',
    },
] as const;

// ── Sub-components ─────────────────────────────────────────────────────────────

function FormLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
    return (
        <label className="block text-[10px] font-bold uppercase tracking-widest text-text-muted/70 mb-1.5">
            {children}
            {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
    );
}

function FormInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <input
            {...props}
            className={cn(
                "w-full h-9 bg-white/5 border border-white/10 rounded-lg px-3 text-sm text-text-primary placeholder:text-text-muted/40 outline-none transition-all",
                "focus:border-blue-500/50 focus:bg-white/[0.07] focus:ring-1 focus:ring-blue-500/20",
                "disabled:opacity-40 disabled:cursor-not-allowed",
                className,
            )}
        />
    );
}

function ConnectionUrlPreview({ formData }: { formData: Partial<ConnectionConfig> }) {
    const url = (() => {
        const { type, host, port, user, database, uri } = formData;
        if (type === 'mongodb') return uri || 'mongodb://localhost:27017';
        if (type === 'sqlite') return `sqlite://${database || 'local.sqlite'}`;
        if (type === 'redis') return `redis://${host || 'localhost'}:${port || 6379}`;
        const scheme = type === 'mysql' ? 'mysql' : 'postgres';
        return `${scheme}://${user || 'user'}:****@${host || 'localhost'}:${port || 5432}/${database || 'db'}`;
    })();

    return (
        <div className="bg-black/30 border border-white/5 rounded-lg px-3 py-2 flex items-center gap-2">
            <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted/40 shrink-0">URL</span>
            <span className="text-[11px] font-mono text-text-muted/60 truncate">{url}</span>
        </div>
    );
}

// ── Main component ─────────────────────────────────────────────────────────────

const ConnectionDialog = ({ onClose, initialData }: ConnectionDialogProps) => {
    const {
        connections,
        addConnection,
        setConnections,
        deleteConnection,
        connectAndInit,
        isLoading,
    } = useAppStore();

    const [isTesting, setIsTesting] = useState(false);
    const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [showPassword, setShowPassword] = useState(false);
    const [prefixManuallyEdited, setPrefixManuallyEdited] = useState(!!initialData?.prefix);

    const [formData, setFormData] = useState<Partial<ConnectionConfig>>(
        initialData || {
            name: '',
            prefix: '',
            type: 'postgresql',
            ...ENGINE_DEFAULTS.postgresql,
            ssl: false,
        }
    );

    const activeEngine = DATABASE_ENGINES.find(e => e.id === formData.type) ?? DATABASE_ENGINES[0];

    // Auto-suggest prefix from connection name
    useEffect(() => {
        if (!prefixManuallyEdited && formData.name) {
            setFormData(prev => ({ ...prev, prefix: suggestPrefix(formData.name || '') }));
        }
    }, [formData.name, prefixManuallyEdited]);

    const patch = (partial: Partial<ConnectionConfig>) =>
        setFormData(prev => ({ ...prev, ...partial }));

    const handleEngineChange = (id: string) => {
        patch({ type: id as any, ...(ENGINE_DEFAULTS[id] || {}) });
        setTestStatus('idle');
    };

    const buildConfig = (): ConnectionConfig => ({
        ...formData,
        id: formData.id || Math.random().toString(36).substring(7),
        name: formData.name || `Connection ${connections.length + 1}`,
        prefix: formData.prefix || suggestPrefix(formData.name || `conn${connections.length + 1}`),
    } as ConnectionConfig);

    const persistConnection = (config: ConnectionConfig) => {
        if (initialData) {
            setConnections(connections.map(c => c.id === initialData.id ? config : c));
        } else if (connections.find(c => c.name === config.name)) {
            setConnections(connections.map(c => c.name === config.name ? config : c));
        } else {
            addConnection(config);
        }
    };

    const handleTest = async () => {
        setIsTesting(true);
        setTestStatus('idle');
        try {
            const testConfig = {
                ...formData,
                id: `test-${Math.random().toString(36).substring(7)}`,
                name: formData.name || 'Test',
                prefix: formData.prefix || 'test',
            } as ConnectionConfig;
            await tauriApi.connect(testConfig);
            await tauriApi.disconnect(testConfig.id);
            setTestStatus('success');
            toast.success('Connection successful');
        } catch (err) {
            setTestStatus('error');
            toast.error(`Connection failed: ${String(err)}`);
        } finally {
            setIsTesting(false);
        }
    };

    const handleSave = async () => {
        const config = buildConfig();
        persistConnection(config);
        toast.success(initialData ? 'Connection updated' : 'Connection saved');
        onClose();
    };

    const handleConnect = async () => {
        const config = buildConfig();
        persistConnection(config);
        await connectAndInit(config.id);
        onClose();
    };

    const handleDelete = () => {
        if (initialData?.id) {
            deleteConnection(initialData.id);
            toast.success('Connection deleted');
            onClose();
        }
    };

    // ── Render ───────────────────────────────────────────────────────────────────

    return (
        <Dialog open onOpenChange={open => !open && onClose()}>
            <DialogContent showCloseButton={false} className="!max-w-[860px] !w-[860px] !p-0 !gap-0 overflow-hidden bg-[#111111] border border-white/8 shadow-2xl rounded-2xl">
                <div className="flex h-[560px]">

                    {/* ── Left panel: engine selector ─────────────────────────────── */}
                    <div className="w-52 shrink-0 bg-[#0d0d0d] border-r border-white/5 flex flex-col">
                        {/* Panel header */}
                        <div className="h-14 px-4 flex items-end pb-3 border-b border-white/5">
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-text-muted/40">
                                Database Engine
                            </span>
                        </div>

                        {/* Engine list */}
                        <div className="flex-1 p-2 space-y-0.5 overflow-y-auto scrollbar-thin">
                            {DATABASE_ENGINES.map(engine => {
                                const isActive = formData.type === engine.id;
                                return (
                                    <button
                                        key={engine.id}
                                        onClick={() => handleEngineChange(engine.id)}
                                        className={cn(
                                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 text-left group",
                                            isActive
                                                ? `${engine.bg} border ${engine.border}`
                                                : "hover:bg-white/5 border border-transparent",
                                        )}
                                    >
                                        {/* Engine icon */}
                                        <div className={cn(
                                            "size-8 rounded-lg flex items-center justify-center font-black text-[10px] shrink-0 transition-all",
                                            isActive
                                                ? `${engine.bg} ${engine.text} border ${engine.border}`
                                                : "bg-white/5 text-text-muted/40 group-hover:bg-white/10",
                                        )}>
                                            {engine.abbr}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className={cn(
                                                "text-[12px] font-semibold leading-none",
                                                isActive ? engine.text : "text-text-secondary",
                                            )}>
                                                {engine.label}
                                            </div>
                                            <div className="text-[9px] text-text-muted/40 mt-0.5 leading-tight truncate">
                                                {engine.description}
                                            </div>
                                        </div>

                                        {isActive && (
                                            <ChevronRight size={12} className={cn("shrink-0", engine.text)} />
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Panel footer: active engine pill */}
                        <div className="p-3 border-t border-white/5">
                            <div className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded-lg",
                                activeEngine.bg,
                            )}>
                                <div className={cn(
                                    "size-5 rounded flex items-center justify-center font-black text-[8px]",
                                    activeEngine.bg, activeEngine.text,
                                )}>
                                    {activeEngine.abbr}
                                </div>
                                <span className={cn("text-[10px] font-bold", activeEngine.text)}>
                                    {activeEngine.label}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* ── Right panel: form ────────────────────────────────────────── */}
                    <div className="flex-1 flex flex-col min-w-0">

                        {/* Form header */}
                        <div className="h-14 px-6 flex items-center border-b border-white/5 shrink-0">
                            <div>
                                <h2 className="text-sm font-bold text-text-primary">
                                    {initialData ? 'Edit Connection' : 'New Connection'}
                                </h2>
                                <p className="text-[10px] text-text-muted/50 mt-0.5">
                                    {initialData
                                        ? `Editing ${initialData.name}`
                                        : `Configure your ${activeEngine.label} connection`}
                                </p>
                            </div>
                        </div>

                        {/* Scrollable form body */}
                        <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-5">

                            {/* ── Identity row ── */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <FormLabel required>
                                        <Tag className="inline size-3 mr-1 opacity-60" />
                                        Connection Name
                                    </FormLabel>
                                    <FormInput
                                        value={formData.name || ''}
                                        onChange={e => patch({ name: e.target.value })}
                                        placeholder="e.g. Production Analytics"
                                    />
                                </div>

                                <div>
                                    <FormLabel>
                                        <Hash className="inline size-3 mr-1 opacity-60" />
                                        Function Prefix
                                    </FormLabel>
                                    <div className="flex gap-2">
                                        <FormInput
                                            value={formData.prefix || ''}
                                            onChange={e => {
                                                setPrefixManuallyEdited(true);
                                                patch({ prefix: e.target.value });
                                            }}
                                            placeholder="e.g. prod"
                                            className="font-mono flex-1"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setPrefixManuallyEdited(false);
                                                patch({ prefix: suggestPrefix(formData.name || '') });
                                            }}
                                            className="h-9 px-3 rounded-lg text-[10px] font-bold text-text-muted hover:text-white bg-white/5 hover:bg-white/10 border border-white/8 transition-all shrink-0"
                                        >
                                            Auto
                                        </button>
                                    </div>
                                    {/* Inline prefix preview */}
                                    {formData.prefix && (
                                        <p className="mt-1.5 text-[10px] font-mono text-text-muted/40">
                                            <span className={activeEngine.text}>{formData.prefix}_list()</span>
                                            {' · '}
                                            <span className={activeEngine.text}>{formData.prefix}_query()</span>
                                            {' · ...'}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* ── Divider ── */}
                            <div className="flex items-center gap-3">
                                <div className="flex-1 h-px bg-white/5" />
                                <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted/30">
                                    Connection Details
                                </span>
                                <div className="flex-1 h-px bg-white/5" />
                            </div>

                            {/* ── Engine-specific fields ── */}
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={formData.type}
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -6 }}
                                    transition={{ duration: 0.15 }}
                                    className="space-y-4"
                                >
                                    {formData.type === 'mongodb' ? (
                                        <div>
                                            <FormLabel>
                                                <Globe className="inline size-3 mr-1 opacity-60" />
                                                Connection URI
                                            </FormLabel>
                                            <FormInput
                                                value={formData.uri || ''}
                                                onChange={e => patch({ uri: e.target.value })}
                                                placeholder="mongodb+srv://user:pass@cluster0.example.net/db"
                                                className="font-mono text-[12px]"
                                            />
                                        </div>
                                    ) : formData.type === 'sqlite' ? (
                                        <div>
                                            <FormLabel>
                                                <FileText className="inline size-3 mr-1 opacity-60" />
                                                Database File Path
                                            </FormLabel>
                                            <div className="flex gap-2">
                                                <FormInput
                                                    value={formData.database || ''}
                                                    onChange={e => patch({ database: e.target.value })}
                                                    placeholder="/path/to/database.sqlite"
                                                    className="font-mono text-[12px] flex-1"
                                                />
                                                <button className="h-9 px-3 rounded-lg text-[10px] font-bold text-text-muted hover:text-white bg-white/5 hover:bg-white/10 border border-white/8 transition-all shrink-0">
                                                    Browse
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {/* Host + Port */}
                                            <div className="grid grid-cols-3 gap-3">
                                                <div className="col-span-2">
                                                    <FormLabel>
                                                        <Server className="inline size-3 mr-1 opacity-60" />
                                                        Hostname
                                                    </FormLabel>
                                                    <FormInput
                                                        value={formData.host || ''}
                                                        onChange={e => patch({ host: e.target.value })}
                                                        placeholder="localhost"
                                                    />
                                                </div>
                                                <div>
                                                    <FormLabel>Port</FormLabel>
                                                    <FormInput
                                                        type="number"
                                                        value={formData.port || ''}
                                                        onChange={e => patch({ port: parseInt(e.target.value) || 0 })}
                                                        placeholder="5432"
                                                        className="font-mono"
                                                    />
                                                </div>
                                            </div>

                                            {/* User + Password (only for non-Redis) */}
                                            {formData.type !== 'redis' && (
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <FormLabel>
                                                            <Key className="inline size-3 mr-1 opacity-60" />
                                                            Username
                                                        </FormLabel>
                                                        <FormInput
                                                            value={formData.user || ''}
                                                            onChange={e => patch({ user: e.target.value })}
                                                            placeholder="database_user"
                                                        />
                                                    </div>
                                                    <div>
                                                        <FormLabel>Password</FormLabel>
                                                        <div className="relative">
                                                            <FormInput
                                                                type={showPassword ? 'text' : 'password'}
                                                                value={formData.password || ''}
                                                                onChange={e => patch({ password: e.target.value })}
                                                                placeholder="••••••••"
                                                                className="pr-9"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => setShowPassword(v => !v)}
                                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted/40 hover:text-text-muted transition-colors"
                                                            >
                                                                {showPassword
                                                                    ? <EyeOff size={13} />
                                                                    : <Eye size={13} />}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Default database (not for Redis) */}
                                            {formData.type !== 'redis' && (
                                                <div>
                                                    <FormLabel>
                                                        <Database className="inline size-3 mr-1 opacity-60" />
                                                        Default Database
                                                    </FormLabel>
                                                    <FormInput
                                                        value={formData.database || ''}
                                                        onChange={e => patch({ database: e.target.value })}
                                                        placeholder="e.g. postgres"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </motion.div>
                            </AnimatePresence>

                            {/* ── SSL toggle (not for Redis/SQLite) ── */}
                            {formData.type !== 'redis' && formData.type !== 'sqlite' && (
                                <div
                                    onClick={() => patch({ ssl: !formData.ssl })}
                                    className={cn(
                                        "flex items-center justify-between px-4 py-3 rounded-xl border cursor-pointer transition-all",
                                        formData.ssl
                                            ? "bg-emerald-500/5 border-emerald-500/20"
                                            : "bg-white/[0.02] border-white/5 hover:bg-white/5",
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "size-8 rounded-lg flex items-center justify-center transition-colors",
                                            formData.ssl
                                                ? "bg-emerald-500/10 text-emerald-400"
                                                : "bg-white/5 text-text-muted/40",
                                        )}>
                                            <Shield size={14} />
                                        </div>
                                        <div>
                                            <p className="text-[12px] font-semibold text-text-primary">
                                                SSL / TLS Encryption
                                            </p>
                                            <p className="text-[10px] text-text-muted/50">
                                                Encrypt the connection with TLS
                                            </p>
                                        </div>
                                    </div>
                                    <Switch
                                        checked={!!formData.ssl}
                                        onCheckedChange={checked => patch({ ssl: checked })}
                                        onClick={e => e.stopPropagation()}
                                        className="shrink-0"
                                    />
                                </div>
                            )}

                            {/* ── Connection URL preview ── */}
                            <ConnectionUrlPreview formData={formData} />
                        </div>

                        {/* ── Footer ── */}
                        <div className="h-14 px-6 border-t border-white/5 flex items-center justify-between shrink-0 bg-[#0d0d0d]">
                            {/* Left: test + delete */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleTest}
                                    disabled={isTesting || isLoading}
                                    className={cn(
                                        "h-8 px-4 rounded-lg flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-all border",
                                        testStatus === 'success'
                                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                            : testStatus === 'error'
                                            ? "bg-red-500/10 text-red-400 border-red-500/20"
                                            : "bg-white/5 text-text-muted hover:text-white hover:bg-white/10 border-white/8",
                                        (isTesting || isLoading) && "opacity-50 cursor-not-allowed",
                                    )}
                                >
                                    {isTesting ? (
                                        <Loader2 size={11} className="animate-spin" />
                                    ) : testStatus === 'success' ? (
                                        <Wifi size={11} />
                                    ) : testStatus === 'error' ? (
                                        <WifiOff size={11} />
                                    ) : (
                                        <Globe size={11} />
                                    )}
                                    {testStatus === 'success' ? 'Connected' : testStatus === 'error' ? 'Failed' : 'Test'}
                                </button>

                                {initialData && (
                                    <button
                                        onClick={handleDelete}
                                        className="h-8 px-3 rounded-lg flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-red-500/60 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
                                    >
                                        <Trash2 size={11} />
                                        Delete
                                    </button>
                                )}
                            </div>

                            {/* Right: cancel + save + connect */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={onClose}
                                    disabled={isLoading}
                                    className="h-8 px-4 rounded-lg text-[10px] font-bold uppercase tracking-widest text-text-muted hover:text-white bg-white/5 hover:bg-white/10 border border-white/8 transition-all disabled:opacity-40"
                                >
                                    Cancel
                                </button>

                                <button
                                    onClick={handleSave}
                                    disabled={isLoading || !formData.name}
                                    className="h-8 px-4 rounded-lg text-[10px] font-bold uppercase tracking-widest text-text-muted hover:text-white bg-white/5 hover:bg-white/10 border border-white/8 transition-all disabled:opacity-40"
                                >
                                    Save
                                </button>

                                <button
                                    onClick={handleConnect}
                                    disabled={isLoading || !formData.name}
                                    className={cn(
                                        "h-8 px-5 rounded-lg flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed",
                                        activeEngine.bg,
                                        activeEngine.text,
                                        `border ${activeEngine.border}`,
                                        "hover:brightness-125",
                                    )}
                                >
                                    {isLoading ? (
                                        <Loader2 size={11} className="animate-spin" />
                                    ) : (
                                        <CheckCircle2 size={11} />
                                    )}
                                    {initialData ? 'Reconnect' : 'Connect'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ConnectionDialog;
