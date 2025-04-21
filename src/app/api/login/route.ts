import { NextResponse } from 'next/server';
import * as jose from 'jose';
import { checkRateLimit } from '@/lib/rateLimit';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'your-admin-password';

export async function POST(request: Request) {
  try {
    // Get client IP
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ip = forwardedFor ? forwardedFor.split(',')[0] : 'unknown';
    
    // Check rate limit before processing login
    const rateLimitInfo = await checkRateLimit(ip);
    
    if (rateLimitInfo.isBlocked) {
      return NextResponse.json(
        { 
          error: 'Too many login attempts', 
          resetTime: rateLimitInfo.resetTime,
          remainingAttempts: 0
        },
        { status: 429 }
      );
    }

    const { password } = await request.json();
    
    console.log('Login attempt:', {
      receivedPassword: password,
      expectedPassword: ADMIN_PASSWORD,
      hasJwtSecret: !!JWT_SECRET,
      isMatch: password === ADMIN_PASSWORD,
      remainingAttempts: rateLimitInfo.remainingAttempts
    });

    if (password !== ADMIN_PASSWORD) {
      console.log('Password mismatch');
      return NextResponse.json(
        { 
          error: 'Invalid password',
          remainingAttempts: rateLimitInfo.remainingAttempts,
          resetTime: rateLimitInfo.resetTime
        },
        { status: 401 }
      );
    }

    // Create JWT token
    const secret = new TextEncoder().encode(JWT_SECRET);
    const token = await new jose.SignJWT({ role: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1d')
      .sign(secret);
      
    console.log('JWT token created');

    // Create response with success message
    const response = NextResponse.json({ success: true });

    // Set the token in an HTTP-only cookie
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 86400 // 1 day
    });
    console.log('Cookie set in response');

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 