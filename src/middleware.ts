import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as jose from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function middleware(request: NextRequest) {
  console.log('Middleware check for:', request.nextUrl.pathname);

  // Only protect /admin routes
  if (!request.nextUrl.pathname.startsWith('/admin')) {
    console.log('Not an admin route, allowing access');
    return NextResponse.next();
  }

  const token = request.cookies.get('auth-token')?.value;
  console.log('Found token:', !!token);

  // If there's no token, redirect to login
  if (!token) {
    console.log('No token found, redirecting to login');
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  try {
    // Verify the token
    const secret = new TextEncoder().encode(JWT_SECRET);
    const verified = await jose.jwtVerify(token, secret);
    console.log('Token verified:', verified);
    return NextResponse.next();
  } catch (error) {
    // If token is invalid, redirect to login
    console.error('Token verification failed:', error);
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: ['/admin/:path*']
}; 