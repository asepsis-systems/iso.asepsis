'use client';

import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Plus, 
  X, 
  Image as ImageIcon, 
  User, 
  Calendar, 
  Building2, 
  FileText, 
  ChevronRight,
  Loader2,
  Maximize2
} from 'lucide-react';

interface UserType {
  id: string;
  name: string;
  username: string;
  role: string;
}

interface IncidentType {
  id: string;
  title: string;
  area: string;
  description: string;
  imageUrl: string | null;
  status: string;
  createdAt: string;
  userId: string;
  user: {
    name: string;
    username: string;
    role: string;
  };
}

interface IncidentsDashboardProps {
  user: UserType | null;
}

export default function IncidentsDashboard({ user }: IncidentsDashboardProps) {
  const [incidents, setIncidents] = useState<IncidentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('All'); // 'All', 'Pendiente', 'En Revisión', 'Solucionado'
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<IncidentType | null>(null);
  
  // Create form states
  const [newTitle, setNewTitle] = useState('');
  const [newArea, setNewArea] = useState('Operaciones');
  const [newDescription, setNewDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Status updating state
  const [updatingStatus, setUpdatingStatus] = useState(false);
  
  // Edit form states
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editArea, setEditArea] = useState('Operaciones');
  const [editDescription, setEditDescription] = useState('');
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  
  // Custom toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const fetchIncidents = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/incidents');
      const data = await res.json();
      if (res.ok) {
        setIncidents(data.incidents || []);
      } else {
        showToast(data.error || 'Error al cargar los incidentes', 'error');
      }
    } catch (err: any) {
      console.error(err);
      showToast('Error de conexión con el servidor', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, []);

  // Handle image select & preview
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit new incident
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDescription.trim()) {
      showToast('Por favor completa todos los campos requeridos', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append('title', newTitle.trim());
      formData.append('area', newArea);
      formData.append('description', newDescription.trim());
      if (selectedFile) {
        formData.append('file', selectedFile);
      }

      const res = await fetch('/api/incidents', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        showToast('Incidente reportado exitosamente');
        setIsCreateOpen(false);
        // Reset fields
        setNewTitle('');
        setNewDescription('');
        setSelectedFile(null);
        setImagePreview(null);
        // Refresh list
        fetchIncidents();
      } else {
        showToast(data.error || 'Error al reportar el incidente', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de red al enviar el reporte', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle image select & preview for EDIT
  const handleEditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setEditFile(file);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit edited incident report
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident) return;
    if (!editTitle.trim() || !editDescription.trim()) {
      showToast('Por favor completa todos los campos requeridos', 'error');
      return;
    }

    try {
      setSavingEdit(true);
      const formData = new FormData();
      formData.append('id', selectedIncident.id);
      formData.append('title', editTitle.trim());
      formData.append('area', editArea);
      formData.append('description', editDescription.trim());
      if (editFile) {
        formData.append('file', editFile);
      }

      const res = await fetch('/api/incidents', {
        method: 'PUT',
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        showToast('Reporte de incidente actualizado exitosamente');
        setIsEditing(false);
        // Refresh detail view
        setSelectedIncident(data.incident);
        // Refresh list
        fetchIncidents();
      } else {
        showToast(data.error || 'Error al actualizar el incidente', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de red al actualizar el reporte', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  // Update incident status (ADMIN/VERIFIER only)
  const handleStatusUpdate = async (incidentId: string, newStatus: string) => {
    try {
      setUpdatingStatus(true);
      const res = await fetch('/api/incidents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: incidentId, status: newStatus }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast(`Estado actualizado a: ${newStatus}`);
        // Update local state
        setIncidents(prev => prev.map(inc => inc.id === incidentId ? { ...inc, status: newStatus } : inc));
        if (selectedIncident && selectedIncident.id === incidentId) {
          setSelectedIncident(prev => prev ? { ...prev, status: newStatus } : null);
        }
      } else {
        showToast(data.error || 'Error al actualizar el estado', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de red al actualizar el estado', 'error');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Counts for cards
  const totalCount = incidents.length;
  const pendingCount = incidents.filter(i => i.status === 'Pendiente').length;
  const reviewCount = incidents.filter(i => i.status === 'En Revisión').length;
  const solvedCount = incidents.filter(i => i.status === 'Solucionado').length;

  // Filtered list
  const filteredIncidents = incidents.filter(inc => {
    const matchesStatus = statusFilter === 'All' || inc.status === statusFilter;
    const matchesSearch = inc.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          inc.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          inc.area.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          inc.user.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Pendiente':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 shadow-sm shadow-rose-500/5">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
            Pendiente
          </span>
        );
      case 'En Revisión':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm shadow-amber-500/5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            En Revisión
          </span>
        );
      case 'Solucionado':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm shadow-emerald-500/5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Solucionado
          </span>
        );
      default:
        return null;
    }
  };

  const getAreaColor = (area: string) => {
    switch (area) {
      case 'Operaciones': return 'text-sky-400 bg-sky-500/10 border-sky-500/10';
      case 'Logística': return 'text-violet-400 bg-violet-500/10 border-violet-500/10';
      case 'Mantenimiento': return 'text-amber-400 bg-amber-500/10 border-amber-500/10';
      case 'Administración': return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/10';
      default: return 'text-slate-400 bg-slate-500/10 border-slate-500/10';
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-PE', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 p-6 md:p-8 text-slate-100 flex flex-col gap-6 relative">
      
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl transition-all duration-300 animate-slide-in ${
          toast.type === 'error' 
            ? 'bg-rose-950/90 border-rose-500/30 text-rose-200' 
            : 'bg-emerald-950/90 border-emerald-500/30 text-emerald-200'
        }`}>
          {toast.type === 'error' ? <AlertTriangle className="w-5 h-5 text-rose-400" /> : <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/60 pb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <AlertTriangle className="w-7 h-7 text-rose-500 shrink-0" />
            Reporte de Incidentes
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Modulo operativo de reporte, seguimiento y solución de anomalías de planta.
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-rose-500 to-coral-600 hover:from-rose-600 hover:to-coral-700 text-white py-3 px-5 rounded-xl font-semibold text-sm transition-all duration-300 shadow-md hover:shadow-rose-500/20 active:scale-[0.98] self-start md:self-auto"
        >
          <Plus className="w-4.5 h-4.5" />
          <span>Reportar Incidente</span>
        </button>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Card */}
        <div 
          onClick={() => setStatusFilter('All')}
          className={`group p-4 rounded-2xl border transition-all duration-300 cursor-pointer ${
            statusFilter === 'All' 
              ? 'bg-slate-800/80 border-slate-600 shadow-lg shadow-slate-900/50 scale-[1.02]' 
              : 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-900/80 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 group-hover:text-slate-300">Todos</span>
            <FileText className="w-5 h-5 text-slate-500 group-hover:text-slate-400" />
          </div>
          <p className="text-2xl md:text-3xl font-extrabold text-white">{totalCount}</p>
          <p className="text-[10px] text-slate-500 mt-1">Total de incidentes reportados</p>
        </div>

        {/* Pending Card */}
        <div 
          onClick={() => setStatusFilter('Pendiente')}
          className={`group p-4 rounded-2xl border transition-all duration-300 cursor-pointer ${
            statusFilter === 'Pendiente' 
              ? 'bg-rose-950/30 border-rose-500/50 shadow-lg shadow-rose-950/20 scale-[1.02]' 
              : 'bg-slate-900/40 border-slate-800/80 hover:bg-rose-950/15 hover:border-rose-500/20'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-400/80 group-hover:text-rose-300">Pendientes</span>
            <AlertTriangle className="w-5 h-5 text-rose-500/60 group-hover:text-rose-400" />
          </div>
          <p className="text-2xl md:text-3xl font-extrabold text-rose-400">{pendingCount}</p>
          <p className="text-[10px] text-slate-500 mt-1">Requieren revisión inmediata</p>
        </div>

        {/* In Review Card */}
        <div 
          onClick={() => setStatusFilter('En Revisión')}
          className={`group p-4 rounded-2xl border transition-all duration-300 cursor-pointer ${
            statusFilter === 'En Revisión' 
              ? 'bg-amber-950/30 border-amber-500/50 shadow-lg shadow-amber-950/20 scale-[1.02]' 
              : 'bg-slate-900/40 border-slate-800/80 hover:bg-amber-950/15 hover:border-amber-500/20'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400/80 group-hover:text-amber-300">En Revisión</span>
            <Clock className="w-5 h-5 text-amber-500/60 group-hover:text-amber-400" />
          </div>
          <p className="text-2xl md:text-3xl font-extrabold text-amber-400">{reviewCount}</p>
          <p className="text-[10px] text-slate-500 mt-1">Siendo analizados / en curso</p>
        </div>

        {/* Solved Card */}
        <div 
          onClick={() => setStatusFilter('Solucionado')}
          className={`group p-4 rounded-2xl border transition-all duration-300 cursor-pointer ${
            statusFilter === 'Solucionado' 
              ? 'bg-emerald-950/30 border-emerald-500/50 shadow-lg shadow-emerald-950/20 scale-[1.02]' 
              : 'bg-slate-900/40 border-slate-800/80 hover:bg-emerald-950/15 hover:border-emerald-500/20'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400/80 group-hover:text-emerald-300">Solucionados</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-500/60 group-hover:text-emerald-400" />
          </div>
          <p className="text-2xl md:text-3xl font-extrabold text-emerald-400">{solvedCount}</p>
          <p className="text-[10px] text-slate-500 mt-1">Resueltos satisfactoriamente</p>
        </div>
      </div>

      {/* Main Panel with Filter Controls and Table */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl flex-1 flex flex-col overflow-hidden">
        {/* Table Filters Header */}
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/10">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-300">Listado de Reportes</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-medium">
              {filteredIncidents.length} de {incidents.length}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <input
              type="text"
              placeholder="Buscar por título, área, descripción..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm placeholder-slate-500 text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/40 focus:border-rose-500/60 transition-all duration-200 min-w-[240px]"
            />
          </div>
        </div>

        {/* Content View */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
              <p className="text-slate-400 text-sm">Cargando reportes del sistema...</p>
            </div>
          ) : filteredIncidents.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6">
              <AlertTriangle className="w-10 h-10 text-slate-600 mb-3" />
              <p className="text-slate-300 font-semibold">No se encontraron incidentes</p>
              <p className="text-slate-500 text-xs max-w-sm mt-1">
                {searchQuery || statusFilter !== 'All' 
                  ? 'Intenta cambiar los filtros de búsqueda o el estado seleccionado.' 
                  : 'Aún no se han registrado incidentes operativos en la plataforma.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/20 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                    <th className="px-6 py-4">Incidente</th>
                    <th className="px-6 py-4">Área Afectada</th>
                    <th className="px-6 py-4">Reportado Por</th>
                    <th className="px-6 py-4">Fecha de Reporte</th>
                    <th className="px-6 py-4">Estado</th>
                    <th className="px-6 py-4 text-right">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {filteredIncidents.map((inc) => (
                    <tr 
                      key={inc.id}
                      onClick={() => {
                        setSelectedIncident(inc);
                        setIsDetailOpen(true);
                      }}
                      className="hover:bg-slate-800/30 transition-all duration-150 cursor-pointer group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-0.5 max-w-[280px] md:max-w-[360px]">
                          <span className="font-semibold text-white text-sm truncate group-hover:text-rose-400 transition-colors">
                            {inc.title}
                          </span>
                          <span className="text-slate-400 text-xs line-clamp-1">
                            {inc.description}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-semibold border ${getAreaColor(inc.area)}`}>
                          {inc.area}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-slate-200 text-xs font-medium">{inc.user.name}</span>
                          <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{inc.user.role}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-xs font-medium">
                        {formatDate(inc.createdAt)}
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(inc.status)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="p-1.5 rounded-lg bg-slate-800/40 border border-slate-700/30 hover:bg-slate-800 hover:border-slate-600 transition-all text-slate-400 hover:text-white">
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: Create Report Form */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm transition-all duration-300">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/40">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
                Reportar Nuevo Incidente
              </h2>
              <button 
                onClick={() => {
                  setIsCreateOpen(false);
                  setImagePreview(null);
                  setSelectedFile(null);
                }}
                className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
              {/* Grid 2 Columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Title */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Título del Incidente <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Ej. Fuga de agua en el ablandador"
                    className="px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500/50 transition-all duration-200"
                  />
                </div>

                {/* Area Affected */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Área Afectada <span className="text-rose-500">*</span></label>
                  <select
                    value={newArea}
                    onChange={(e) => setNewArea(e.target.value)}
                    className="px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500/50 transition-all duration-200"
                  >
                    <option value="Operaciones">Operaciones</option>
                    <option value="Logística">Logística</option>
                    <option value="Mantenimiento">Mantenimiento</option>
                    <option value="Administración">Administración</option>
                    <option value="General">General</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Descripción Detallada <span className="text-rose-500">*</span></label>
                <textarea
                  required
                  rows={4}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Detalla de forma clara el incidente observado, equipos involucrados e impacto operativo..."
                  className="px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500/50 transition-all duration-200"
                />
              </div>

              {/* File Attachment / Image drag and drop */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Evidencia Fotográfica (Opcional)</label>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  {/* Drop zone / Upload input */}
                  <div className="relative border-2 border-dashed border-slate-800 hover:border-slate-700/80 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer bg-slate-950/20 hover:bg-slate-950/40 transition-all duration-200 min-h-[140px]">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <ImageIcon className="w-8 h-8 text-slate-500" />
                    <span className="text-xs font-semibold text-slate-300">Cargar una Imagen</span>
                    <span className="text-[10px] text-slate-500 text-center">Formatos permitidos: JPG, PNG. Máx 5MB</span>
                  </div>

                  {/* Image Preview Container */}
                  <div className="border border-slate-800 bg-slate-950/30 rounded-2xl min-h-[140px] flex items-center justify-center overflow-hidden p-2 relative">
                    {imagePreview ? (
                      <>
                        <img 
                          src={imagePreview} 
                          alt="Previsualización" 
                          className="max-h-[120px] max-w-full rounded-xl object-contain"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedFile(null);
                            setImagePreview(null);
                          }}
                          className="absolute top-2 right-2 p-1 rounded-full bg-slate-950/80 hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-slate-600 font-medium">Sin previsualización</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="border-t border-slate-800/60 pt-5 mt-2 flex items-center justify-end gap-3 bg-slate-900">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setImagePreview(null);
                    setSelectedFile(null);
                  }}
                  className="px-4.5 py-2.5 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white font-semibold text-sm transition-all duration-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-200"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Procesando...</span>
                    </>
                  ) : (
                    <span>Registrar Reporte</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Detail View & Status/Details Editing */}
      {isDetailOpen && selectedIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm transition-all duration-300">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
            {/* Header */}
            <div className="p-5 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/40">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
                <div>
                  <h2 className="text-md font-bold text-white max-w-[400px] truncate">
                    {isEditing ? 'Editar Reporte de Incidente' : selectedIncident.title}
                  </h2>
                  <p className="text-[10px] text-slate-500 mt-0.5 font-bold uppercase tracking-wider">ID: {selectedIncident.id}</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsEditing(false);
                  setIsDetailOpen(false);
                  setSelectedIncident(null);
                }}
                className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            {isEditing ? (
              <form onSubmit={handleEditSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
                {/* Grid 2 Columns */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Title */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Título del Incidente <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      required
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Ej. Fuga de agua en el ablandador"
                      className="px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500/50 transition-all duration-200"
                    />
                  </div>

                  {/* Area Affected */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Área Afectada <span className="text-rose-500">*</span></label>
                    <select
                      value={editArea}
                      onChange={(e) => setEditArea(e.target.value)}
                      className="px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500/50 transition-all duration-200"
                    >
                      <option value="Operaciones">Operaciones</option>
                      <option value="Logística">Logística</option>
                      <option value="Mantenimiento">Mantenimiento</option>
                      <option value="Administración">Administración</option>
                      <option value="General">General</option>
                    </select>
                  </div>
                </div>

                {/* Description */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Descripción Detallada <span className="text-rose-500">*</span></label>
                  <textarea
                    required
                    rows={4}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Detalla de forma clara el incidente observado, equipos involucrados e impacto operativo..."
                    className="px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500/50 transition-all duration-200"
                  />
                </div>

                {/* File Attachment / Image drag and drop */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Evidencia Fotográfica (Opcional)</label>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    {/* Drop zone / Upload input */}
                    <div className="relative border-2 border-dashed border-slate-800 hover:border-slate-700/80 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer bg-slate-950/20 hover:bg-slate-950/40 transition-all duration-200 min-h-[140px]">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleEditFileChange}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <ImageIcon className="w-8 h-8 text-slate-500" />
                      <span className="text-xs font-semibold text-slate-300">Cargar Nueva Imagen</span>
                      <span className="text-[10px] text-slate-500 text-center">Formatos permitidos: JPG, PNG. Máx 5MB</span>
                    </div>

                    {/* Image Preview Container */}
                    <div className="border border-slate-800 bg-slate-950/30 rounded-2xl min-h-[140px] flex items-center justify-center overflow-hidden p-2 relative">
                      {editImagePreview ? (
                        <>
                          <img 
                            src={editImagePreview} 
                            alt="Previsualización" 
                            className="max-h-[120px] max-w-full rounded-xl object-contain"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setEditFile(null);
                              setEditImagePreview(null);
                            }}
                            className="absolute top-2 right-2 p-1 rounded-full bg-slate-950/80 hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-slate-600 font-medium">Sin previsualización</span>
                      )}
                    </div>
                  </div>
                </div>
              </form>
            ) : (
              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                {/* Quick Info Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl border border-slate-800/50 bg-slate-950/20">
                  <div className="flex items-start gap-2.5">
                    <Building2 className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Área Afectada</span>
                      <span className="text-xs font-semibold text-white">{selectedIncident.area}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <User className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Reportante</span>
                      <span className="text-xs font-semibold text-white">{selectedIncident.user.name}</span>
                      <span className="text-[9px] text-slate-400 font-medium uppercase mt-0.5">{selectedIncident.user.role}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <Calendar className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Fecha de Reporte</span>
                      <span className="text-xs font-semibold text-white">{formatDate(selectedIncident.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Status Section & Admin Controller */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-slate-800/40 bg-slate-900/60">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0">Estado Actual:</span>
                    {getStatusBadge(selectedIncident.status)}
                  </div>

                  {/* Status Manager Dropdown (ADMIN or VERIFIER only) */}
                  {user && (user.role === 'ADMIN' || user.role === 'VERIFIER') && (
                    <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 p-1.5 rounded-xl shrink-0">
                      <span className="text-xs text-slate-400 font-bold uppercase tracking-wider pl-2 shrink-0">Acción:</span>
                      <select
                        disabled={updatingStatus}
                        value={selectedIncident.status}
                        onChange={(e) => handleStatusUpdate(selectedIncident.id, e.target.value)}
                        className="bg-slate-900 border border-slate-800/60 rounded-lg text-xs font-bold text-slate-100 py-1.5 px-3 focus:outline-none focus:ring-1 focus:ring-rose-500/50 disabled:opacity-50 transition-all cursor-pointer"
                      >
                        <option value="Pendiente">Marcar Pendiente</option>
                        <option value="En Revisión">Marcar En Revisión</option>
                        <option value="Solucionado">Marcar Solucionado</option>
                      </select>
                      {updatingStatus && <Loader2 className="w-3.5 h-3.5 text-rose-500 animate-spin mr-1.5 shrink-0" />}
                    </div>
                  )}
                </div>

                {/* Description */}
                <div className="flex flex-col gap-2">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-slate-500" />
                    Descripción del Incidente
                  </h3>
                  <div className="p-4 rounded-xl border border-slate-800/50 bg-slate-950/20 text-slate-200 text-sm whitespace-pre-wrap leading-relaxed">
                    {selectedIncident.description}
                  </div>
                </div>

                {/* Evidencia Fotográfica Image */}
                {selectedIncident.imageUrl && (
                  <div className="flex flex-col gap-2">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-slate-500" />
                      Evidencia Fotográfica de Soporte
                    </h3>
                    <div className="border border-slate-800 bg-slate-950 p-2.5 rounded-xl flex items-center justify-center overflow-hidden group/img relative max-h-[300px]">
                      <img 
                        src={selectedIncident.imageUrl} 
                        alt={selectedIncident.title} 
                        className="max-h-[280px] max-w-full rounded-lg object-contain"
                      />
                      <a 
                        href={selectedIncident.imageUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="absolute top-4 right-4 p-2 rounded-xl bg-slate-950/80 hover:bg-slate-900 text-slate-400 hover:text-white border border-slate-800/80 transition-all opacity-0 group-hover/img:opacity-100 flex items-center gap-1.5 text-xs font-semibold shadow-md"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>Pantalla Completa</span>
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="p-4 border-t border-slate-800/60 flex items-center justify-between bg-slate-900">
              {isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white font-semibold text-xs transition-all duration-200"
                  >
                    Cancelar Edición
                  </button>
                  <button
                    type="button"
                    disabled={savingEdit}
                    onClick={handleEditSubmit}
                    className="flex items-center gap-2 bg-gradient-to-r from-rose-500 to-coral-600 hover:from-rose-600 hover:to-coral-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-bold text-xs transition-all duration-200"
                  >
                    {savingEdit ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Guardando...</span>
                      </>
                    ) : (
                      <span>Guardar Cambios</span>
                    )}
                  </button>
                </>
              ) : (
                <>
                  <div>
                    {user && (user.role === 'ADMIN' || selectedIncident.userId === user.id) && (
                      <button
                        onClick={() => {
                          setEditTitle(selectedIncident.title);
                          setEditArea(selectedIncident.area);
                          setEditDescription(selectedIncident.description);
                          setEditFile(null);
                          setEditImagePreview(selectedIncident.imageUrl);
                          setIsEditing(true);
                        }}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold text-xs transition-all duration-200 shadow-md shadow-indigo-500/10"
                      >
                        Editar Reporte
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setIsDetailOpen(false);
                      setSelectedIncident(null);
                    }}
                    className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white font-bold text-sm transition-all duration-200 border border-slate-700/30 hover:border-slate-600/30"
                  >
                    Cerrar Detalle
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
