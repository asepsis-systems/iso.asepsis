import React from 'react';
import { 
  HardDrive, 
  Clock, 
  Star, 
  Trash2, 
  FolderPlus, 
  UploadCloud, 
  Database,
  FileCheck,
  FileText
} from 'lucide-react';
import clsx from 'clsx';

interface SidebarProps {
  currentFilter: string;
  setCurrentFilter: (filter: string) => void;
  setCurrentParentId: (id: string | null) => void;
  totalStorageUsed: number; // in bytes
  onNewFolder: () => void;
  onUploadClick: () => void;
  user: { id: string; name: string; username: string; role: string } | null;
}

export default function Sidebar({
  currentFilter,
  setCurrentFilter,
  setCurrentParentId,
  totalStorageUsed,
  onNewFolder,
  onUploadClick,
  user
}: SidebarProps) {
  
  const limitBytes = 100 * 1024 * 1024; // 100MB limit for demo
  const percentage = Math.min((totalStorageUsed / limitBytes) * 100, 100);
  
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const navItems = [
    { id: 'all', label: 'Mi Unidad', icon: HardDrive },
    { id: 'recent', label: 'Recientes', icon: Clock },
    { id: 'starred', label: 'Destacados', icon: Star },
    { id: 'trash', label: 'Papelera', icon: Trash2 },
  ];

  const handleFilterClick = (filterId: string) => {
    setCurrentFilter(filterId);
    if (filterId !== 'all') {
      setCurrentParentId(null);
    }
  };

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 text-slate-300 flex flex-col h-full z-10">
      {/* Brand Header */}
      <div className="p-6 flex items-center gap-3 border-b border-slate-800/60">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center shadow-lg shadow-brand-500/20">
          <Database className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-white tracking-wide text-lg">iso.asepsis</h1>
          <p className="text-[10px] text-brand-400 font-semibold tracking-wider uppercase">Cloud Storage</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="p-4 flex flex-col gap-2">
        <button
          onClick={onUploadClick}
          className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-medium text-sm transition-all duration-300 shadow-md hover:shadow-lg hover:shadow-brand-500/10 active:scale-[0.98]"
        >
          <UploadCloud className="w-4 h-4" />
          <span>Subir Archivo</span>
        </button>
        <button
          onClick={onNewFolder}
          className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700/50 hover:border-slate-600/50 font-medium text-sm transition-all duration-300 active:scale-[0.98]"
        >
          <FolderPlus className="w-4 h-4 text-slate-400" />
          <span>Nueva Carpeta</span>
        </button>
      </div>

      {/* Navigation Groups Container */}
      <div className="flex-1 px-3 py-4 flex flex-col gap-6 overflow-y-auto">
        
        {/* Navigation Group: Files */}
        <div className="flex flex-col gap-1">
          <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Mi Unidad</p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentFilter === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleFilterClick(item.id)}
                className={clsx(
                  "flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 group relative",
                  isActive 
                    ? "bg-slate-800 text-white shadow-sm border border-slate-700/30" 
                    : "hover:bg-slate-800/40 text-slate-400 hover:text-slate-200"
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-brand-500 rounded-r" />
                )}
                <Icon className={clsx(
                  "w-4 h-4 transition-colors",
                  isActive ? "text-brand-400" : "text-slate-500 group-hover:text-slate-400"
                )} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Navigation Group: Verifier Flows */}
        {user && (user.role === 'VERIFIER' || user.role === 'ADMIN') && (
          <div className="flex flex-col gap-1 border-t border-slate-800/40 pt-4">
            <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Mis Firmas</p>
            
            <button
              onClick={() => handleFilterClick('pending-my-signature')}
              className={clsx(
                "flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 group relative",
                currentFilter === 'pending-my-signature'
                  ? "bg-slate-800 text-white shadow-sm border border-slate-700/30" 
                  : "hover:bg-slate-800/40 text-slate-400 hover:text-slate-200"
              )}
            >
              {currentFilter === 'pending-my-signature' && (
                <span className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-amber-500 rounded-r" />
              )}
              <Clock className={clsx(
                "w-4 h-4 transition-colors",
                currentFilter === 'pending-my-signature' ? "text-amber-400" : "text-slate-500 group-hover:text-slate-400"
              )} />
              <span>Por Firmar (Pendientes)</span>
            </button>

            <button
              onClick={() => handleFilterClick('signed-by-me')}
              className={clsx(
                "flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 group relative",
                currentFilter === 'signed-by-me'
                  ? "bg-slate-800 text-white shadow-sm border border-slate-700/30" 
                  : "hover:bg-slate-800/40 text-slate-400 hover:text-slate-200"
              )}
            >
              {currentFilter === 'signed-by-me' && (
                <span className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-emerald-500 rounded-r" />
              )}
              <FileCheck className={clsx(
                "w-4 h-4 transition-colors",
                currentFilter === 'signed-by-me' ? "text-emerald-400" : "text-slate-500 group-hover:text-slate-400"
              )} />
              <span>Mis Firmados (Aprobados)</span>
            </button>
          </div>
        )}

        {/* Navigation Group: Creator Flows */}
        {user && user.role === 'CREATOR' && (
          <div className="flex flex-col gap-1 border-t border-slate-800/40 pt-4">
            <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Mis Elaboraciones</p>
            
            <button
              onClick={() => handleFilterClick('my-elaborated')}
              className={clsx(
                "flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 group relative",
                currentFilter === 'my-elaborated'
                  ? "bg-slate-800 text-white shadow-sm border border-slate-700/30" 
                  : "hover:bg-slate-800/40 text-slate-400 hover:text-slate-200"
              )}
            >
              {currentFilter === 'my-elaborated' && (
                <span className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-brand-500 rounded-r" />
              )}
              <FileText className={clsx(
                "w-4 h-4 transition-colors",
                currentFilter === 'my-elaborated' ? "text-brand-400" : "text-slate-500 group-hover:text-slate-400"
              )} />
              <span>Todos mis archivos</span>
            </button>

            <button
              onClick={() => handleFilterClick('my-elaborated-pending')}
              className={clsx(
                "flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 group relative",
                currentFilter === 'my-elaborated-pending'
                  ? "bg-slate-800 text-white shadow-sm border border-slate-700/30" 
                  : "hover:bg-slate-800/40 text-slate-400 hover:text-slate-200"
              )}
            >
              {currentFilter === 'my-elaborated-pending' && (
                <span className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-amber-500 rounded-r" />
              )}
              <Clock className={clsx(
                "w-4 h-4 transition-colors",
                currentFilter === 'my-elaborated-pending' ? "text-amber-400" : "text-slate-500 group-hover:text-slate-400"
              )} />
              <span>En Proceso</span>
            </button>

            <button
              onClick={() => handleFilterClick('my-elaborated-approved')}
              className={clsx(
                "flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 group relative",
                currentFilter === 'my-elaborated-approved'
                  ? "bg-slate-800 text-white shadow-sm border border-slate-700/30" 
                  : "hover:bg-slate-800/40 text-slate-400 hover:text-slate-200"
              )}
            >
              {currentFilter === 'my-elaborated-approved' && (
                <span className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-emerald-500 rounded-r" />
              )}
              <FileCheck className={clsx(
                "w-4 h-4 transition-colors",
                currentFilter === 'my-elaborated-approved' ? "text-emerald-400" : "text-slate-500 group-hover:text-slate-400"
              )} />
              <span>Aprobados (3/3 Firmas)</span>
            </button>
          </div>
        )}
      </div>

      {/* Storage Indicator */}
      <div className="p-5 border-t border-slate-800/60 bg-slate-950/40">
        <div className="flex items-center justify-between text-xs font-medium text-slate-400 mb-2">
          <span>Almacenamiento</span>
          <span className="text-slate-200 font-semibold">{formatSize(totalStorageUsed)}</span>
        </div>
        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-2 border border-slate-700/20">
          <div 
            className="h-full bg-gradient-to-r from-brand-500 to-accent-teal rounded-full transition-all duration-500" 
            style={{ width: `${percentage}%` }}
          />
        </div>
        <p className="text-[10px] text-slate-500">
          Límite de {formatSize(limitBytes)} para la versión demo.
        </p>
      </div>
    </aside>
  );
}
