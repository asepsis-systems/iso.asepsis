import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth-helpers';
import { hashPassword } from '@/lib/auth-node';

// Helper: Ensure active user is an administrator
async function checkAdmin(request: NextRequest) {
  const token = request.cookies.get('session_token')?.value;
  if (!token) return null;
  const decoded = await verifyToken(token);
  if (!decoded || decoded.role !== 'ADMIN') return null;
  return decoded;
}

// GET /api/users - List all users (ADMIN only)
export async function GET(request: NextRequest) {
  try {
    const adminUser = await checkAdmin(request);
    if (!adminUser) {
      return NextResponse.json({ error: 'No autorizado. Solo los administradores pueden gestionar usuarios.' }, { status: 403 });
    }

    const users = await db.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return NextResponse.json({ users });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Error al listar usuarios: ' + error.message }, { status: 500 });
  }
}

// POST /api/users - Create new user (ADMIN only)
export async function POST(request: NextRequest) {
  try {
    const adminUser = await checkAdmin(request);
    if (!adminUser) {
      return NextResponse.json({ error: 'No autorizado. Solo los administradores pueden crear usuarios.' }, { status: 403 });
    }

    const body = await request.json();
    const { username, password, name, role } = body;

    if (!username || !password || !name || !role) {
      return NextResponse.json({ error: 'Todos los campos son obligatorios' }, { status: 400 });
    }

    // Check if username already exists
    const existingUser = await db.user.findUnique({
      where: { username: username.trim().toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json({ error: 'El nombre de usuario ya existe' }, { status: 400 });
    }

    // Create user
    const newUser = await db.user.create({
      data: {
        username: username.trim().toLowerCase(),
        password: hashPassword(password),
        name: name.trim(),
        role: role.toUpperCase(),
      },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ success: true, user: newUser });
  } catch (error: any) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Error al crear usuario: ' + error.message }, { status: 500 });
  }
}

// DELETE /api/users - Delete user (ADMIN only)
export async function DELETE(request: NextRequest) {
  try {
    const adminUser = await checkAdmin(request);
    if (!adminUser) {
      return NextResponse.json({ error: 'No autorizado. Solo los administradores pueden eliminar usuarios.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('id');

    if (!userId) {
      return NextResponse.json({ error: 'El ID del usuario es obligatorio' }, { status: 400 });
    }

    // Prevent deleting oneself
    if (userId === adminUser.userId) {
      return NextResponse.json({ error: 'No puedes eliminar tu propia cuenta de administrador activa.' }, { status: 400 });
    }

    await db.user.delete({
      where: { id: userId },
    });

    return NextResponse.json({ success: true, message: 'Usuario eliminado con éxito' });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Error al eliminar usuario: ' + error.message }, { status: 500 });
  }
}
