import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth-node';

export async function GET(request: NextRequest) {
  try {
    // Check if users already exist
    const userCount = await db.user.count();
    
    if (userCount > 0) {
      return NextResponse.json({ 
        message: 'La base de datos ya contiene usuarios. No se realizó ninguna acción.', 
        count: userCount 
      });
    }

    // Create initial users
    const usersToCreate = [
      {
        username: 'admin',
        password: hashPassword('admin123'),
        name: 'Asepsis Admin',
        role: 'ADMIN'
      },
      {
        username: 'creador',
        password: hashPassword('creador123'),
        name: 'Carlos Mendoza (Creador)',
        role: 'CREATOR'
      },
      {
        username: 'verificador1',
        password: hashPassword('verif123'),
        name: 'Ana Gómez (Verificador 1)',
        role: 'VERIFIER'
      },
      {
        username: 'verificador2',
        password: hashPassword('verif123'),
        name: 'Luis Rodríguez (Verificador 2)',
        role: 'VERIFIER'
      },
      {
        username: 'verificador3',
        password: hashPassword('verif123'),
        name: 'Elena Pires (Verificador 3)',
        role: 'VERIFIER'
      }
    ];

    const createdUsers = [];
    for (const u of usersToCreate) {
      const user = await db.user.create({
        data: u,
        select: { id: true, username: true, name: true, role: true }
      });
      createdUsers.push(user);
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Base de datos poblada exitosamente con usuarios iniciales.', 
      users: createdUsers 
    });
  } catch (error: any) {
    console.error('Error seeding database:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
