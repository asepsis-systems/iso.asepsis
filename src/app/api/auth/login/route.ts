import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { signToken } from '@/lib/auth-helpers';
import { verifyPassword } from '@/lib/auth-node';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Usuario y contraseña son obligatorios' }, { status: 400 });
    }

    // Find user
    const user = await db.user.findUnique({
      where: { username: username.toLowerCase().trim() }
    });

    if (!user) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    // Verify password
    const isPasswordValid = verifyPassword(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    // Create session in database
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 hours
    const session = await db.session.create({
      data: {
        userId: user.id,
        expiresAt
      }
    });

    // Create signed token
    const token = await signToken({
      userId: user.id,
      username: user.username,
      role: user.role
    });

    // Set cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role
      }
    });

    response.cookies.set({
      name: 'session_token',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: expiresAt
    });

    return response;
  } catch (error: any) {
    console.error('Error during login:', error);
    return NextResponse.json({ error: 'Error interno en el servidor: ' + error.message }, { status: 500 });
  }
}
