import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const areas = await db.area.findMany({
      include: {
        verifiers: {
          orderBy: { signOrder: 'asc' },
          include: {
            user: {
              select: { id: true, name: true, username: true }
            }
          }
        },
        users: {
          select: { id: true, name: true, username: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json({ areas });
  } catch (error: any) {
    console.error('Error fetching areas:', error);
    return NextResponse.json({ error: 'Error al listar áreas: ' + error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Auth check (ADMIN only)
    const token = request.cookies.get('session_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const decoded = await verifyToken(token);
    if (!decoded || decoded.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Prohibido: Solo administradores pueden realizar esta acción.' }, { status: 403 });
    }

    const body = await request.json();
    const { areaId, verifiers } = body; // verifiers is array of { userId, signOrder }

    if (!areaId || !Array.isArray(verifiers)) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    // Find area
    const area = await db.area.findUnique({ where: { id: areaId } });
    if (!area) {
      return NextResponse.json({ error: 'Área no encontrada' }, { status: 404 });
    }

    // Update verifiers in a transaction
    await db.$transaction([
      // Delete old verifiers
      db.verifier.deleteMany({
        where: { areaId }
      }),
      // Create new verifiers
      db.verifier.createMany({
        data: verifiers.map((v: any) => ({
          areaId,
          userId: v.userId,
          signOrder: parseInt(v.signOrder)
        }))
      })
    ]);

    // Log to Audit
    await db.audit.create({
      data: {
        username: decoded.username,
        action: 'CONFIGURAR_VERIFICADORES',
        detail: `Se reconfiguraron los verificadores del área: ${area.name}`
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating area verifiers:', error);
    return NextResponse.json({ error: 'Error al actualizar verificadores: ' + error.message }, { status: 500 });
  }
}
