import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { verifyToken } from '@/lib/auth-helpers';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Helper: Verify active session user
async function getCurrentUser(request: NextRequest) {
  const token = request.cookies.get('session_token')?.value;
  if (!token) return null;
  const decoded = await verifyToken(token);
  if (!decoded) return null;
  
  return await db.user.findUnique({
    where: { id: decoded.userId }
  });
}

// GET /api/incidents - List all incidents
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const incidents = await db.incident.findMany({
      include: {
        user: {
          select: {
            name: true,
            username: true,
            role: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({ incidents });
  } catch (error: any) {
    console.error('Error fetching incidents:', error);
    return NextResponse.json({ error: 'Error al listar incidentes: ' + error.message }, { status: 500 });
  }
}

// POST /api/incidents - Create a new incident report
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const formData = await request.formData();
    const title = formData.get('title') as string | null;
    const area = formData.get('area') as string | null;
    const description = formData.get('description') as string | null;
    const file = formData.get('file') as File | null;

    if (!title || !area || !description) {
      return NextResponse.json({ error: 'Todos los campos son obligatorios' }, { status: 400 });
    }

    let imageUrl: string | null = null;

    if (file) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      
      const fileId = crypto.randomUUID();
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const diskFileName = `${fileId}-${sanitizedFileName}`;

      if (supabase) {
        // Upload to Supabase Storage in the 'files' bucket under 'incidents' folder prefix
        const { data: uploadData, error: uploadError } = await supabase
          .storage
          .from('files')
          .upload(`incidents/${diskFileName}`, buffer, {
            contentType: file.type || 'application/octet-stream',
            upsert: true
          });

        if (uploadError) {
          throw new Error('Error de almacenamiento en Supabase: ' + uploadError.message);
        }

        // Get the public URL for the uploaded image
        const { data } = supabase.storage.from('files').getPublicUrl(`incidents/${diskFileName}`);
        imageUrl = data?.publicUrl || null;
      } else {
        // Local physical fallback inside public/incidents/ directory
        const uploadDir = path.join(process.cwd(), 'public', 'incidents');
        
        // Ensure directories exist
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        const filePath = path.join(uploadDir, diskFileName);
        fs.writeFileSync(filePath, buffer);
        imageUrl = `/incidents/${diskFileName}`;
      }
    }

    // Create Incident record in DB
    const newIncident = await db.incident.create({
      data: {
        title: title.trim(),
        area: area.trim(),
        description: description.trim(),
        imageUrl,
        userId: currentUser.id,
        status: 'Pendiente'
      },
      include: {
        user: {
          select: {
            name: true,
            username: true,
            role: true
          }
        }
      }
    });

    // Log this action to Audit Trails
    await db.audit.create({
      data: {
        username: currentUser.username,
        action: 'REPORTE_INCIDENTE',
        detail: `Reportó un nuevo incidente: "${title.trim()}" en el área "${area.trim()}"`
      }
    });

    return NextResponse.json({ success: true, incident: newIncident });
  } catch (error: any) {
    console.error('Error creating incident:', error);
    return NextResponse.json({ error: 'Error al registrar el incidente: ' + error.message }, { status: 500 });
  }
}

// PUT /api/incidents - Update an incident report (details by creator/admin, status by admin/verifier)
export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    let id: string | null = null;
    let status: string | null = null;
    let title: string | null = null;
    let area: string | null = null;
    let description: string | null = null;
    let file: File | null = null;

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      id = formData.get('id') as string | null;
      status = formData.get('status') as string | null;
      title = formData.get('title') as string | null;
      area = formData.get('area') as string | null;
      description = formData.get('description') as string | null;
      file = formData.get('file') as File | null;
    } else {
      const body = await request.json();
      id = body.id;
      status = body.status;
      title = body.title;
      area = body.area;
      description = body.description;
    }

    if (!id) {
      return NextResponse.json({ error: 'El identificador del incidente es requerido' }, { status: 400 });
    }

    // Fetch the current incident to check existence
    const existingIncident = await db.incident.findUnique({
      where: { id }
    });

    if (!existingIncident) {
      return NextResponse.json({ error: 'El incidente no existe' }, { status: 404 });
    }

    const isCreator = currentUser.id === existingIncident.userId;
    const isAdmin = currentUser.role === 'ADMIN';
    const isVerifier = currentUser.role === 'VERIFIER';

    // 1. Authorization for Status Update (ADMIN or VERIFIER)
    if (status && status !== existingIncident.status) {
      const allowedStatuses = ['Pendiente', 'En Revisión', 'Solucionado'];
      if (!allowedStatuses.includes(status)) {
        return NextResponse.json({ error: 'Estado de incidente inválido' }, { status: 400 });
      }

      if (!isAdmin && !isVerifier) {
        return NextResponse.json({ error: 'Acceso denegado. Se requiere rol de Administrador o Verificador para cambiar el estado.' }, { status: 403 });
      }
    }

    // 2. Authorization for details update (Title, Area, Description, Image)
    const isEditingDetails = (title && title.trim() !== existingIncident.title) || 
                            (area && area.trim() !== existingIncident.area) || 
                            (description && description.trim() !== existingIncident.description) || 
                            file;

    if (isEditingDetails) {
      if (!isCreator && !isAdmin) {
        return NextResponse.json({ error: 'Acceso denegado. Solo el creador original o un Administrador pueden modificar los detalles del reporte.' }, { status: 403 });
      }
    }

    let imageUrl = existingIncident.imageUrl;

    if (file) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      
      const fileId = crypto.randomUUID();
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const diskFileName = `${fileId}-${sanitizedFileName}`;

      if (supabase) {
        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase
          .storage
          .from('files')
          .upload(`incidents/${diskFileName}`, buffer, {
            contentType: file.type || 'application/octet-stream',
            upsert: true
          });

        if (uploadError) {
          throw new Error('Error de almacenamiento en Supabase: ' + uploadError.message);
        }

        const { data } = supabase.storage.from('files').getPublicUrl(`incidents/${diskFileName}`);
        imageUrl = data?.publicUrl || null;
      } else {
        // Local physical fallback
        const uploadDir = path.join(process.cwd(), 'public', 'incidents');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        const filePath = path.join(uploadDir, diskFileName);
        fs.writeFileSync(filePath, buffer);
        imageUrl = `/incidents/${diskFileName}`;
      }
    }

    // Build update data
    const updateData: any = {};
    if (status) {
      updateData.status = status;
    }
    if (title && title.trim()) {
      updateData.title = title.trim();
    }
    if (area && area.trim()) {
      updateData.area = area.trim();
    }
    if (description && description.trim()) {
      updateData.description = description.trim();
    }
    if (file) {
      updateData.imageUrl = imageUrl;
    }

    // Update status in DB
    const updatedIncident = await db.incident.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            name: true,
            username: true,
            role: true
          }
        }
      }
    });

    // Log update in Audit Trails
    let auditDetail = `Actualizó el reporte de incidente "${existingIncident.title}".`;
    if (status && status !== existingIncident.status) {
      auditDetail += ` Cambió el estado de "${existingIncident.status}" a "${status}".`;
    }
    if (title && title.trim() !== existingIncident.title) {
      auditDetail += ` Cambió el título de "${existingIncident.title}" a "${title.trim()}".`;
    }

    await db.audit.create({
      data: {
        username: currentUser.username,
        action: 'ACTUALIZAR_INCIDENTE',
        detail: auditDetail
      }
    });

    return NextResponse.json({ success: true, incident: updatedIncident });
  } catch (error: any) {
    console.error('Error updating incident:', error);
    return NextResponse.json({ error: 'Error al actualizar el incidente: ' + error.message }, { status: 500 });
  }
}
