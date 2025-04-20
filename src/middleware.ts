import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as jose from 'jose';
import { USER_GROUPS } from './config/cognito-config';

export async function middleware(request: NextRequest) {
  console.log('Middleware check for:', request.nextUrl.pathname);

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
    // Verify the Cognito token by decoding and validating
    const decodedToken = jose.decodeJwt(token);
    
    console.log('Token decoded, claims:', {
      iss: decodedToken.iss,
      exp: decodedToken.exp, 
      currentTime: Math.floor(Date.now() / 1000),
      sub: decodedToken.sub,
      'cognito:groups': decodedToken['cognito:groups'],
      hasGroups: !!decodedToken['cognito:groups']
    });
    
    // Check if it's a Cognito token by checking for the issuer
    if (!decodedToken.iss || !decodedToken.iss.includes('cognito-idp')) {
      throw new Error('Invalid token issuer');
    }
    
    // Check if token is expired
    const currentTime = Math.floor(Date.now() / 1000);
    if (decodedToken.exp && decodedToken.exp < currentTime) {
      throw new Error('Token expired');
    }
    
    // Check if user is in admin group - the 'cognito:groups' claim contains user groups
    const userGroups = decodedToken['cognito:groups'] as string[] || [];
    console.log('User groups from token:', userGroups);
    
    if (!userGroups.includes(USER_GROUPS.ADMIN)) {
      throw new Error('Not authorized - user is not in admin group');
    }
    
    console.log('Cognito token verified successfully');
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