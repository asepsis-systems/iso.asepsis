import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('session_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const decoded = await verifyToken(token);
    if (!decoded || decoded.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Prohibido: Solo administradores pueden ver la auditoría.' }, { status: 403 });
    }

    const audits = await db.audit.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100 // Retornar los últimos 100 logs
    });

    return NextResponse.json({ audits });
  } catch (error: any) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json({ error: 'Error al listar auditoría: ' + error.message }, { status: 500 });
  }
}
