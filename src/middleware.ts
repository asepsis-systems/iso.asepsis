// Force rebuild: 3
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from './lib/auth-helpers';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // If user is accessing /login, but they already have a session, redirect to /
  if (pathname === '/login') {
    const token = request.cookies.get('session_token')?.value;
    if (token) {
      const decoded = await verifyToken(token);
      if (decoded) {
        return NextResponse.redirect(new URL('/', request.url));
      }
    }
  }

  // Define public paths that don't require authentication
  const isPublicPath = 
    pathname === '/login' ||
    pathname.startsWith('/api/auth/login') ||
    pathname.startsWith('/api/seed') || // Allow database seeding
    pathname.startsWith('/_next/') || 
    pathname.startsWith('/api/auth/logout') ||
    pathname === '/favicon.ico' ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|css|js|webp)$/);

  if (isPublicPath) {
    return NextResponse.next();
  }

  // Retrieve token
  const token = request.cookies.get('session_token')?.value;
  console.log('MIDDLEWARE: pathname =', pathname, 'token =', token ? token.substring(0, 15) + '...' : 'undefined');

  if (!token) {
    console.log('MIDDLEWARE: No token. Redirecting to /login');
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Verify the JWT token
  const decoded = await verifyToken(token);
  console.log('MIDDLEWARE: decoded =', decoded);
  if (!decoded) {
    console.log('MIDDLEWARE: Invalid token. Redirecting to /login');
    // Clear invalid session cookie and redirect
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.set({
      name: 'session_token',
      value: '',
      httpOnly: true,
      path: '/',
      expires: new Date(0)
    });
    return response;
  }

  const response = NextResponse.next();
  // Set Cache-Control headers to prevent caching of protected routes
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  return response;
}

// Apply middleware to all routes except standard static directories
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth/login (login endpoint)
     * - api/seed (seeding endpoint)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api/auth/login|api/seed|_next/static|_next/image|favicon.ico).*)',
  ],
};
