import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth-helpers';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('session_token')?.value;

    if (token) {
      const decoded = await verifyToken(token);
      if (decoded) {
        // Clean up active sessions for this user in the database
        await db.session.deleteMany({
          where: { userId: decoded.userId }
        });
      }
    }

    const response = NextResponse.json({ success: true, message: 'Sesión cerrada exitosamente' });
    
    // Clear cookie by setting expiration to historical date
    response.cookies.set({
      name: 'session_token',
      value: '',
      httpOnly: true,
      path: '/',
      expires: new Date(0)
    });

    return response;
  } catch (error: any) {
    console.error('Error during logout:', error);
    return NextResponse.json({ error: 'Error al cerrar sesión: ' + error.message }, { status: 500 });
  }
}
