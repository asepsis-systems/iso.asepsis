'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Database, Lock, User as UserIcon, Eye, EyeOff, ShieldAlert, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Por favor, ingresa tu usuario y contraseña.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ocurrió un error al iniciar sesión');
      }

      // Successful login, redirect to dashboard
      router.push('/');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Credenciales incorrectas. Inténtalo de nuevo.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-slate-950 font-sans selection:bg-brand-500 selection:text-white">
      {/* Premium background effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] aspect-square rounded-full bg-gradient-to-tr from-brand-600/35 to-accent-teal/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] aspect-square rounded-full bg-gradient-to-br from-indigo-700/30 to-brand-950/40 blur-[100px] pointer-events-none" />

      {/* Decorative floating grids/patterns */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />

      <div className="w-full max-w-md z-10">
        {/* Logo and branding */}
        <div className="flex flex-col items-center mb-8 text-center animate-in fade-in slide-in-from-top-4 duration-500">
          <img 
            src="/logo2.jpg" 
            alt="iso.asepsis logo" 
            className="h-20 w-auto mb-4 object-contain rounded-2xl border border-white/15 shadow-xl"
          />
          <h1 className="text-2xl font-bold text-white tracking-tight">T&CH Asepsis </h1>
          <p className="text-xs text-slate-400 mt-1.5 max-w-[280px]">
            Gestión inteligente de control de calidad y almacenamiento documental seguro.
          </p>
        </div>

        {/* Login glassmorphism card */}
        <div className="bg-slate-900/70 border border-white/10 backdrop-blur-xl rounded-3xl p-8 shadow-2xl shadow-black/40 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error display */}
            {error && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-semibold flex items-start gap-2.5 animate-in shake duration-300">
                <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Username field */}
            <div className="space-y-1.5">
              <label htmlFor="username" className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Usuario
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <UserIcon className="h-4 w-4 text-slate-500" />
                </div>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ejemplo_usuario"
                  className="block w-full pl-10 pr-4 py-3 bg-slate-950/60 border border-white/5 hover:border-white/10 focus:border-brand-500 rounded-2xl text-white placeholder-slate-600 focus:outline-none focus:ring-4 focus:ring-brand-500/10 text-sm transition-all"
                  required
                />
              </div>
            </div>

            {/* Password field */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label htmlFor="password" className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Contraseña
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-500" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-11 py-3 bg-slate-950/60 border border-white/5 hover:border-white/10 focus:border-brand-500 rounded-2xl text-white placeholder-slate-600 focus:outline-none focus:ring-4 focus:ring-brand-500/10 text-sm transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-semibold text-sm transition-all duration-300 shadow-lg shadow-brand-500/10 hover:shadow-brand-500/20 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Iniciando sesión...</span>
                </>
              ) : (
                <>
                  <span>Ingresar al Sistema</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* User manual / accounts help card */}
          <div className="mt-8 pt-6 border-t border-white/5">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
              Cuentas de Acceso de Prueba Ejemplos
            </h4>
            <div className="space-y-2 bg-slate-950/40 p-4 rounded-2xl border border-white/5 text-[11px] text-slate-400 leading-relaxed font-semibold">
              <div className="flex justify-between items-center py-0.5 border-b border-white/5">
                <span className="text-white">Admin (General):</span>
                <span>admin / admin123</span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-b border-white/5">
                <span className="text-slate-300">Creador de Archivos:</span>
                <span>creador / creador123</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-300">Verificadores (1, 2, 3):</span>
                <span>verificador1 / verif123</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
