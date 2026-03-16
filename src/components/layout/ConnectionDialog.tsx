import { useState } from 'react';
import { X, Shield, Globe, Database, Key, Server, Tag } from 'lucide-react';
import { DatabaseType, ConnectionConfig } from '@/types';
import { useAppStore } from '@/store/useAppStore';

interface ConnectionDialogProps {
  onClose: () => void;
  initialData?: ConnectionConfig;
}

const ConnectionDialog = ({ onClose, initialData }: ConnectionDialogProps) => {
  const { setConnections, connections } = useAppStore();
  const [formData, setFormData] = useState<Partial<ConnectionConfig>>(
    initialData || {
      name: 'Local PostgreSQL',
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      user: 'postgres',
      database: 'postgres',
    }
  );

  const saveConnection = () => {
    const newConn = {
      ...formData,
      id: formData.id || Math.random().toString(36).substring(7),
    } as ConnectionConfig;

    if (initialData) {
      setConnections(connections.map((c: ConnectionConfig) => c.id === initialData.id ? newConn : c));
    } else {
      setConnections([...connections, newConn]);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--color-app-bg)] w-full max-w-2xl rounded-xl shadow-2xl border border-[var(--color-border-app)] flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-[var(--color-border-app)] flex items-center justify-between bg-[var(--color-toolbar-bg)]">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
              {initialData ? 'Edit Connection' : 'New Connection'}
            </h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-1 tracking-tight">Configure your database access credentials</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {/* DB Type Selection */}
          <div className="grid grid-cols-5 gap-3">
            {[
              { id: 'postgresql', name: 'Postgres', color: 'blue' },
              { id: 'mysql', name: 'MySQL', color: 'orange' },
              { id: 'sqlite', name: 'SQLite', color: 'zinc' },
              { id: 'mongodb', name: 'Mongo', color: 'green' },
              { id: 'redis', name: 'Redis', color: 'red' }
            ].map(db => (
              <button
                key={db.id}
                onClick={() => setFormData({ ...formData, type: db.id as DatabaseType })}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                  formData.type === db.id 
                    ? `border-${db.color}-500 bg-${db.color}-500/10` 
                    : 'border-transparent bg-black/5 grayscale hover:grayscale-0'
                }`}
              >
                <div className={`p-2 rounded-lg bg-${db.color}-500/20 text-${db.color}-400`}>
                   <Database size={24} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest">{db.name}</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* General Settings */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
                  <Tag size={12} /> Connection Name
                </label>
                <input 
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-[var(--color-input-bg)] border border-[var(--color-border-input)] rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 outline-none transition-all" 
                  placeholder="e.g. Production Read-Only"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
                  <Server size={12} /> Host & Port
                </label>
                <div className="flex gap-2">
                  <input 
                    value={formData.host}
                    onChange={e => setFormData({ ...formData, host: e.target.value })}
                    className="flex-1 bg-[var(--color-input-bg)] border border-[var(--color-border-input)] rounded-lg px-4 py-2.5 text-sm outline-none" 
                    placeholder="localhost"
                  />
                  <input 
                    value={formData.port}
                    onChange={e => setFormData({ ...formData, port: parseInt(e.target.value) })}
                    className="w-24 bg-[var(--color-input-bg)] border border-[var(--color-border-input)] rounded-lg px-4 py-2.5 text-sm outline-none font-mono" 
                    placeholder="5432"
                  />
                </div>
              </div>
            </div>

            {/* Authentication Settings */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
                  <Key size={12} /> Credentials
                </label>
                <input 
                  value={formData.user}
                  onChange={e => setFormData({ ...formData, user: e.target.value })}
                  className="w-full bg-[var(--color-input-bg)] border border-[var(--color-border-input)] rounded-lg px-4 py-2.5 text-sm outline-none mb-2" 
                  placeholder="Username"
                />
                <input 
                  type="password"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  className="w-full bg-[var(--color-input-bg)] border border-[var(--color-border-input)] rounded-lg px-4 py-2.5 text-sm outline-none" 
                  placeholder="Password"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
                  <Database size={12} /> Default Database
                </label>
                <input 
                  value={formData.database}
                  onChange={e => setFormData({ ...formData, database: e.target.value })}
                  className="w-full bg-[var(--color-input-bg)] border border-[var(--color-border-input)] rounded-lg px-4 py-2.5 text-sm outline-none" 
                  placeholder="postgres"
                />
              </div>
            </div>
          </div>

          {/* Advanced / SSL */}
          <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-4 flex items-center gap-4">
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
              <Shield size={20} />
            </div>
            <div className="flex-1">
              <h4 className="text-[11px] font-bold uppercase tracking-widest">Secure Connection</h4>
              <p className="text-[10px] text-[var(--color-text-muted)]">Encrypted using AES-GCM 256-bit</p>
            </div>
            <div className="w-12 h-6 bg-zinc-800 rounded-full relative p-1 cursor-pointer">
              <div className="w-4 h-4 bg-blue-500 rounded-full shadow-lg" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[var(--color-border-app)] bg-[var(--color-toolbar-bg)] flex items-center justify-between">
          <button className="flex items-center gap-2 px-6 py-2 border border-[var(--color-border-input)] rounded-lg text-xs font-semibold hover:bg-black/5 transition-all active:scale-95">
            <Globe size={14} />
            TEST CONNECTION
          </button>

          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-6 py-2 text-xs font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-all">
              CANCEL
            </button>
            <button onClick={saveConnection} className="px-8 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-xl shadow-blue-500/20 transition-all active:scale-95">
              SAVE & CONNECT
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnectionDialog;

