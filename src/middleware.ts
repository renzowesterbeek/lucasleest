import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as jose from 'jose';
import { USER_GROUPS } from './config/cognito-config';

export async function middleware(request: NextRequest) {
  console.log('Middleware check for:', request.nextUrl.pathname);
  console.log('Request URL:', request.url);
  console.log('Headers:', Object.fromEntries(request.headers.entries()));

  // Only protect /admin routes
  if (!request.nextUrl.pathname.startsWith('/admin')) {
    console.log('Not an admin route, allowing access');
    return NextResponse.next();
  }

  console.log('Cookie names available:', request.cookies.getAll().map(c => c.name));
  const token = request.cookies.get('auth-token')?.value;
  console.log('Found token:', !!token, token ? `(length: ${token.length})` : '');

  // If there's no token, redirect to login
  if (!token) {
    console.log('No token found, redirecting to login');
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  try {
    // Decode and verify the token
    const decodedToken = jose.decodeJwt(token);
    
    console.log('Token decoded successfully:', {
      iss: decodedToken.iss,
      exp: decodedToken.exp,
      hasUsername: !!decodedToken['cognito:username'] || !!decodedToken.sub
    });
    
    // Check if token is from Cognito
    if (!decodedToken.iss || !decodedToken.iss.includes('cognito-idp')) {
      console.log('Invalid token issuer:', decodedToken.iss);
      throw new Error('Invalid token issuer');
    }
    
    // Check if token is expired
    const currentTime = Math.floor(Date.now() / 1000);
    if (decodedToken.exp && decodedToken.exp < currentTime) {
      console.log('Token expired at:', new Date(decodedToken.exp * 1000).toISOString());
      console.log('Current time:', new Date(currentTime * 1000).toISOString());
      throw new Error('Token expired');
    }
    
    // Get user groups from token
    const groups = decodedToken['cognito:groups'] as string[] || [];
    console.log('User groups from token:', groups);
    
    // Check if user is an admin
    const isAdmin = groups.includes(USER_GROUPS.ADMIN);
    
    // If trying to access admin page but not an admin, redirect
    if (request.nextUrl.pathname.startsWith('/admin') && !isAdmin) {
      console.log('User is not an admin, redirecting to home');
      return NextResponse.redirect(new URL('/', request.url));
    }
    
    // Continue with the request
    return NextResponse.next();
  } catch (error) {
    console.error('Token verification failed:', error);
    
    // Redirect to login
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: ['/admin/:path*']
}; 