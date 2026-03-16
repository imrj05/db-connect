import { useState } from 'react';
import { Shield, Globe, Database, Key, Server, Tag, Loader2, FileText, CheckCircle2 } from 'lucide-react';
import { ConnectionConfig } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { tauriApi } from '@/lib/tauri-api';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { FieldGroup, Field, FieldLabel, FieldDescription } from "@/components/ui/field"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface ConnectionDialogProps {
    onClose: () => void;
    initialData?: ConnectionConfig;
}

const ENGINE_DEFAULTS: Record<string, Partial<ConnectionConfig>> = {
    postgresql: { host: 'localhost', port: 5432, user: 'postgres', database: 'postgres' },
    mysql: { host: 'localhost', port: 3306, user: 'root', database: 'mysql' },
    sqlite: { database: 'local.sqlite' },
    mongodb: { uri: 'mongodb://localhost:27017' },
    redis: { host: 'localhost', port: 6379 },
};

const DATABASE_ENGINES = [
    { id: 'postgresql', name: 'Postgres', color: 'text-blue-500', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/20' },
    { id: 'mysql', name: 'MySQL', color: 'text-cyan-500', bgColor: 'bg-cyan-500/10', borderColor: 'border-cyan-500/20' },
    { id: 'sqlite', name: 'SQLite', color: 'text-slate-500', bgColor: 'bg-slate-500/10', borderColor: 'border-slate-500/20' },
    { id: 'mongodb', name: 'MongoDB', color: 'text-emerald-500', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/20' },
    { id: 'redis', name: 'Redis', color: 'text-red-500', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/20' }
] as const;

const ConnectionDialog = ({ onClose, initialData }: ConnectionDialogProps) => {
    const { setConnections, connections, setActiveConnection, setLoading, isLoading } = useAppStore();
    const [isTesting, setIsTesting] = useState(false);
    const [formData, setFormData] = useState<Partial<ConnectionConfig>>(
        initialData || {
            name: '',
            type: 'postgresql',
            ...ENGINE_DEFAULTS.postgresql,
            ssl: false,
        }
    );

    const handleTypeChange = (type: string) => {
        setFormData(prev => ({
            ...prev,
            type: type as any,
            ...(ENGINE_DEFAULTS[type] || {})
        }));
    };

    const handleTestConnection = async () => {
        setIsTesting(true);
        try {
            // Always use a unique temporary ID for testing to avoid 
            // overwriting active connections in the registry
            const testConfig = {
                ...formData,
                id: `test-${Math.random().toString(36).substring(7)}`,
                name: formData.name || 'Test Connection',
            } as ConnectionConfig;

            await tauriApi.connect(testConfig);
            toast.success('Connection successful');
            
            // Immediately disconnect the test session
            await tauriApi.disconnect(testConfig.id);
        } catch (error) {
            toast.error(`Connection failed: ${String(error)}`);
        } finally {
            setIsTesting(false);
        }
    };

    const persistConnection = (config: ConnectionConfig) => {
        let updatedConnections;
        if (initialData) {
            updatedConnections = connections.map((c: ConnectionConfig) => c.id === initialData.id ? config : c);
        } else {
            updatedConnections = [...connections, config];
        }
        setConnections(updatedConnections);
        localStorage.setItem('db_connections', JSON.stringify(updatedConnections));
        return updatedConnections;
    };

    const handleSaveOnly = async () => {
        const newConn = {
            ...formData,
            id: formData.id || Math.random().toString(36).substring(7),
            name: formData.name || `Connection ${connections.length + 1}`,
        } as ConnectionConfig;
        
        persistConnection(newConn);
        toast.success(initialData ? 'Connection updated' : 'Connection saved to list');
        onClose();
    };

    const saveConnection = async () => {
        const newConn = {
            ...formData,
            id: formData.id || Math.random().toString(36).substring(7),
            name: formData.name || `Connection ${connections.length + 1}`,
        } as ConnectionConfig;

        setLoading(true);
        try {
            await tauriApi.connect(newConn);
            persistConnection(newConn);
            setActiveConnection(newConn);
            toast.success(initialData ? 'Connection updated' : 'Connected successfully');
            onClose();
        } catch (error) {
            toast.error(`Failed to connect: ${String(error)}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-5xl sm:max-w-5xl overflow-hidden p-0 shadow-2xl ring-1 ring-foreground/5 sm:rounded-2xl">
                {/* Header Section */}
                <DialogHeader className="p-6 bg-muted/30 border-b">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1.5">
                            <DialogTitle className="text-xl font-semibold tracking-tight">
                                {initialData ? 'Edit Database Connection' : 'New Database Connection'}
                            </DialogTitle>
                            <DialogDescription className="text-muted-foreground">
                                Set up your database credentials and connection parameters.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto p-6 space-y-8 max-h-[70vh]">
                    {/* Engine Selection */}
                    <section className="space-y-4">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Select Database Engine</h4>
                        <div className="grid grid-cols-5 gap-3">
                            {DATABASE_ENGINES.map((db) => {
                                const isActive = formData.type === db.id;
                                return (
                                    <Card
                                        key={db.id}
                                        onClick={() => handleTypeChange(db.id)}
                                        className={cn(
                                            "relative cursor-pointer transition-all duration-200 py-3",
                                            isActive
                                                ? "bg-background border-primary ring-1 ring-primary/20"
                                                : "bg-muted/10 border-transparent hover:bg-muted/30 hover:border-muted-foreground/20"
                                        )}
                                    >
                                        <CardContent className="flex flex-col items-center gap-2.5 p-0">
                                            <div className={cn(
                                                "size-10 rounded-lg flex items-center justify-center transition-colors shadow-inner",
                                                isActive ? db.bgColor : "bg-muted/50 contrast-75 grayscale opacity-50"
                                            )}>
                                                <Database className={cn("size-5", isActive ? db.color : "text-muted-foreground")} />
                                            </div>
                                            <span className={cn(
                                                "text-[11px] font-medium leading-none",
                                                isActive ? "text-foreground" : "text-muted-foreground"
                                            )}>
                                                {db.name}
                                            </span>
                                            {isActive && (
                                                <motion.div
                                                    layoutId="active-check"
                                                    className="absolute top-2 right-2"
                                                    initial={{ opacity: 0, scale: 0.5 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                >
                                                    <CheckCircle2 className="size-3.5 text-primary fill-background" />
                                                </motion.div>
                                            )}
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    </section>
                    {/* Form Fields */}
                    <FieldGroup className="grid grid-cols-2 gap-6">
                        <Field className="col-span-2">
                            <FieldLabel className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                                <Tag className="size-3.5" /> Connection Name
                            </FieldLabel>
                            <Input
                                value={formData.name || ''}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g. Production Analytics"
                                className="h-10 text-sm font-medium"
                            />
                            <FieldDescription>An optional alias for this connection.</FieldDescription>
                        </Field>
                        {formData.type === 'mongodb' ? (
                            <Field className="col-span-2">
                                <FieldLabel className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                                    <Globe className="size-3.5" /> Connection URI
                                </FieldLabel>
                                <Input
                                    value={formData.uri || ''}
                                    onChange={e => setFormData({ ...formData, uri: e.target.value })}
                                    placeholder="mongodb+srv://user:pass@cluster0.abc.mongodb.net/dbname"
                                    className="h-10 text-sm font-mono bg-muted/20"
                                />
                            </Field>
                        ) : formData.type === 'sqlite' ? (
                            <Field className="col-span-2">
                                <FieldLabel className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                                    <FileText className="size-3.5" /> Database File Path
                                </FieldLabel>
                                <div className="flex gap-2">
                                    <Input
                                        value={formData.database || ''}
                                        onChange={e => setFormData({ ...formData, database: e.target.value })}
                                        placeholder="/path/to/database.sqlite"
                                        className="h-10 text-sm flex-1"
                                    />
                                    <Button variant="secondary" size="sm" className="h-10">Browse</Button>
                                </div>
                            </Field>
                        ) : (
                            <>
                                <Field>
                                    <FieldLabel className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                                        <Server className="size-3.5" /> Hostname / IP
                                    </FieldLabel>
                                    <Input
                                        value={formData.host || ''}
                                        onChange={e => setFormData({ ...formData, host: e.target.value })}
                                        placeholder="localhost"
                                        className="h-10 text-sm"
                                    />
                                </Field>
                                <Field>
                                    <FieldLabel className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                                        Port
                                    </FieldLabel>
                                    <Input
                                        type="number"
                                        value={formData.port || ''}
                                        onChange={e => setFormData({ ...formData, port: parseInt(e.target.value) || 0 })}
                                        placeholder="5432"
                                        className="h-10 text-sm font-mono w-full"
                                    />
                                </Field>
                                <Field>
                                    <FieldLabel className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                                        <Key className="size-3.5" /> Username
                                    </FieldLabel>
                                    <Input
                                        value={formData.user || ''}
                                        onChange={e => setFormData({ ...formData, user: e.target.value })}
                                        placeholder="database_user"
                                        className="h-10 text-sm"
                                    />
                                </Field>
                                <Field>
                                    <FieldLabel className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                                        Password
                                    </FieldLabel>
                                    <Input
                                        type="password"
                                        value={formData.password || ''}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        placeholder="••••••••"
                                        className="h-10 text-sm"
                                    />
                                </Field>
                                <Field className="col-span-2">
                                    <FieldLabel className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                                        <Database className="size-3.5" /> Default Database
                                    </FieldLabel>
                                    <Input
                                        value={formData.database || ''}
                                        onChange={e => setFormData({ ...formData, database: e.target.value })}
                                        placeholder="e.g. postgres"
                                        className="h-10 text-sm"
                                    />
                                </Field>
                            </>
                        )}
                    </FieldGroup>
                    {/* SSL Toggle Card */}
                    <Card
                        onClick={() => setFormData({ ...formData, ssl: !formData.ssl })}
                        className={cn(
                            "cursor-pointer transition-all duration-200 border py-4",
                            formData.ssl ? "bg-primary/5 border-primary/30" : "bg-muted/10 border-transparent hover:bg-muted/20"
                        )}
                    >
                        <CardContent className="flex items-center justify-between p-0 px-4">
                            <div className="flex items-center gap-4">
                                <div className={cn(
                                    "size-10 rounded-lg flex items-center justify-center transition-colors",
                                    formData.ssl ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground"
                                )}>
                                    <Shield className="size-5" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-medium">SSL / TLS Encryption</h4>
                                    <p className="text-xs text-muted-foreground">Secure the connection with cryptographic protocols.</p>
                                </div>
                            </div>
                            <Switch
                                checked={formData.ssl}
                                onCheckedChange={(checked) => setFormData({ ...formData, ssl: checked })}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </CardContent>
                    </Card>
                </div>
                {/* Footer Section */}
                <DialogFooter className="p-6 bg-muted/30 border-t flex flex-row items-center justify-between gap-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleTestConnection}
                        disabled={isTesting || isLoading}
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                    >
                        {isTesting ? <Loader2 className="animate-spin mr-2 size-4" /> : <Globe className="mr-2 size-4" />}
                        Test Connection
                    </Button>
                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onClose}
                            disabled={isLoading || isTesting}
                            className="px-5 border-none bg-transparent hover:bg-muted font-medium"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleSaveOnly}
                            disabled={isLoading || isTesting || !formData.name}
                            className="px-6 font-medium shadow-sm border border-foreground/5"
                        >
                            Save
                        </Button>
                        <Button
                            size="sm"
                            onClick={saveConnection}
                            disabled={isLoading || isTesting || !formData.name}
                            className="px-8 font-semibold shadow-md active:scale-[0.98] transition-all bg-primary hover:bg-primary/90 text-primary-foreground"
                        >
                            {isLoading ? <Loader2 className="animate-spin mr-2 size-4" /> : <CheckCircle2 className="mr-2 size-4" />}
                            {initialData ? 'Save & Connect' : 'Connect'}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
export default ConnectionDialog;
