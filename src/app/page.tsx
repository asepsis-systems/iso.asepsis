'use strict';

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Folder, 
  FileText, 
  Trash2, 
  Star, 
  MoreVertical, 
  CornerDownRight,
  FolderPlus,
  Plus,
  Upload,
  ArrowRight,
  FileSpreadsheet,
  Download,
  Trash,
  RotateCcw,
  Edit3,
  FileCheck,
  Users
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import UploadZone from '@/components/UploadZone';
import FilePreview from '@/components/FilePreview';
import clsx from 'clsx';
import { useRouter } from 'next/navigation';

interface ItemNode {
  id: string;
  name: string;
  type: 'FOLDER' | 'FILE';
  mimeType?: string;
  size?: number;
  path?: string;
  isTrashed: boolean;
  isStarred: boolean;
  creator?: string | null;
  verifier1?: string | null;
  verifier2?: string | null;
  verifier3?: string | null;
  createdAt: string;
  updatedAt: string;
  parentId?: string | null;
}

interface Breadcrumb {
  id: string;
  name: string;
}

interface UserItem {
  id: string;
  username: string;
  name: string;
  role: string;
  createdAt: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; name: string; username: string; role: string } | null>(null);
  const [items, setItems] = useState<ItemNode[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [currentParentId, setCurrentParentId] = useState<string | null>(null);
  const [currentFilter, setCurrentFilter] = useState<string>('all'); // 'all' | 'recent' | 'starred' | 'trash'
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  // User Management
  const [usersList, setUsersList] = useState<UserItem[]>([]);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('CREATOR');
  const [userError, setUserError] = useState('');
  const [editUserItem, setEditUserItem] = useState<UserItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState('CREATOR');
  const [editUserError, setEditUserError] = useState('');
  
  // Modals & Overlays
  const [isDragging, setIsDragging] = useState(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renameItemId, setRenameItemId] = useState<string | null>(null);
  const [renameItemName, setRenameItemName] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Edit Details Modal
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [detailsItemId, setDetailsItemId] = useState<string | null>(null);
  const [detailsCreator, setDetailsCreator] = useState('');
  const [detailsVerifier1, setDetailsVerifier1] = useState('');
  const [detailsVerifier2, setDetailsVerifier2] = useState('');
  const [detailsVerifier3, setDetailsVerifier3] = useState('');

  // File Upload Reference
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview Modal
  const [previewFile, setPreviewFile] = useState<{
    isOpen: boolean;
    id: string;
    name: string;
    url: string;
    mimeType: string;
    size: number | null;
    creator?: string | null;
    verifier1?: string | null;
    verifier2?: string | null;
    verifier3?: string | null;
    canSign: boolean;
    canTrash: boolean;
  }>({
    isOpen: false,
    id: '',
    name: '',
    url: '',
    mimeType: '',
    size: null,
    creator: null,
    verifier1: null,
    verifier2: null,
    verifier3: null,
    canSign: false,
    canTrash: false
  });

  // Fetch Items from SQLite DB
  const loadItems = async () => {
    try {
      let url = `/api/files?filter=${currentFilter}`;
      if (currentParentId) {
        url += `&parentId=${currentParentId}`;
      } else if (currentFilter === 'all') {
        url += `&parentId=root`;
      }
      if (searchQuery) {
        url += `&search=${encodeURIComponent(searchQuery)}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      if (data.items) {
        setItems(data.items);
      }
      if (data.breadcrumbs) {
        setBreadcrumbs(data.breadcrumbs);
      } else {
        setBreadcrumbs([]);
      }
    } catch (error) {
      console.error('Error al cargar archivos:', error);
    }
  };

  // Fetch Users from SQLite DB (ADMIN only)
  const loadUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (res.ok && data.users) {
        setUsersList(data.users);
      } else {
        console.error('Error fetching users:', data.error);
      }
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
    }
  };

  // Create new user (ADMIN only)
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError('');
    if (!newUsername.trim() || !newPassword.trim() || !newName.trim() || !newRole) {
      setUserError('Todos los campos son obligatorios.');
      return;
    }

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername.trim().toLowerCase(),
          password: newPassword,
          name: newName.trim(),
          role: newRole,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setNewUsername('');
        setNewPassword('');
        setNewName('');
        setNewRole('CREATOR');
        setIsUserModalOpen(false);
        loadUsers();
      } else {
        setUserError(data.error || 'Error al crear el usuario.');
      }
    } catch (err) {
      console.error('Error al crear usuario:', err);
      setUserError('Error de red al intentar crear el usuario.');
    }
  };

  // Delete user (ADMIN only)
  const handleDeleteUser = async (targetUser: UserItem) => {
    if (!user) return;
    if (targetUser.id === user.id) {
      alert('No puedes eliminar tu propia cuenta de administrador activa.');
      return;
    }
    if (!confirm(`¿Estás seguro de que deseas eliminar al usuario "${targetUser.name}" (${targetUser.username})?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/users?id=${targetUser.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok) {
        loadUsers();
      } else {
        alert(data.error || 'Error al eliminar el usuario.');
      }
    } catch (err) {
      console.error('Error al eliminar usuario:', err);
      alert('Error de red al intentar eliminar el usuario.');
    }
  };

  // Edit user (ADMIN only)
  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditUserError('');
    if (!editUserItem) return;
    if (!editName.trim()) {
      setEditUserError('El nombre completo es obligatorio.');
      return;
    }
    if (!editUsername.trim()) {
      setEditUserError('El nombre de usuario es obligatorio.');
      return;
    }

    try {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editUserItem.id,
          name: editName.trim(),
          username: editUsername.trim().toLowerCase(),
          password: editPassword.trim() || undefined,
          role: editRole,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setEditName('');
        setEditUsername('');
        setEditPassword('');
        setEditRole('CREATOR');
        setEditUserItem(null);
        loadUsers();
      } else {
        setEditUserError(data.error || 'Error al editar el usuario.');
      }
    } catch (err) {
      console.error('Error al editar usuario:', err);
      setEditUserError('Error de red al intentar editar el usuario.');
    }
  };

  // Check active user authentication
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (res.ok && data.authenticated && data.user) {
          setUser(data.user);
        } else {
          router.push('/login');
        }
      } catch (err) {
        console.error('Error verificando autenticación:', err);
        router.push('/login');
      }
    };
    checkAuth();
  }, [router]);

  // Run initial fetch and re-fetch when filter, folder or search changes
  useEffect(() => {
    if (user) {
      if (currentFilter === 'users') {
        loadUsers();
      } else {
        loadItems();
      }
    }
  }, [currentParentId, currentFilter, searchQuery, user]);

  // Handle Logout
  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        setUser(null);
        router.push('/login');
        router.refresh();
      }
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
    }
  };

  // Click outside to close dropdown action menus
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Calculate total storage size in use
  const totalStorageUsed = items
    .filter(item => item.type === 'FILE' && !item.isTrashed && item.size)
    .reduce((sum, item) => sum + (item.size || 0), 0);

  // Create new folder
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newFolderName.trim(),
          parentId: currentParentId || 'root',
        }),
      });

      if (res.ok) {
        setNewFolderName('');
        setIsFolderModalOpen(false);
        loadItems();
      }
    } catch (err) {
      console.error('Error al crear carpeta:', err);
    }
  };

  // Upload file trigger
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    const formData = new FormData();
    formData.append('file', file);
    formData.append('parentId', currentParentId || 'root');
    if (user) {
      formData.append('creator', user.name);
    }

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        loadItems();
      }
    } catch (err) {
      console.error('Error al subir archivo:', err);
    }
  };

  // Drag and Drop events
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      await handleFileUpload(e.dataTransfer.files);
    }
  };

  // Helper: Check if current user can sign the file
  const canUserSign = (item: ItemNode) => {
    if (!user || item.type !== 'FILE' || item.isTrashed) return false;
    // Creator cannot verify
    if (item.creator === user.name) return false;
    // Cannot sign twice
    const userNormalized = user.name?.trim().toLowerCase();
    const alreadySigned = 
      item.verifier1?.trim().toLowerCase() === userNormalized || 
      item.verifier2?.trim().toLowerCase() === userNormalized || 
      item.verifier3?.trim().toLowerCase() === userNormalized;
    if (alreadySigned) return false;
    // Check if fully signed
    const signedCount = [item.verifier1, item.verifier2, item.verifier3].filter(Boolean).length;
    if (signedCount >= 3) return false;
    
    return true;
  };

  // Double click file/folder action
  const handleItemDoubleClick = (item: ItemNode) => {
    if (item.type === 'FOLDER') {
      setCurrentParentId(item.id);
      setCurrentFilter('all'); // Go to standard folder view inside folder
    } else {
      // Open preview modal
      setPreviewFile({
        isOpen: true,
        id: item.id,
        name: item.name,
        url: item.path || '',
        mimeType: item.mimeType || '',
        size: item.size || null,
        creator: item.creator || null,
        verifier1: item.verifier1 || null,
        verifier2: item.verifier2 || null,
        verifier3: item.verifier3 || null,
        canSign: canUserSign(item),
        canTrash: !item.isTrashed && user !== null && (item.creator === user.name || user.role === 'ADMIN')
      });
    }
  };

  // Star Toggle
  const toggleStar = async (item: ItemNode) => {
    try {
      const res = await fetch('/api/files', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          isStarred: !item.isStarred,
        }),
      });
      if (res.ok) {
        loadItems();
      }
    } catch (err) {
      console.error('Error toggling star:', err);
    }
  };

  // Move to trash / Restore (Soft Delete)
  const handleTrashToggle = async (item: ItemNode) => {
    try {
      const res = await fetch('/api/files', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          isTrashed: !item.isTrashed,
        }),
      });
      if (res.ok) {
        loadItems();
      }
    } catch (err) {
      console.error('Error moving to trash:', err);
    }
  };

  // Permanent Delete
  const handlePermanentDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar permanentemente este elemento? Esta acción no se puede deshacer.')) return;
    try {
      const res = await fetch(`/api/files?id=${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        loadItems();
      }
    } catch (err) {
      console.error('Error deleting permanently:', err);
    }
  };

  // Rename node
  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameItemName.trim() || !renameItemId) return;

    try {
      const res = await fetch('/api/files', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: renameItemId,
          name: renameItemName.trim(),
        }),
      });
      if (res.ok) {
        setIsRenameModalOpen(false);
        setRenameItemId(null);
        setRenameItemName('');
        loadItems();
      }
    } catch (err) {
      console.error('Error renaming:', err);
    }
  };

  // Update item details (creator/verifiers)
  const handleDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailsItemId) return;

    try {
      const res = await fetch('/api/files', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: detailsItemId,
          creator: detailsCreator.trim() || null,
          verifier1: detailsVerifier1.trim() || null,
          verifier2: detailsVerifier2.trim() || null,
          verifier3: detailsVerifier3.trim() || null,
        }),
      });
      if (res.ok) {
        setIsDetailsModalOpen(false);
        setDetailsItemId(null);
        setDetailsCreator('');
        setDetailsVerifier1('');
        setDetailsVerifier2('');
        setDetailsVerifier3('');
        loadItems();
      }
    } catch (err) {
      console.error('Error updating details:', err);
    }
  };

  // Helper: Get verification status object
  const getVerificationStatus = (item: ItemNode) => {
    if (item.type === 'FOLDER') return null;
    const count = [item.verifier1, item.verifier2, item.verifier3].filter(Boolean).length;
    if (count === 0) return { label: 'Pendiente', color: 'bg-rose-50 text-rose-600 border-rose-200', count };
    if (count < 3) return { label: `En Proceso (${count}/3)`, color: 'bg-amber-50 text-amber-600 border-amber-200', count };
    return { label: 'Aprobado', color: 'bg-emerald-50 text-emerald-600 border-emerald-200', count };
  };

  // Helper: Request signature / verification
  const handleVerifyFile = async (item: { id: string; path?: string }) => {
    try {
      const res = await fetch('/api/files/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: item.id })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Ocurrió un error al verificar el archivo.');
        return;
      }
      alert(data.message || 'Firma registrada con éxito.');
      loadItems();

      // If the preview modal is open for this file, update its verifiers and canSign flag!
      if (previewFile.isOpen && previewFile.id === item.id) {
        const updated = data.node;
        setPreviewFile(prev => ({
          ...prev,
          verifier1: updated.verifier1,
          verifier2: updated.verifier2,
          verifier3: updated.verifier3,
          canSign: false // Once signed, they cannot sign again!
        }));
      }
    } catch (err) {
      console.error('Error al firmar:', err);
      alert('Error de red al intentar verificar el archivo.');
    }
  };

  // Helper formatting for dates
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatSize = (bytes?: number) => {
    if (bytes === undefined || bytes === 0) return '-';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Get matching icon for file types
  const getFileIcon = (item: ItemNode) => {
    if (item.type === 'FOLDER') {
      return <Folder className="w-8 h-8 text-amber-400 fill-amber-400/20" />;
    }
    const ext = item.name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') {
      return <FileText className="w-8 h-8 text-red-500 fill-red-500/5" />;
    }
    if (['xlsx', 'xls', 'csv'].includes(ext || '')) {
      return <FileSpreadsheet className="w-8 h-8 text-emerald-600 fill-emerald-600/5" />;
    }
    if (['docx', 'doc'].includes(ext || '')) {
      return <FileText className="w-8 h-8 text-blue-500 fill-blue-500/5" />;
    }
    return <FileText className="w-8 h-8 text-slate-400 fill-slate-400/5" />;
  };

  return (
    <div 
      className="h-full flex overflow-hidden bg-slate-50/50"
      onDragEnter={handleDragEnter}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => handleFileUpload(e.target.files)}
        className="hidden"
      />

      {/* Upload Zone Overlay */}
      <UploadZone
        isDragging={isDragging}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      />

      {/* Sidebar (Left) */}
      <Sidebar
        currentFilter={currentFilter}
        setCurrentFilter={setCurrentFilter}
        setCurrentParentId={setCurrentParentId}
        totalStorageUsed={totalStorageUsed}
        onNewFolder={() => setIsFolderModalOpen(true)}
        onUploadClick={() => fileInputRef.current?.click()}
        user={user}
      />

      {/* Main Container (Right) */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Header Search and Toggles */}
        <Header
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          viewMode={viewMode}
          setViewMode={setViewMode}
          user={user}
          onLogout={handleLogout}
        />

        {/* Dynamic Dashboard Body */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          
          {/* Breadcrumbs Navigation Path */}
          {currentFilter === 'all' && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold mb-6 flex-wrap">
              <button 
                onClick={() => setCurrentParentId(null)}
                className="hover:text-brand-600 hover:underline transition-colors"
              >
                Mi Unidad
              </button>
              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={crumb.id}>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <button
                    onClick={() => setCurrentParentId(crumb.id)}
                    className={clsx(
                      "hover:text-brand-600 hover:underline transition-colors truncate max-w-[120px]",
                      idx === breadcrumbs.length - 1 && "text-slate-800 font-bold"
                    )}
                  >
                    {crumb.name}
                  </button>
                </React.Fragment>
              ))}
            </div>
          )}

          {/* Current view section header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-800">
              {currentFilter === 'users' ? 'Gestión de Usuarios' :
               currentFilter === 'recent' ? 'Archivos Recientes' : 
               currentFilter === 'starred' ? 'Destacados' :
               currentFilter === 'trash' ? 'Papelera de Reciclaje' : 
               currentFilter === 'pending-my-signature' ? 'Documentos por Firmar' :
               currentFilter === 'signed-by-me' ? 'Mis Firmas Registradas' :
               currentFilter === 'my-elaborated' ? 'Mis Elaboraciones' :
               currentFilter === 'my-elaborated-pending' ? 'Mis Elaboraciones En Proceso' :
               currentFilter === 'my-elaborated-approved' ? 'Mis Elaboraciones Aprobadas' :
               breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1].name : 'Mi Unidad'}
            </h2>
            {currentFilter === 'users' && (
              <button
                onClick={() => setIsUserModalOpen(true)}
                className="flex items-center gap-2 py-2 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-medium text-xs transition-all duration-300 shadow-md hover:shadow-lg hover:shadow-brand-500/10 active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" />
                <span>Nuevo Usuario</span>
              </button>
            )}
          </div>

          {/* Empty Folder / File Placeholder */}
          {currentFilter === 'users' ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-premium">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <th className="p-4 w-12 text-center">Icono</th>
                    <th className="p-4 text-slate-700 font-bold text-sm">Nombre Completo</th>
                    <th className="p-4 text-slate-700 font-bold text-sm">Nombre de Usuario</th>
                    <th className="p-4 w-32">Rol</th>
                    <th className="p-4 w-40">Fecha de Creación</th>
                    <th className="p-4 w-20 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map((u) => (
                    <tr 
                      key={u.id}
                      className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors group"
                    >
                      <td className="p-4 flex justify-center">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center group-hover:bg-brand-50 transition-colors">
                          <Users className="w-4 h-4 text-brand-500" />
                        </div>
                      </td>
                      <td className="p-4 font-bold text-slate-800 text-sm">{u.name}</td>
                      <td className="p-4 text-slate-600 font-semibold">{u.username}</td>
                      <td className="p-4">
                        <span className={clsx(
                          "px-2.5 py-1 rounded-full text-[10px] font-bold border inline-block",
                          u.role === 'ADMIN' ? "bg-purple-50 text-purple-600 border-purple-200" :
                          u.role === 'CREATOR' ? "bg-blue-50 text-blue-600 border-blue-200" :
                          "bg-amber-50 text-amber-600 border-amber-200"
                        )}>
                          {u.role === 'ADMIN' ? 'Administrador' :
                           u.role === 'CREATOR' ? 'Creador' : 'Verificador'}
                        </span>
                      </td>
                      <td className="p-4 text-slate-400 font-semibold">{formatDate(u.createdAt)}</td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              setEditUserItem(u);
                              setEditName(u.name);
                              setEditUsername(u.username);
                              setEditRole(u.role);
                              setEditPassword('');
                              setEditUserError('');
                            }}
                            className="p-1.5 rounded-xl bg-slate-50 text-slate-600 hover:bg-brand-500 hover:text-white transition-all shadow-xs border border-slate-200 flex items-center justify-center shrink-0"
                            title="Editar usuario"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {user && u.id !== user.id ? (
                            <button
                              onClick={() => handleDeleteUser(u)}
                              className="p-1.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white transition-all shadow-xs border border-rose-100 flex items-center justify-center shrink-0"
                              title="Eliminar usuario"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-semibold italic">Tú</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : items.length === 0 ? (
            <div className="h-[50vh] rounded-3xl border border-dashed border-slate-200/80 bg-white/40 backdrop-blur-xs flex flex-col items-center justify-center p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-4 shadow-inner">
                <Folder className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-slate-700 text-sm">Esta carpeta está vacía</h3>
              <p className="text-xs text-slate-400 max-w-xs mt-1">
                Suelta un archivo aquí para cargarlo o utiliza los botones de la barra lateral para comenzar.
              </p>
            </div>
          ) : (
            
            /* VIEW MODE: GRID (Cuadrícula) */
            viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
                {items.map((item) => (
                  <div
                    key={item.id}
                    onDoubleClick={() => handleItemDoubleClick(item)}
                    className="group bg-white rounded-2xl border border-slate-200/80 hover:border-brand-200 hover:shadow-premium hover:-translate-y-0.5 p-4 flex flex-col gap-3 relative transition-all duration-300 cursor-pointer select-none"
                  >
                    {/* Item action controls */}
                    <div className="flex justify-between items-start gap-1">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center shadow-inner group-hover:bg-brand-50 transition-colors">
                        {getFileIcon(item)}
                      </div>
                      
                      <div className="flex items-center gap-1">
                        {canUserSign(item) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleVerifyFile(item);
                            }}
                            className="p-1.5 rounded-lg bg-brand-50 text-brand-600 hover:bg-brand-500 hover:text-white transition-all shadow-xs border border-brand-100 flex items-center justify-center shrink-0"
                            title="Firmar / Verificar"
                          >
                            <FileCheck className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {!item.isTrashed && user && (item.creator === user.name || user.role === 'ADMIN') && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm('¿Estás seguro de que deseas mover este archivo a la papelera?')) {
                                handleTrashToggle(item);
                              }
                            }}
                            className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white transition-all shadow-xs border border-rose-100 flex items-center justify-center shrink-0"
                            title="Mover a la papelera"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        
                        {/* Dropdown Menu trigger */}
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuId(activeMenuId === item.id ? null : item.id);
                            }}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                          >
                            <MoreVertical className="w-4.5 h-4.5" />
                          </button>
                          
                          {/* Context Dropdown Menu */}
                          {activeMenuId === item.id && (
                            <div 
                              ref={menuRef}
                              className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-xl border border-slate-200/80 py-1.5 z-20 text-xs font-semibold text-slate-600 animate-in fade-in slide-in-from-top-2 duration-150"
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleItemDoubleClick(item);
                                  setActiveMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors flex items-center gap-2"
                              >
                                Open
                              </button>
                              {item.type === 'FILE' && !item.isTrashed && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleVerifyFile(item);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full text-left px-4 py-2 hover:bg-brand-50 hover:text-brand-600 text-brand-700 transition-colors flex items-center gap-2 border-b border-slate-100 font-bold"
                                >
                                  <FileCheck className="w-3.5 h-3.5 text-brand-500" />
                                  <span>Firmar / Verificar</span>
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleStar(item);
                                  setActiveMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors flex items-center gap-2"
                              >
                                <Star className={clsx("w-3.5 h-3.5", item.isStarred ? "text-amber-500 fill-amber-500" : "text-slate-400")} />
                                <span>{item.isStarred ? 'Quitar Destacado' : 'Destacar'}</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRenameItemId(item.id);
                                  setRenameItemName(item.name);
                                  setIsRenameModalOpen(true);
                                  setActiveMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors flex items-center gap-2"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                                <span>Renombrar</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDetailsItemId(item.id);
                                  setDetailsCreator(item.creator || '');
                                  setDetailsVerifier1(item.verifier1 || '');
                                  setDetailsVerifier2(item.verifier2 || '');
                                  setDetailsVerifier3(item.verifier3 || '');
                                  setIsDetailsModalOpen(true);
                                  setActiveMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors flex items-center gap-2"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                                <span>Editar Detalles</span>
                              </button>
                              {item.isTrashed ? (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleTrashToggle(item);
                                      setActiveMenuId(null);
                                    }}
                                    className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 transition-colors flex items-center gap-2"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5 text-indigo-500" />
                                    <span>Restaurar</span>
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handlePermanentDelete(item.id);
                                      setActiveMenuId(null);
                                    }}
                                    className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 transition-colors flex items-center gap-2 border-t border-slate-100"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                    <span>Eliminar para siempre</span>
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleTrashToggle(item);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 transition-colors flex items-center gap-2 border-t border-slate-100"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                  <span>Mover a papelera</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Metadata Card Footer */}
                    <div className="flex-1 flex flex-col justify-end">
                      <h4 className="font-bold text-xs text-slate-800 line-clamp-2 truncate" title={item.name}>
                        {item.name}
                      </h4>
                      {item.type === 'FILE' && (() => {
                        const status = getVerificationStatus(item);
                        if (!status) return null;
                        return (
                          <div className="mt-1">
                            <span className={clsx("px-1.5 py-0.5 rounded-md text-[9px] font-bold border inline-block", status.color)}>
                              {status.label}
                            </span>
                          </div>
                        );
                      })()}
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold mt-1">
                        <span>{item.type === 'FOLDER' ? 'Carpeta' : formatSize(item.size)}</span>
                        <span>{formatDate(item.updatedAt)}</span>
                      </div>
                    </div>

                    {/* Tiny star indicator */}
                    {item.isStarred && (
                      <div className="absolute top-2 left-2 bg-amber-400 text-white rounded-full p-0.5 shadow-sm border border-white">
                        <Star className="w-2.5 h-2.5 fill-white" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              
              /* VIEW MODE: LIST (Lista) */
              <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-premium">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                      <th className="p-4 w-12 text-center">Tipo</th>
                      <th className="p-4 text-slate-700 font-bold text-sm">Nombre</th>
                      <th className="p-4 w-28">Estado</th>
                      <th className="p-4 w-32">Fecha de Creación</th>
                      <th className="p-4 w-28">Elaborado <><br />por</></th>
                      <th className="p-4 w-24">Verificador 1</th>
                      <th className="p-4 w-24">Verificador 2</th>
                      <th className="p-4 w-24">Verificador 3</th>
                      <th className="p-4 w-24">Tamaño</th>
                      <th className="p-4 w-20 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr 
                        key={item.id}
                        onDoubleClick={() => handleItemDoubleClick(item)}
                        className="border-b border-slate-100 hover:bg-slate-50/50 cursor-pointer select-none transition-colors group"
                      >
                        <td className="p-4 flex justify-center">
                          <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center group-hover:bg-brand-50 transition-colors">
                            {getFileIcon(item)}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800 text-sm truncate max-w-xs md:max-w-md" title={item.name}>
                              {item.name}
                            </span>
                            {item.isStarred && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                          </div>
                        </td>
                        <td className="p-4">
                          {item.type === 'FILE' && (() => {
                            const status = getVerificationStatus(item);
                            if (!status) return null;
                            return (
                              <span className={clsx("px-2.5 py-1 rounded-full text-[10px] font-bold border inline-block", status.color)}>
                                {status.label}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="p-4 text-slate-400 font-semibold">{formatDate(item.createdAt)}</td>
                        <td className="p-4 text-slate-600 font-semibold truncate max-w-[120px]">{item.creator || '-'}</td>
                        <td className="p-4 text-slate-600 font-semibold truncate max-w-[120px]">{item.verifier1 || '-'}</td>
                        <td className="p-4 text-slate-600 font-semibold truncate max-w-[120px]">{item.verifier2 || '-'}</td>
                        <td className="p-4 text-slate-600 font-semibold truncate max-w-[120px]">{item.verifier3 || '-'}</td>
                        <td className="p-4 text-slate-400 font-semibold">{item.type === 'FOLDER' ? 'Carpeta' : formatSize(item.size)}</td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {canUserSign(item) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleVerifyFile(item);
                                }}
                                className="px-2.5 py-1 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-[10px] font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-1 active:scale-95 shrink-0"
                                title="Firmar / Verificar"
                              >
                                <FileCheck className="w-3.5 h-3.5" />
                                <span>Firmar</span>
                              </button>
                            )}

                            {!item.isTrashed && user && (item.creator === user.name || user.role === 'ADMIN') && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm('¿Estás seguro de que deseas mover este archivo a la papelera?')) {
                                    handleTrashToggle(item);
                                  }
                                }}
                                className="p-1.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white transition-all shadow-xs border border-rose-100 flex items-center justify-center shrink-0"
                                title="Mover a la papelera"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            
                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(activeMenuId === item.id ? null : item.id);
                                }}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                              
                              {/* List Dropdown Menu */}
                              {activeMenuId === item.id && (
                                <div 
                                  ref={menuRef}
                                  className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-xl border border-slate-200/80 py-1.5 z-20 text-xs font-semibold text-slate-600 text-left animate-in fade-in slide-in-from-top-2 duration-150"
                                >
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleItemDoubleClick(item);
                                      setActiveMenuId(null);
                                    }}
                                    className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors"
                                  >
                                    Abrir
                                  </button>
                                  {item.type === 'FILE' && !item.isTrashed && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleVerifyFile(item);
                                        setActiveMenuId(null);
                                      }}
                                      className="w-full text-left px-4 py-2 hover:bg-brand-50 hover:text-brand-600 text-brand-700 transition-colors flex items-center gap-2 border-b border-slate-100 font-bold"
                                    >
                                      <FileCheck className="w-3.5 h-3.5 text-brand-500" />
                                      <span>Firmar / Verificar</span>
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleStar(item);
                                      setActiveMenuId(null);
                                    }}
                                    className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors flex items-center gap-2"
                                  >
                                    <Star className={clsx("w-3.5 h-3.5", item.isStarred ? "text-amber-500 fill-amber-500" : "text-slate-400")} />
                                    <span>{item.isStarred ? 'Quitar Destacado' : 'Destacar'}</span>
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setRenameItemId(item.id);
                                      setRenameItemName(item.name);
                                      setIsRenameModalOpen(true);
                                      setActiveMenuId(null);
                                    }}
                                    className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors flex items-center gap-2"
                                  >
                                    <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Renombrar</span>
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDetailsItemId(item.id);
                                      setDetailsCreator(item.creator || '');
                                      setDetailsVerifier1(item.verifier1 || '');
                                      setDetailsVerifier2(item.verifier2 || '');
                                      setDetailsVerifier3(item.verifier3 || '');
                                      setIsDetailsModalOpen(true);
                                      setActiveMenuId(null);
                                    }}
                                    className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors flex items-center gap-2"
                                  >
                                    <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Editar Detalles</span>
                                  </button>
                                  {item.isTrashed ? (
                                    <>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleTrashToggle(item);
                                          setActiveMenuId(null);
                                        }}
                                        className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 transition-colors flex items-center gap-2"
                                      >
                                        <RotateCcw className="w-3.5 h-3.5 text-indigo-500" />
                                        <span>Restaurar</span>
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handlePermanentDelete(item.id);
                                          setActiveMenuId(null);
                                        }}
                                        className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 transition-colors flex items-center gap-2 border-t border-slate-100"
                                      >
                                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                        <span>Eliminar definitivamente</span>
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleTrashToggle(item);
                                        setActiveMenuId(null);
                                      }}
                                      className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 transition-colors flex items-center gap-2 border-t border-slate-100"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                      <span>Mover a papelera</span>
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

        </main>
      </div>

      {/* MODAL: Nueva Carpeta */}
      {isFolderModalOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-slate-800 text-base mb-4">Nueva Carpeta</h3>
            <form onSubmit={handleCreateFolder}>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Nombre de la carpeta"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-sm mb-4"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFolderModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 text-xs font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold transition-colors"
                >
                  Crear Carpeta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Renombrar Archivo/Carpeta */}
      {isRenameModalOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-slate-800 text-base mb-4">Renombrar Elemento</h3>
            <form onSubmit={handleRenameSubmit}>
              <input
                type="text"
                value={renameItemName}
                onChange={(e) => setRenameItemName(e.target.value)}
                placeholder="Nuevo nombre"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-sm mb-4"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsRenameModalOpen(false);
                    setRenameItemId(null);
                    setRenameItemName('');
                  }}
                  className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 text-xs font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold transition-colors"
                >
                  Guardar Nombre
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Editar Detalles (Creador / Verificadores) */}
      {isDetailsModalOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl p-6 w-full max-w-md">
            <h3 className="font-bold text-slate-800 text-base mb-4">Editar Detalles de Control</h3>
            <form onSubmit={handleDetailsSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Creador</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={detailsCreator}
                    onChange={(e) => setDetailsCreator(e.target.value)}
                    placeholder="Nombre del creador"
                    className="flex-1 px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-sm"
                  />
                  {user && (
                    <button
                      type="button"
                      onClick={() => setDetailsCreator(user.name)}
                      className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-brand-50 hover:text-brand-600 border border-slate-200 text-xs font-semibold transition-colors"
                      title="Firmar con mi usuario"
                    >
                      Firmar
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Verificador 1 (Solo lectura)</label>
                <input
                  type="text"
                  value={detailsVerifier1}
                  disabled
                  placeholder="Sin firma (firmar desde el flujo oficial)"
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-500 text-sm cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Verificador 2 (Solo lectura)</label>
                <input
                  type="text"
                  value={detailsVerifier2}
                  disabled
                  placeholder="Sin firma (firmar desde el flujo oficial)"
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-500 text-sm cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Verificador 3 (Solo lectura)</label>
                <input
                  type="text"
                  value={detailsVerifier3}
                  disabled
                  placeholder="Sin firma (firmar desde el flujo oficial)"
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-500 text-sm cursor-not-allowed"
                />
                <p className="text-[10px] text-slate-400 mt-1.5 font-medium">
                  * Las firmas de verificación son oficiales y solo se pueden registrar haciendo clic en el botón "Firmar / Verificar" del documento.
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsDetailsModalOpen(false);
                    setDetailsItemId(null);
                    setDetailsCreator('');
                    setDetailsVerifier1('');
                    setDetailsVerifier2('');
                    setDetailsVerifier3('');
                  }}
                  className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 text-xs font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold transition-colors"
                >
                  Guardar Detalles
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INTEGRATED DYNAMIC PREVIEW MODAL */}
      <FilePreview
        isOpen={previewFile.isOpen}
        onClose={() => setPreviewFile(prev => ({ ...prev, isOpen: false }))}
        fileName={previewFile.name}
        fileUrl={previewFile.url}
        mimeType={previewFile.mimeType}
        fileSize={previewFile.size}
        creator={previewFile.creator}
        verifier1={previewFile.verifier1}
        verifier2={previewFile.verifier2}
        verifier3={previewFile.verifier3}
        canSign={previewFile.canSign}
        onVerify={() => {
          const item = items.find(i => i.id === previewFile.id);
          if (item) {
            handleVerifyFile(item);
          }
        }}
        canTrash={previewFile.canTrash}
        onTrash={() => {
          const item = items.find(i => i.id === previewFile.id);
          if (item) {
            if (confirm('¿Estás seguro de que deseas mover este archivo a la papelera?')) {
              handleTrashToggle(item);
              setPreviewFile(prev => ({ ...prev, isOpen: false }));
            }
          }
        }}
      />

      {/* MODAL: Editar Usuario */}
      {editUserItem && (
        <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl p-6 w-full max-w-md">
            <h3 className="font-bold text-slate-800 text-base mb-2">Editar Usuario</h3>
            <p className="text-xs text-slate-400 mb-4">
              Editando la cuenta de: <span className="font-bold text-slate-700">{editUserItem.username}</span>
            </p>
            {editUserError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-xs font-semibold">
                {editUserError}
              </div>
            )}
            <form onSubmit={handleEditUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Nombre Completo</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Ej: Alessandro Parodi"
                  required
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Nombre de Usuario (Login)</label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  placeholder="Ej: alessandropa"
                  required
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Nueva Contraseña (Opcional)</label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Dejar en blanco para mantener la actual"
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-sm"
                />
                <p className="text-[10px] text-slate-400 mt-1 font-medium">
                  * Si no deseas cambiar la contraseña de este usuario, deja este campo vacío.
                </p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Rol en el Sistema</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-sm bg-white"
                >
                  <option value="CREATOR">Creador (Sube archivos)</option>
                  <option value="VERIFIER">Verificador (Firma y aprueba)</option>
                  <option value="ADMIN">Administrador (Gestión total)</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditUserItem(null);
                    setEditName('');
                    setEditUsername('');
                    setEditPassword('');
                    setEditRole('CREATOR');
                    setEditUserError('');
                  }}
                  className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 text-xs font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold transition-colors"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Crear Usuario */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl p-6 w-full max-w-md">
            <h3 className="font-bold text-slate-800 text-base mb-4">Crear Nuevo Usuario</h3>
            {userError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-xs font-semibold">
                {userError}
              </div>
            )}
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Nombre Completo</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  required
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Nombre de Usuario (Login)</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Ej: jperez"
                  required
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Contraseña</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Contraseña segura"
                  required
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Rol en el Sistema</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-sm bg-white"
                >
                  <option value="CREATOR">Creador (Sube archivos)</option>
                  <option value="VERIFIER">Verificador (Firma y aprueba)</option>
                  <option value="ADMIN">Administrador (Gestión total)</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsUserModalOpen(false);
                    setUserError('');
                    setNewName('');
                    setNewUsername('');
                    setNewPassword('');
                    setNewRole('CREATOR');
                  }}
                  className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 text-xs font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold transition-colors"
                >
                  Crear Usuario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
