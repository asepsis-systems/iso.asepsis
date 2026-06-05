import React from 'react';
import { Search, Grid, List, ShieldCheck, LogOut } from 'lucide-react';
import clsx from 'clsx';

interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  viewMode: 'grid' | 'list';
  setViewMode: (mode: 'grid' | 'list') => void;
  user: { id: string; name: string; username: string; role: string } | null;
  onLogout: () => void;
}

export default function Header({
  searchQuery,
  setSearchQuery,
  viewMode,
  setViewMode,
  user,
  onLogout
}: HeaderProps) {
  
  const getInitials = (name?: string) => {
    if (!name) return 'AA';
    const cleanName = name.replace(/\s*\(.*?\)\s*/g, ''); // Remove parenthesis like (Creador)
    const parts = cleanName.split(' ').filter(Boolean);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
  };

  return (
    <header className="h-16 border-b border-slate-200/80 bg-white/70 backdrop-blur-md px-6 flex items-center justify-between z-10">
      
      {/* Search Input Box */}
      <div className="flex-1 max-w-xl relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          <Search className="h-4.5 w-4.5 text-slate-400" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar archivos por nombre o tipo..."
          className="block w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-slate-50 focus:bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-sm transition-all"
        />
      </div>

      {/* Action panel (layout toggle, info card) */}
      <div className="flex items-center gap-4">
        {/* Layout Mode Toggle */}
        <div className="bg-slate-100/80 p-0.5 rounded-lg border border-slate-200/60 flex items-center gap-0.5">
          <button
            onClick={() => setViewMode('grid')}
            className={clsx(
              "p-1.5 rounded-md transition-all",
              viewMode === 'grid' 
                ? "bg-white text-slate-800 shadow-sm" 
                : "text-slate-400 hover:text-slate-600"
            )}
            title="Vista de cuadrícula"
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={clsx(
              "p-1.5 rounded-md transition-all",
              viewMode === 'list' 
                ? "bg-white text-slate-800 shadow-sm" 
                : "text-slate-400 hover:text-slate-600"
            )}
            title="Vista de lista"
          >
            <List className="w-4 h-4" />
          </button>
        </div>

        {/* Security badge & Mock user profile */}
        <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
          <div className="hidden md:flex flex-col items-end">
            <span className="text-xs font-semibold text-slate-700 truncate max-w-[120px]">
              {user ? user.name : 'Cargando...'}
            </span>
            <span className="text-[10px] text-accent-emerald font-semibold flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              <span>Conexión Segura</span>
            </span>
          </div>
          <div 
            className="w-9 h-9 rounded-full bg-gradient-to-tr from-brand-100 to-brand-200 flex items-center justify-center border border-brand-200/40 text-brand-700 font-bold text-sm shadow-sm select-none"
            title={user ? `${user.name} (${user.role})` : ''}
          >
            {getInitials(user?.name)}
          </div>

          {/* Logout button */}
          <button
            onClick={onLogout}
            className="p-1.5 ml-1 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            title="Cerrar Sesión"
          >
            <LogOut className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

    </header>
  );
}

