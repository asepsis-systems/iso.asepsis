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
  ArrowLeft,
  FileSpreadsheet,
  Download,
  Trash,
  RotateCcw,
  Edit3,
  FileCheck,
  Users,
  Clock,
  UploadCloud,
  Menu,
  X,
  LogOut,
  Search
} from 'lucide-react';

import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import FilePreview from '@/components/FilePreview';
import IncidentsDashboard from '@/components/IncidentsDashboard';
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
  areaFolder?: any;
  document?: any;
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
  cargo?: string | null;
  email?: string | null;
  areaId?: string | null;
  createdAt: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; name: string; username: string; role: string; areaId?: string | null; signature?: string | null; cargo?: string | null; email?: string | null } | null>(null);
  const [items, setItems] = useState<ItemNode[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [currentParentId, setCurrentParentId] = useState<string | null>(null);
  const [currentFilter, setCurrentFilter] = useState<string>('all'); // 'all' | 'recent' | 'starred' | 'trash'
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [creatorPendingCount, setCreatorPendingCount] = useState<number>(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  const [areas, setAreas] = useState<any[]>([]);
  const [auditList, setAuditList] = useState<any[]>([]);
  const [isVerifiersModalOpen, setIsVerifiersModalOpen] = useState(false);
  const [selectedAreaForVerifiers, setSelectedAreaForVerifiers] = useState<any | null>(null);
  const [areaVerifiersState, setAreaVerifiersState] = useState<{ userId: string; signOrder: number }[]>([]);

  const loadAreas = async () => {
    try {
      const res = await fetch('/api/areas');
      const data = await res.json();
      if (res.ok && data.areas) {
        setAreas(data.areas);
      }
    } catch (err) {
      console.error('Error al cargar áreas:', err);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const res = await fetch('/api/audit');
      const data = await res.json();
      if (res.ok && data.audits) {
        setAuditList(data.audits);
      }
    } catch (error) {
      console.error('Error al cargar auditoría:', error);
    }
  };

  const currentArea = areas.find(area => 
    area.folderNodeId === currentParentId || 
    breadcrumbs.some(crumb => crumb.id === area.folderNodeId)
  );

  const canUploadHere = () => {
    if (!user) return false;
    return currentFilter === 'all';
  };

  const canDeleteNode = (item: ItemNode) => {
    if (!user) return false;
    
    // Check if the item is a main area folder
    const isMainAreaFolder = areas.some(a => a.folderNodeId === item.id);
    if (isMainAreaFolder) {
      return user.role === 'ADMIN';
    }
    
    if (user.role === 'ADMIN') return true;
    return item.creator === user.name;
  };

  const getAreaColorClasses = (colorName: string | null) => {
    switch (colorName) {
      case 'blue':
        return {
          bg: 'bg-blue-50/80 border-blue-200 hover:bg-blue-50 hover:border-blue-300',
          text: 'text-blue-600',
          icon: 'text-blue-500 fill-blue-500/10',
          badge: 'bg-blue-100 text-blue-800 border-blue-200'
        };
      case 'purple':
        return {
          bg: 'bg-purple-50/80 border-purple-200 hover:bg-purple-50 hover:border-purple-300',
          text: 'text-purple-600',
          icon: 'text-purple-500 fill-purple-500/10',
          badge: 'bg-purple-100 text-purple-800 border-purple-200'
        };
      case 'emerald':
        return {
          bg: 'bg-emerald-50/80 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300',
          text: 'text-emerald-600',
          icon: 'text-emerald-500 fill-emerald-500/10',
          badge: 'bg-emerald-100 text-emerald-800 border-emerald-200'
        };
      case 'amber':
        return {
          bg: 'bg-amber-50/80 border-amber-200 hover:bg-amber-50 hover:border-amber-300',
          text: 'text-amber-600',
          icon: 'text-amber-500 fill-amber-500/10',
          badge: 'bg-amber-100 text-amber-800 border-amber-200'
        };
      default:
        return {
          bg: 'bg-white border-slate-200/80 hover:border-brand-200',
          text: 'text-slate-800',
          icon: 'text-amber-400 fill-amber-400/20',
          badge: 'bg-slate-100 text-slate-800 border-slate-200'
        };
    }
  };

  const getVerifierSignatureStatus = (item: ItemNode, verifierUserId: string) => {
    const doc = (item as any).document;
    if (!doc || !doc.signatures) return 'PENDIENTE';
    const sig = doc.signatures.find((s: any) => s.userId === verifierUserId);
    return sig ? sig.status : 'PENDIENTE';
  };

  const handleConfigureVerifiersClick = (area: any) => {
    setSelectedAreaForVerifiers(area);
    loadUsers();
    
    const initialSlots = [
      { signOrder: 1, userId: '' },
      { signOrder: 2, userId: '' },
      { signOrder: 3, userId: '' }
    ];
    
    if (area.verifiers) {
      area.verifiers.forEach((v: any) => {
        const slot = initialSlots.find(s => s.signOrder === v.signOrder);
        if (slot) {
          slot.userId = v.userId;
        }
      });
    }
    
    setAreaVerifiersState(initialSlots);
    setIsVerifiersModalOpen(true);
  };

  const handleSaveVerifiers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAreaForVerifiers) return;
    
    const validVerifiers = areaVerifiersState.filter(v => v.userId !== '');
    if (validVerifiers.length === 0) {
      alert('Debes seleccionar al menos un verificador.');
      return;
    }
    
    try {
      const res = await fetch('/api/areas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          areaId: selectedAreaForVerifiers.id,
          verifiers: validVerifiers
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        alert('Verificadores configurados con éxito.');
        setIsVerifiersModalOpen(false);
        loadAreas();
        loadItems();
      } else {
        alert(data.error || 'Error al guardar verificadores.');
      }
    } catch (err) {
      console.error('Error saving verifiers:', err);
      alert('Error de red al intentar guardar.');
    }
  };

  useEffect(() => {
    loadAreas();
  }, []);

  // Drag and Drop States
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedId(id);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverFolderId(null);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    if (draggedId !== targetId) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleDragEnter = (targetId: string) => {
    if (draggedId !== targetId) {
      setDragOverFolderId(targetId);
    }
  };

  const handleDragLeave = (targetId: string) => {
    if (dragOverFolderId === targetId) {
      setDragOverFolderId(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault();
    setDragOverFolderId(null);
    setDraggedId(null);

    const draggedItemId = e.dataTransfer.getData('text/plain');
    if (!draggedItemId) return;
    if (draggedItemId === targetFolderId) return;

    try {
      const res = await fetch('/api/files', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: draggedItemId,
          parentId: targetFolderId === 'root' ? null : targetFolderId,
        }),
      });

      if (res.ok) {
        loadItems();
      } else {
        const data = await res.json();
        alert(data.error || 'Error al mover el elemento.');
      }
    } catch (err) {
      console.error('Error al mover elemento:', err);
      alert('Error de red al intentar mover el elemento.');
    }
  };

  const loadPendingCounts = async (currentUser?: typeof user) => {
    const activeUser = currentUser || user;
    if (!activeUser) return;

    if (activeUser.role === 'VERIFIER' || activeUser.role === 'ADMIN') {
      try {
        const res = await fetch('/api/files?filter=pending-my-signature');
        const data = await res.json();
        if (data.items) {
          setPendingCount(data.items.length);
        }
      } catch (error) {
        console.error('Error al cargar conteo de pendientes:', error);
      }
    }

    if (activeUser.role === 'CREATOR') {
      try {
        const res = await fetch('/api/files?filter=my-elaborated-pending');
        const data = await res.json();
        if (data.items) {
          setCreatorPendingCount(data.items.length);
        }
      } catch (error) {
        console.error('Error al cargar conteo de creador pendientes:', error);
      }
    }
  };

  // User Management
  const [usersList, setUsersList] = useState<UserItem[]>([]);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('CREATOR');
  const [newCargo, setNewCargo] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newAreaId, setNewAreaId] = useState('');
  const [userError, setUserError] = useState('');
  const [editUserItem, setEditUserItem] = useState<UserItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState('CREATOR');
  const [editCargo, setEditCargo] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAreaId, setEditAreaId] = useState('');
  const [editUserError, setEditUserError] = useState('');
  
  // Modals & Overlays
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
    creatorSignature?: string | null;
    verifier1Signature?: string | null;
    verifier2Signature?: string | null;
    verifier3Signature?: string | null;
    canSign: boolean;
    canTrash: boolean;
    isApproved: boolean;
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
    creatorSignature: null,
    verifier1Signature: null,
    verifier2Signature: null,
    verifier3Signature: null,
    canSign: false,
    canTrash: false,
    isApproved: false
  });

  // Profile modal states
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileSignatureFile, setProfileSignatureFile] = useState<File | null>(null);
  const [profileUploadLoading, setProfileUploadLoading] = useState(false);
  const [profileSaveLoading, setProfileSaveLoading] = useState(false);
  const [profileEmail, setProfileEmail] = useState('');
  const [profileCargo, setProfileCargo] = useState('');
  const [profileError, setProfileError] = useState('');

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
      loadPendingCounts();
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
          cargo: newCargo.trim() || undefined,
          email: newEmail.trim() || undefined,
          areaId: newAreaId || null,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setNewUsername('');
        setNewPassword('');
        setNewName('');
        setNewRole('CREATOR');
        setNewCargo('');
        setNewEmail('');
        setNewAreaId('');
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
          cargo: editCargo.trim() || null,
          email: editEmail.trim() || null,
          areaId: editAreaId || null,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setEditName('');
        setEditUsername('');
        setEditPassword('');
        setEditRole('CREATOR');
        setEditCargo('');
        setEditEmail('');
        setEditAreaId('');
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

    // Re-verify authentication on page navigation from BFcache (back/forward browser arrows)
    const handlePageShow = (event: PageTransitionEvent) => {
      checkAuth();
    };

    window.addEventListener('pageshow', handlePageShow);
    return () => {
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [router]);

  // Run initial fetch and re-fetch when filter, folder or search changes
  useEffect(() => {
    if (user) {
      if (currentFilter === 'users') {
        loadUsers();
      } else if (currentFilter === 'audit') {
        loadAuditLogs();
      } else {
        loadItems();
      }
      loadPendingCounts(user);
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
    if (!canUploadHere()) {
      alert('Solo puedes subir archivos dentro de tu área asignada.');
      return;
    }
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

  // Helper: Check if current user can sign the file
  const canUserSign = (item: ItemNode) => {
    if (!user || item.type !== 'FILE' || item.isTrashed) return false;
    
    // Get the document record
    const doc = (item as any).document;
    if (!doc) {
      // Fallback for legacy files: use old verifiers logic
      if (item.creator === user.name) return false;
      const userNormalized = user.name?.trim().toLowerCase();
      const alreadySigned = 
        item.verifier1?.trim().toLowerCase() === userNormalized || 
        item.verifier2?.trim().toLowerCase() === userNormalized || 
        item.verifier3?.trim().toLowerCase() === userNormalized;
      if (alreadySigned) return false;
      const signedCount = [item.verifier1, item.verifier2, item.verifier3].filter(Boolean).length;
      if (signedCount >= 3) return false;
      return true;
    }
    
    // Reject flow: if document is rejected or approved, nobody can sign
    if (doc.status === 'APROBADO' || doc.status === 'RECHAZADO') return false;
    
    // Find the area for this document
    const docArea = areas.find(a => a.id === doc.areaId);
    if (!docArea) return false;
    
    // Find if the current user is a verifier in this area
    const myVerifier = docArea.verifiers?.find((v: any) => v.userId === user.id);
    if (!myVerifier) return false;
    
    // Check if the current user already signed
    const mySig = doc.signatures?.find((s: any) => s.userId === user.id);
    if (mySig && mySig.status !== 'PENDIENTE') return false;
    
    // Check if previous verifiers in the order have signed (status === 'APROBADO')
    const myOrder = myVerifier.signOrder;
    for (const v of docArea.verifiers || []) {
      if (v.signOrder < myOrder) {
        const prevSig = doc.signatures?.find((s: any) => s.userId === v.userId);
        if (!prevSig || prevSig.status !== 'APROBADO') {
          return false; // A previous verifier has not approved yet
        }
      }
    }
    
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
        creatorSignature: (item as any).creatorSignature || null,
        verifier1Signature: (item as any).verifier1Signature || null,
        verifier2Signature: (item as any).verifier2Signature || null,
        verifier3Signature: (item as any).verifier3Signature || null,
        canSign: canUserSign(item),
        canTrash: !item.isTrashed && user !== null && (item.creator === user.name || user.role === 'ADMIN'),
        isApproved: item.document
          ? item.document.status === 'APROBADO'
          : (!!item.verifier1 && !!item.verifier2 && !!item.verifier3)
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
      } else {
        const data = await res.json();
        alert(data.error || 'No se pudo completar la acción.');
      }
    } catch (err) {
      console.error('Error moving to trash:', err);
      alert('Error de red al intentar mover el elemento.');
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
      } else {
        const data = await res.json();
        alert(data.error || 'No se pudo eliminar el elemento.');
      }
    } catch (err) {
      console.error('Error deleting permanently:', err);
      alert('Error de red al intentar eliminar permanentemente.');
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
  const handleVerifyFile = async (item: { id: string; path?: string }, placement?: any, annotations?: any[]) => {
    try {
      const res = await fetch('/api/files/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: item.id, placement, annotations })
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
        const isV1 = updated.verifier1 === user?.name && !previewFile.verifier1;
        const isV2 = updated.verifier2 === user?.name && !previewFile.verifier2;
        const isV3 = updated.verifier3 === user?.name && !previewFile.verifier3;

        const isApprovedNow = updated.document
          ? updated.document.status === 'APROBADO'
          : (!!updated.verifier1 && !!updated.verifier2 && !!updated.verifier3);

        setPreviewFile(prev => ({
          ...prev,
          verifier1: updated.verifier1,
          verifier2: updated.verifier2,
          verifier3: updated.verifier3,
          verifier1Signature: isV1 ? user?.signature : prev.verifier1Signature,
          verifier2Signature: isV2 ? user?.signature : prev.verifier2Signature,
          verifier3Signature: isV3 ? user?.signature : prev.verifier3Signature,
          canSign: false, // Once signed, they cannot sign again!
          isApproved: isApprovedNow
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

  const formatDateMobile = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month} ${hours}:${minutes}`;
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
      if ((item as any).areaFolder) {
        const classes = getAreaColorClasses((item as any).areaFolder.color);
        return <Folder className={clsx("w-8 h-8", classes.icon)} />;
      }
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

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center font-sans selection:bg-brand-500 selection:text-white relative overflow-hidden">
        {/* Premium background effects */}
        <div className="absolute top-[-20%] left-[-10%] w-[60%] aspect-square rounded-full bg-gradient-to-tr from-brand-600/20 to-accent-teal/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] aspect-square rounded-full bg-gradient-to-br from-indigo-700/20 to-brand-950/30 blur-[100px] pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-20 pointer-events-none" />

        <div className="flex flex-col items-center gap-4 z-10 animate-in fade-in duration-500">
          <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm font-semibold tracking-wider uppercase animate-pulse">Cargando Sistema...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="h-full flex overflow-hidden bg-slate-50/50"
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => handleFileUpload(e.target.files)}
        className="hidden"
      />

      {/* Mobile sidebar backdrop overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/60 z-30 lg:hidden animate-in fade-in duration-200"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Desktop Sidebar (Left) */}
      <div className="hidden lg:block w-64 h-full shrink-0">
        <Sidebar
          currentFilter={currentFilter}
          setCurrentFilter={setCurrentFilter}
          setCurrentParentId={setCurrentParentId}
          totalStorageUsed={totalStorageUsed}
          onNewFolder={() => {
            if (currentFilter !== 'all') {
              alert('Solo puedes crear carpetas dentro de la vista de archivos.');
              return;
            }
            setIsFolderModalOpen(true);
          }}
          onUploadClick={() => {
            if (!canUploadHere()) {
              alert('Solo puedes subir archivos dentro de la vista de archivos.');
              return;
            }
            fileInputRef.current?.click();
          }}
          user={user}
          pendingCount={pendingCount}
          creatorPendingCount={creatorPendingCount}
        />
      </div>

      {/* Mobile Sidebar Drawer (Left) */}
      <div className={clsx(
        "lg:hidden fixed inset-y-0 left-0 h-full w-64 z-40 transform transition-transform duration-300 ease-in-out shrink-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <Sidebar
          currentFilter={currentFilter}
          setCurrentFilter={setCurrentFilter}
          setCurrentParentId={setCurrentParentId}
          totalStorageUsed={totalStorageUsed}
          onNewFolder={() => {
            if (currentFilter !== 'all') {
              alert('Solo puedes crear carpetas dentro de la vista de archivos.');
              return;
            }
            setIsFolderModalOpen(true);
          }}
          onUploadClick={() => {
            if (!canUploadHere()) {
              alert('Solo puedes subir archivos dentro de la vista de archivos.');
              return;
            }
            fileInputRef.current?.click();
          }}
          user={user}
          pendingCount={pendingCount}
          creatorPendingCount={creatorPendingCount}
          onClose={() => setIsSidebarOpen(false)}
        />
      </div>

      {/* Main Container (Right) */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden w-full">
        
        {/* Header Search and Toggles */}
        <Header
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          viewMode={viewMode}
          setViewMode={setViewMode}
          user={user}
          onLogout={handleLogout}
          onProfileClick={() => {
            if (user) {
              setProfileEmail(user.email || '');
              setProfileCargo(user.cargo || '');
            }
            setIsProfileModalOpen(true);
          }}
          onMenuClick={() => setIsSidebarOpen(true)}
        />

        {/* MOBILE TOP DARK NAVY CARD HEADER (lg:hidden) */}
        <div className="lg:hidden bg-slate-950 p-4 pb-6 rounded-b-[2.5rem] shadow-xl relative shrink-0 border-b border-slate-850">
          {/* Top Row: Hamburger, Logo/Brand, Logout */}
          <div className="flex items-center justify-between gap-4 mb-5">
            {/* Hamburger Toggle */}
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 bg-slate-900 border border-slate-800/80 rounded-xl text-slate-300 active:scale-95 hover:text-white hover:bg-slate-800 transition-all shrink-0"
              title="Menú"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Brand Logo & Name */}
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800/60 px-3.5 py-1.5 rounded-2xl shadow-inner max-w-full">
              <span className="text-[10px] tracking-wider uppercase font-black text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-lg border border-brand-500/15 truncate shrink-0">
                T&CH ASEPSIS
              </span>
              <span className="text-white text-xs font-black tracking-tight shrink-0">ISO-ASEPSIS</span>
            </div>

            {/* Logout Button */}
            <button 
              onClick={handleLogout}
              className="p-2 bg-slate-900 border border-slate-800/80 rounded-xl text-slate-400 active:scale-95 hover:text-rose-400 hover:bg-rose-950/20 transition-all shrink-0"
              title="Cerrar Sesión"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>

          {/* Bottom Row: Primary Action Buttons */}
          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => {
                if (!canUploadHere()) {
                  alert('Solo puedes subir archivos dentro de la vista de archivos.');
                  return;
                }
                fileInputRef.current?.click();
              }}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-brand-500 via-brand-600 to-indigo-600 text-white font-bold text-xs shadow-lg shadow-brand-500/15 hover:shadow-xl transition-all active:scale-[0.98] duration-200 flex items-center justify-center gap-2"
            >
              <Upload className="w-3.5 h-3.5 text-white animate-pulse" />
              <span>Subir Archivo</span>
            </button>
            
            <button
              onClick={() => {
                if (currentFilter !== 'all') {
                  alert('Solo puedes crear carpetas dentro de la vista de archivos.');
                  return;
                }
                setIsFolderModalOpen(true);
              }}
              className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-xs border border-slate-800/80 transition-all active:scale-[0.98] duration-200 flex items-center justify-center gap-2"
            >
              <FolderPlus className="w-3.5 h-3.5 text-slate-400" />
              <span>Nueva Carpeta</span>
            </button>
          </div>
        </div>

        {/* Dynamic Dashboard Body */}
        {currentFilter === 'incidents' ? (
          <IncidentsDashboard user={user} />
        ) : (
          <main className="flex-1 overflow-y-auto p-4 md:p-8 w-full min-w-0">
          
          {/* Mobile Search Input (lg:hidden) */}
          {currentFilter !== 'users' && currentFilter !== 'audit' && (
            <div className="lg:hidden mb-6 relative">
              <input
                type="text"
                placeholder="Buscar en Mi Unidad..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200/80 rounded-2xl shadow-sm text-xs font-semibold placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-800 transition-all"
              />
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 active:scale-90 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
          
          {/* Breadcrumbs Navigation Path */}
          {currentFilter === 'all' && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold mb-6 flex-wrap">
              {currentParentId !== null && (
                <button
                  onClick={() => {
                    if (breadcrumbs.length <= 1) {
                      setCurrentParentId(null);
                    } else {
                      setCurrentParentId(breadcrumbs[breadcrumbs.length - 2].id);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-md hover:shadow-lg mr-2 text-[11px] font-bold active:scale-95 duration-200 border border-transparent"
                  title="Retroceder"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-white" />
                  <span>Atrás</span>
                </button>
              )}
              <button 
                onClick={() => setCurrentParentId(null)}
                onDragOver={(e) => handleDragOver(e, 'root')}
                onDragEnter={() => handleDragEnter('root')}
                onDragLeave={() => handleDragLeave('root')}
                onDrop={(e) => handleDrop(e, 'root')}
                className={clsx(
                  "hover:text-brand-600 hover:underline transition-all duration-200 px-2 py-1 rounded-lg border border-transparent",
                  dragOverFolderId === 'root' && "bg-brand-50 border-brand-300 text-brand-600 shadow-sm"
                )}
              >
                Mi Unidad
              </button>
              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={crumb.id}>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <button
                    onClick={() => setCurrentParentId(crumb.id)}
                    onDragOver={(e) => handleDragOver(e, crumb.id)}
                    onDragEnter={() => handleDragEnter(crumb.id)}
                    onDragLeave={() => handleDragLeave(crumb.id)}
                    onDrop={(e) => handleDrop(e, crumb.id)}
                    className={clsx(
                      "hover:text-brand-600 hover:underline transition-all duration-200 truncate max-w-[120px] px-2 py-1 rounded-lg border border-transparent",
                      idx === breadcrumbs.length - 1 && "text-slate-800 font-bold",
                      dragOverFolderId === crumb.id && "bg-brand-50 border-brand-300 text-brand-600 shadow-sm"
                    )}
                  >
                    {crumb.name}
                  </button>
                </React.Fragment>
              ))}
            </div>
          )}

          {/* Pending signatures alert banner */}
          {user && (user.role === 'VERIFIER' || user.role === 'ADMIN') && pendingCount > 0 && currentFilter !== 'pending-my-signature' && (
            <div className="mb-6 p-4 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent rounded-2xl border border-amber-500/25 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in backdrop-blur-xs">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-500/30 text-amber-500 shrink-0">
                  <Clock className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-amber-800">Tienes firmas pendientes</h4>
                  <p className="text-xs text-amber-700/80 mt-0.5">
                    Hay <strong>{pendingCount} {pendingCount === 1 ? 'documento que requiere' : 'documentos que requieren'}</strong> tu firma y aprobación en el sistema.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setCurrentFilter('pending-my-signature');
                  setCurrentParentId(null);
                }}
                className="self-start sm:self-center px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-amber-500/10 active:scale-95 shrink-0"
              >
                Ver pendientes →
              </button>
            </div>
          )}

          {user && user.role === 'CREATOR' && creatorPendingCount > 0 && currentFilter !== 'my-elaborated-pending' && (
            <div className="mb-6 p-4 bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-transparent rounded-2xl border border-blue-500/25 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in backdrop-blur-xs">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30 text-brand-400 shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-700">Documentos en proceso</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Tienes <strong>{creatorPendingCount} {creatorPendingCount === 1 ? 'documento' : 'documentos'}</strong> en proceso de firmas por parte de los verificadores.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setCurrentFilter('my-elaborated-pending');
                  setCurrentParentId(null);
                }}
                className="self-start sm:self-center px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 shrink-0"
              >
                Ver estado →
              </button>
            </div>
          )}

          {/* Current view section header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-800">
              {currentFilter === 'users' ? 'Gestión de Usuarios' :
               currentFilter === 'audit' ? 'Auditoría de Acciones' :
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
                    <th className="p-4 text-slate-700 font-bold text-sm">Cargo</th>
                    <th className="p-4 text-slate-700 font-bold text-sm">Correo Electrónico</th>
                    <th className="p-4 text-slate-700 font-bold text-sm">Área de Trabajo</th>
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
                      <td className="p-4 text-center align-middle">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center group-hover:bg-brand-50 transition-colors mx-auto">
                          <Users className="w-4 h-4 text-brand-500" />
                        </div>
                      </td>
                      <td className="p-4 font-bold text-slate-800 text-sm">{u.name}</td>
                      <td className="p-4 text-slate-600 font-semibold">{u.username}</td>
                      <td className="p-4 text-slate-600 font-semibold">{u.cargo || <span className="text-slate-400 italic">No asignado</span>}</td>
                      <td className="p-4 text-slate-600 font-semibold">{u.email || <span className="text-slate-400 italic">No asignado</span>}</td>
                      <td className="p-4 text-slate-600 font-semibold">
                        {areas.find(a => a.id === u.areaId)?.name || <span className="text-slate-400 italic">General</span>}
                      </td>
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
                              setEditCargo(u.cargo || '');
                              setEditEmail(u.email || '');
                              setEditAreaId(u.areaId || '');
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
          ) : currentFilter === 'audit' ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-premium">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <th className="p-4 w-44 text-slate-700 font-bold text-sm">Fecha/Hora</th>
                    <th className="p-4 w-36 text-slate-700 font-bold text-sm">Usuario</th>
                    <th className="p-4 w-52 text-slate-700 font-bold text-sm">Acción</th>
                    <th className="p-4 text-slate-700 font-bold text-sm">Detalles</th>
                  </tr>
                </thead>
                <tbody>
                  {auditList.map((log) => (
                    <tr 
                      key={log.id}
                      className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="p-4 text-slate-400 font-semibold">{new Date(log.createdAt).toLocaleString('es-ES')}</td>
                      <td className="p-4 font-bold text-slate-800 text-sm">{log.username}</td>
                      <td className="p-4">
                        <span className={clsx(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold border inline-block uppercase",
                          log.action.includes('VERIFY') || log.action.includes('APROBADO') || log.action.includes('FIRMA') ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
                          log.action.includes('RECHAZADO') || log.action.includes('ELIMINAR') || log.action.includes('DELETE') ? "bg-rose-50 text-rose-600 border-rose-200" :
                          "bg-blue-50 text-blue-600 border-blue-200"
                        )}>
                          {log.action}
                        </span>
                      </td>
                      <td className="p-4 text-slate-600 font-medium">
                        {(() => {
                          try {
                            const parsed = JSON.parse(log.detail);
                            if (parsed && typeof parsed === 'object') {
                              return (
                                <div className="flex flex-col gap-1.5 bg-slate-50 border border-slate-100 p-3 rounded-xl max-w-lg shadow-xs">
                                  <div className="font-semibold text-slate-800 text-sm">{parsed.message || 'Firma procesada.'}</div>
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-500 font-medium mt-1">
                                    {parsed.documentName && (
                                      <div>
                                        <span className="text-slate-400 font-semibold">Documento:</span> {parsed.documentName}
                                      </div>
                                    )}
                                    {parsed.ip && (
                                      <div>
                                        <span className="text-slate-400 font-semibold">Dirección IP:</span> {parsed.ip}
                                      </div>
                                    )}
                                    {parsed.status && (
                                      <div>
                                        <span className="text-slate-400 font-semibold">Estado:</span>{' '}
                                        <span className={clsx(
                                          "px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase inline-block",
                                          parsed.status === 'APROBADO' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                          parsed.status === 'RECHAZADO' ? "bg-rose-50 text-rose-600 border-rose-100" :
                                          "bg-amber-50 text-amber-600 border-amber-100"
                                        )}>
                                          {parsed.status}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  {parsed.sha256 && (
                                    <div className="text-[10px] text-slate-500 border-t border-slate-200/60 pt-1.5 mt-1">
                                      <span className="text-slate-400 font-bold block mb-0.5">HASH SHA-256:</span>
                                      <code className="bg-slate-100/80 border border-slate-200/50 px-1.5 py-0.5 rounded text-[9.5px] text-slate-600 font-mono break-all block">
                                        {parsed.sha256}
                                      </code>
                                    </div>
                                  )}
                                </div>
                              );
                            }
                          } catch (e) {
                            // Ignorar error de parseo y renderizar normal
                          }
                          return log.detail;
                        })()}
                      </td>
                    </tr>
                  ))}
                  {auditList.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-400">
                        No hay registros de auditoría disponibles.
                      </td>
                    </tr>
                  )}
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
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-5">
                {items.map((item) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, item.id)}
                    onDragEnd={handleDragEnd}
                    onDragOver={item.type === 'FOLDER' ? (e) => handleDragOver(e, item.id) : undefined}
                    onDragEnter={item.type === 'FOLDER' ? () => handleDragEnter(item.id) : undefined}
                    onDragLeave={item.type === 'FOLDER' ? () => handleDragLeave(item.id) : undefined}
                    onDrop={item.type === 'FOLDER' ? (e) => handleDrop(e, item.id) : undefined}
                    onDoubleClick={() => handleItemDoubleClick(item)}
                    className={clsx(
                      "group rounded-2xl border hover:shadow-premium hover:-translate-y-0.5 p-3 md:p-4 flex flex-col gap-3 relative transition-all duration-300 cursor-pointer select-none",
                      dragOverFolderId === item.id 
                        ? "border-brand-500 bg-brand-50/50 scale-[1.02] shadow-md ring-2 ring-brand-500/20" 
                        : item.type === 'FOLDER' && item.areaFolder
                          ? getAreaColorClasses((item.areaFolder as any).color).bg
                          : "bg-white border-slate-200/80 hover:border-brand-200"
                    )}
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
                              handleItemDoubleClick(item);
                            }}
                            className="p-1.5 rounded-lg bg-brand-50 text-brand-600 hover:bg-brand-500 hover:text-white transition-all shadow-xs border border-brand-100 flex items-center justify-center shrink-0"
                            title="Firmar / Verificar"
                          >
                            <FileCheck className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {!item.isTrashed && canDeleteNode(item) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(item.type === 'FOLDER' ? '¿Estás seguro de que deseas mover esta carpeta a la papelera?' : '¿Estás seguro de que deseas mover este archivo a la papelera?')) {
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
                                    handleItemDoubleClick(item);
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
                              {item.type === 'FOLDER' && item.areaFolder && user?.role === 'ADMIN' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleConfigureVerifiersClick(item.areaFolder);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full text-left px-4 py-2 hover:bg-brand-50 hover:text-brand-600 text-brand-700 font-bold transition-colors flex items-center gap-2 border-b border-slate-100"
                                >
                                  <Users className="w-3.5 h-3.5 text-brand-500" />
                                  <span>Configurar Verificadores</span>
                                </button>
                              )}
                              {canDeleteNode(item) && (
                                item.isTrashed ? (
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
                                )
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Metadata Card Footer */}
                    <div className="flex-1 flex flex-col justify-end">
                      <h4 className={clsx(
                        "font-bold text-xs line-clamp-2 truncate",
                        item.type === 'FOLDER' && item.areaFolder 
                          ? getAreaColorClasses((item.areaFolder as any).color).text 
                          : "text-slate-800"
                      )} title={item.name}>
                        {item.name}
                      </h4>
                      {item.type === 'FOLDER' && item.areaFolder && (
                        <div className="mt-1">
                          <span className={clsx("px-1.5 py-0.5 rounded-md text-[9px] font-bold border inline-block", getAreaColorClasses((item.areaFolder as any).color).badge)}>
                            Carpeta de Área
                          </span>
                        </div>
                      )}
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
                  <>
                    {/* Desktop List Mode (>= lg) */}
                    <div className="hidden lg:block bg-white rounded-2xl border border-slate-200/80 shadow-premium overflow-hidden">
                      <div className="overflow-x-auto w-full min-h-[300px]">
                        <table className="w-full min-w-[900px] text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                              <th className="p-4 w-12 text-center rounded-tl-2xl">Tipo</th>
                              <th className="p-4 text-slate-700 font-bold text-sm">Nombre</th>
                              <th className="p-4 w-28">Estado</th>
                              <th className="p-4 w-32">Fecha de Creación</th>
                              <th className="p-4 w-28">Elaborado <><br />por</></th>
                              {currentArea ? (
                                <th className="p-4 w-48 text-slate-700 font-bold text-sm">Flujo de Firmas ({currentArea.name})</th>
                              ) : (
                                <>
                                  <th className="p-4 w-24">Verificador 1</th>
                                  <th className="p-4 w-24">Verificador 2</th>
                                  <th className="p-4 w-24">Verificador 3</th>
                                </>
                              )}
                              <th className="p-4 w-24">Tamaño</th>
                              <th className="p-4 w-20 text-center rounded-tr-2xl">Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((item, index) => (
                              <tr 
                                key={item.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, item.id)}
                                onDragEnd={handleDragEnd}
                                onDragOver={item.type === 'FOLDER' ? (e) => handleDragOver(e, item.id) : undefined}
                                onDragEnter={item.type === 'FOLDER' ? () => handleDragEnter(item.id) : undefined}
                                onDragLeave={item.type === 'FOLDER' ? () => handleDragLeave(item.id) : undefined}
                                onDrop={item.type === 'FOLDER' ? (e) => handleDrop(e, item.id) : undefined}
                                onDoubleClick={() => handleItemDoubleClick(item)}
                                className={clsx(
                                  "border-b cursor-pointer select-none transition-all duration-200 group",
                                  dragOverFolderId === item.id 
                                    ? "bg-brand-50 border-brand-300 shadow-inner font-semibold" 
                                    : item.type === 'FOLDER' && item.areaFolder
                                      ? getAreaColorClasses((item.areaFolder as any).color).bg.split(' ')[0] + " border-slate-100 hover:bg-slate-50/50"
                                      : "border-slate-100 hover:bg-slate-50/50"
                                )}
                              >
                                <td className="p-4 text-center align-middle">
                                  <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center group-hover:bg-brand-50 transition-colors mx-auto">
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
                                {currentArea ? (
                                  <td className="p-4">
                                    {item.type === 'FILE' && (
                                      <div className="flex flex-col gap-1">
                                        {currentArea.verifiers.map((v: any) => {
                                          const status = getVerifierSignatureStatus(item, v.userId);
                                          return (
                                            <div key={v.id} className="flex items-center gap-1.5">
                                              <span className={clsx(
                                                "w-2 h-2 rounded-full shrink-0",
                                                status === 'APROBADO' ? "bg-emerald-500" :
                                                status === 'RECHAZADO' ? "bg-rose-500" : "bg-slate-300"
                                              )} />
                                              <span className={clsx(
                                                "text-[10px] font-bold tracking-tight",
                                                status === 'APROBADO' ? "text-emerald-600" :
                                                status === 'RECHAZADO' ? "text-rose-600" : "text-slate-500"
                                              )}>
                                                {v.user.name}
                                              </span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </td>
                                ) : (
                                  <>
                                    <td className="p-4">
                                      <span className="text-slate-600 font-semibold">{item.verifier1 || '-'}</span>
                                    </td>
                                    <td className="p-4">
                                      <span className="text-slate-600 font-semibold">{item.verifier2 || '-'}</span>
                                    </td>
                                    <td className="p-4">
                                      <span className="text-slate-600 font-semibold">{item.verifier3 || '-'}</span>
                                    </td>
                                  </>
                                )}
                                <td className="p-4 text-slate-400 font-semibold">{item.type === 'FOLDER' ? 'Carpeta' : formatSize(item.size)}</td>
                                <td className="p-4 text-center">
                                  <div className="relative inline-block text-left">
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveMenuId(activeMenuId === item.id ? null : item.id);
                                      }}
                                      className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 ml-auto transition-colors"
                                    >
                                      <MoreVertical className="w-4 h-4" />
                                    </button>
                                    
                                    {/* List Dropdown Menu */}
                                    {activeMenuId === item.id && (
                                      <div 
                                        ref={menuRef}
                                        className={clsx(
                                          "absolute right-0 w-44 bg-white rounded-xl shadow-xl border border-slate-200/80 py-1.5 z-20 text-xs font-semibold text-slate-600 text-left animate-in fade-in duration-150",
                                          (index === items.length - 1 && items.length > 1)
                                            ? "bottom-full mb-1 slide-in-from-bottom-2"
                                            : "mt-1 slide-in-from-top-2"
                                        )}
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
                                              handleItemDoubleClick(item);
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
                                        {canDeleteNode(item) && (
                                          item.isTrashed ? (
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
                                          )
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Mobile List Mode (< lg) */}
                    <div className="lg:hidden flex flex-col gap-3.5">
                      <div className="flex items-center justify-between text-xs text-slate-400 font-bold px-1.5 uppercase tracking-wider">
                        <span>Tipo</span>
                        <span>Nombre</span>
                      </div>
                      {items.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => handleItemDoubleClick(item)}
                          className={clsx(
                            "p-4 rounded-2xl border flex items-center justify-between gap-3 active:scale-[0.99] transition-all bg-white shadow-xs",
                            item.type === 'FOLDER' && item.areaFolder
                              ? getAreaColorClasses((item.areaFolder as any).color).bg.split(' ')[0] + " border-slate-100"
                              : "border-slate-100/80"
                          )}
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            {/* Icon */}
                            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm bg-slate-50 border border-slate-100">
                              {getFileIcon(item)}
                            </div>
                            {/* Title & Metadata */}
                            <div className="min-w-0">
                              <h4 className="font-bold text-slate-800 text-sm truncate pr-1">
                                {item.name}
                              </h4>
                              <p className="text-[11px] text-slate-400 font-semibold mt-0.5 truncate">
                                {item.type === 'FOLDER' ? 'Carpeta' : formatSize(item.size)} • {formatDate(item.updatedAt)}
                              </p>
                            </div>
                          </div>
                          
                          {/* Actions/Star/Verification */}
                          <div className="flex items-center gap-2 shrink-0">
                            {item.isStarred && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                            {/* Menu / Actions Button */}
                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(activeMenuId === item.id ? null : item.id);
                                }}
                                className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 hover:bg-slate-100 flex items-center justify-center text-slate-500 active:scale-95 transition-all"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                              
                              {/* Dropdown menu for mobile rows */}
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
                                        handleItemDoubleClick(item);
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
                                  {canDeleteNode(item) && (
                                    item.isTrashed ? (
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
                                    )
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )
              )}

          </main>
        )}
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
        creatorSignature={previewFile.creatorSignature}
        verifier1Signature={previewFile.verifier1Signature}
        verifier2Signature={previewFile.verifier2Signature}
        verifier3Signature={previewFile.verifier3Signature}
        canSign={previewFile.canSign}
        isApproved={previewFile.isApproved}
        currentUserName={user?.name}
        currentUserSignature={user?.signature}
        onVerify={(placement, annotations) => {
          const item = items.find(i => i.id === previewFile.id);
          if (item) {
            handleVerifyFile(item, placement, annotations);
          }
        }}
        onRemoveVerify={async () => {
          if (!confirm('¿Estás seguro de que deseas remover tu firma de este documento?')) return;
          try {
            const res = await fetch('/api/files/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fileId: previewFile.id, action: 'remove' })
            });
            const data = await res.json();
            if (!res.ok) {
              alert(data.error || 'Ocurrió un error al remover tu firma.');
              return;
            }
            alert(data.message || 'Tu firma ha sido removida con éxito.');
            loadItems();
            
            // Update previewFile state so the visual UI gets updated instantly
            setPreviewFile(prev => ({
              ...prev,
              verifier1: data.node.verifier1,
              verifier2: data.node.verifier2,
              verifier3: data.node.verifier3,
              canSign: true, // Allow signing again
              isApproved: false
            }));
          } catch (err) {
            console.error('Error al remover firma:', err);
            alert('Error de red al intentar remover tu firma.');
          }
        }}
        onReject={async () => {
          if (!confirm('¿Estás seguro de que deseas rechazar este documento?')) return;
          try {
            const res = await fetch('/api/files/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fileId: previewFile.id, action: 'reject' })
            });
            const data = await res.json();
            if (!res.ok) {
              alert(data.error || 'Ocurrió un error al rechazar el archivo.');
              return;
            }
            alert(data.message || 'El documento ha sido rechazado con éxito.');
            loadItems();
            setPreviewFile(prev => ({ ...prev, isOpen: false }));
          } catch (err) {
            console.error('Error al rechazar:', err);
            alert('Error de red al intentar rechazar el archivo.');
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
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Cargo Profesional</label>
                <input
                  type="text"
                  value={editCargo}
                  onChange={(e) => setEditCargo(e.target.value)}
                  placeholder="Ej: Gerente de Operaciones / Jefe de Control"
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Correo Electrónico</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="Ej: usuario@asepsis.pe"
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Área de Trabajo</label>
                <select
                  value={editAreaId}
                  onChange={(e) => setEditAreaId(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-sm bg-white"
                >
                  <option value="">Sin área asignada / General</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
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
                    setEditCargo('');
                    setEditEmail('');
                    setEditAreaId('');
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
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Cargo Profesional</label>
                <input
                  type="text"
                  value={newCargo}
                  onChange={(e) => setNewCargo(e.target.value)}
                  placeholder="Ej: Asistente Administrativo / Jefe de Logística"
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Correo Electrónico</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Ej: nuevo.usuario@asepsis.pe"
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Área de Trabajo</label>
                <select
                  value={newAreaId}
                  onChange={(e) => setNewAreaId(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-sm bg-white"
                >
                  <option value="">Sin área asignada / General</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
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
                    setNewCargo('');
                    setNewEmail('');
                    setNewAreaId('');
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
      {/* MODAL: Configuración de Perfil / Firma Digital */}
      {isProfileModalOpen && user && (
        <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-base">Mi Perfil y Firma Digital</h3>
              <button 
                onClick={() => {
                  setIsProfileModalOpen(false);
                  setProfileSignatureFile(null);
                  setProfileError('');
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>
            
            {profileError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-xs font-semibold">
                {profileError}
              </div>
            )}

            <div className="space-y-4">
              {/* Información de Perfil Editable */}
              <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <h4 className="text-xs font-bold text-slate-700">Mi Información</h4>
                <div className="space-y-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Nombre Completo</label>
                    <div className="text-xs text-slate-800 font-semibold bg-slate-200/50 p-2.5 rounded-xl border border-slate-100">
                      {user.name}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Nombre de Usuario</label>
                    <div className="text-xs text-slate-800 font-semibold font-mono bg-slate-200/50 p-2.5 rounded-xl border border-slate-100">
                      {user.username}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Correo Electrónico</label>
                    <input
                      type="email"
                      value={profileEmail}
                      onChange={(e) => setProfileEmail(e.target.value)}
                      placeholder="ejemplo@asepsis.pe"
                      className="w-full text-xs text-slate-800 font-semibold bg-white p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Cargo Profesional</label>
                    <input
                      type="text"
                      value={profileCargo}
                      onChange={(e) => setProfileCargo(e.target.value)}
                      placeholder="Gerente, Analista, etc."
                      className="w-full text-xs text-slate-800 font-semibold bg-white p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-brand-500"
                    />
                  </div>

                  <div className="flex justify-between text-xs font-semibold pt-1">
                    <span className="text-slate-400">Área de Trabajo:</span>
                    <span className="text-slate-800">
                      {areas.find(a => a.id === user.areaId)?.name || 'General / Global'}
                    </span>
                  </div>

                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-400">Rol asignado:</span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border bg-brand-50 text-brand-600 border-brand-200 uppercase">
                      {user.role === 'ADMIN' ? 'Administrador' : user.role === 'CREATOR' ? 'Creador' : 'Verificador'}
                    </span>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    disabled={profileSaveLoading}
                    onClick={async () => {
                      setProfileSaveLoading(true);
                      setProfileError('');
                      try {
                        const res = await fetch('/api/users', {
                          method: 'PUT',
                          headers: {
                            'Content-Type': 'application/json'
                          },
                          body: JSON.stringify({
                            id: user.id,
                            email: profileEmail,
                            cargo: profileCargo
                          })
                        });
                        const data = await res.json();
                        if (res.ok) {
                          // Update local user state
                          setUser(prev => prev ? { ...prev, email: data.user.email, cargo: data.user.cargo } : null);
                          alert('Información de perfil actualizada con éxito.');
                          loadItems();
                        } else {
                          setProfileError(data.error || 'Error al guardar el perfil.');
                        }
                      } catch (err) {
                        console.error('Error saving profile:', err);
                        setProfileError('Error de red al guardar el perfil.');
                      } finally {
                        setProfileSaveLoading(false);
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold transition-colors flex items-center gap-1.5"
                  >
                    {profileSaveLoading ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Guardando...</span>
                      </>
                    ) : (
                      <span>Guardar Datos</span>
                    )}
                  </button>
                </div>
              </div>

              {/* Signature Upload / Dropzone */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">Mi Firma</label>
                
                {user.signature && !profileSignatureFile && (
                  <div className="mb-3 p-3 bg-white rounded-2xl border border-slate-200/60 shadow-inner flex flex-col items-center justify-center relative group">
                    <img 
                      src={user.signature} 
                      alt="Mi firma" 
                      className="max-h-16 object-contain mix-blend-multiply" 
                    />
                    <span className="text-[9px] text-slate-400 font-semibold mt-1">Firma activa</span>
                  </div>
                )}

                <div className="border border-dashed border-slate-300 rounded-2xl p-4 text-center bg-slate-50/50 hover:bg-slate-50 transition-all cursor-pointer relative">
                  <input
                    type="file"
                    accept="image/png"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        const selectedFile = e.target.files[0];
                        const ext = selectedFile.name.split('.').pop()?.toLowerCase();
                        if (ext !== 'png') {
                          alert('Error: Solo se permiten firmas en formato PNG con fondo transparente.');
                          e.target.value = ''; // Reset input
                          setProfileSignatureFile(null);
                          return;
                        }
                        setProfileSignatureFile(selectedFile);
                      }
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <UploadCloud className="w-8 h-8 text-slate-400" />
                    {profileSignatureFile ? (
                      <div>
                        <p className="text-xs font-bold text-brand-600 truncate max-w-[200px]">{profileSignatureFile.name}</p>
                        <p className="text-[9px] text-slate-400 font-semibold">({(profileSignatureFile.size / 1024).toFixed(1)} KB)</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs font-bold text-slate-600">Sube tu firma</p>
                        <p className="text-[9px] text-slate-400 font-medium mt-0.5">Solo formato PNG con fondo transparente</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileModalOpen(false);
                    setProfileSignatureFile(null);
                    setProfileError('');
                  }}
                  className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 text-xs font-semibold transition-colors"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  disabled={!profileSignatureFile || profileUploadLoading}
                  onClick={async () => {
                    if (!profileSignatureFile) return;
                    setProfileUploadLoading(true);
                    setProfileError('');

                    const formData = new FormData();
                    formData.append('file', profileSignatureFile);

                    try {
                      const res = await fetch('/api/users/signature', {
                        method: 'POST',
                        body: formData
                      });
                      const data = await res.json();
                      if (res.ok) {
                        // Update local user state
                        setUser(prev => prev ? { ...prev, signature: data.user.signature } : null);
                        setProfileSignatureFile(null);
                        alert('Firma digital actualizada con éxito.');
                        // Reload items to enrich signatures in view
                        loadItems();
                      } else {
                        setProfileError(data.error || 'Error al subir la firma.');
                      }
                    } catch (err) {
                      console.error('Error uploading signature:', err);
                      setProfileError('Error de red al subir la firma.');
                    } finally {
                      setProfileUploadLoading(false);
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  {profileUploadLoading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Subiendo...</span>
                    </>
                  ) : (
                    <span>Guardar Firma</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Configurar Verificadores de Área */}
      {isVerifiersModalOpen && selectedAreaForVerifiers && (
        <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-base">
                Verificadores: {selectedAreaForVerifiers.name}
              </h3>
              <button 
                onClick={() => setIsVerifiersModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleSaveVerifiers} className="space-y-4">
              <p className="text-xs text-slate-400 font-medium">
                Configura el orden secuencial de las firmas de aprobación (1 → 2 → 3).
              </p>
              
              {[1, 2, 3].map((order) => {
                const currentSlot = areaVerifiersState.find(s => s.signOrder === order);
                return (
                  <div key={order} className="space-y-1">
                    <label className="block text-xs font-bold text-slate-500">
                      Firmante {order} {order === 1 ? '(Primer Verificador)' : order === 3 ? '(Último Aprobador)' : '(Segundo Verificador)'}
                    </label>
                    <select
                      value={currentSlot?.userId || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAreaVerifiersState(prev => prev.map(s => 
                          s.signOrder === order ? { ...s, userId: val } : s
                        ));
                      }}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-sm bg-white"
                    >
                      <option value="">-- Seleccionar Usuario --</option>
                      {usersList.filter(u => u.role === 'VERIFIER' || u.role === 'ADMIN').map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.role === 'ADMIN' ? 'Admin' : 'Verificador'})
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
              
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsVerifiersModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 text-xs font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold transition-colors"
                >
                  Guardar Configuración
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
