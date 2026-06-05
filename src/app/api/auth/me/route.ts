import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('session_token')?.value;

    if (!token) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    // Retrieve user from DB
    const user = await db.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, username: true, name: true, role: true }
    });

    if (!user) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    return NextResponse.json({ authenticated: true, user });
  } catch (error: any) {
    console.error('Error fetching current user:', error);
    return NextResponse.json({ error: 'Error al recuperar información del usuario: ' + error.message }, { status: 500 });
  }
}
