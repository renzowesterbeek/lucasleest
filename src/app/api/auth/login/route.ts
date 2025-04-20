import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rateLimit';

export async function POST(request: Request) {
  try {
    // Get client IP for rate limiting
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ip = forwardedFor ? forwardedFor.split(',')[0] : 'unknown';
    console.log('Login request from IP:', ip);
    
    // Check rate limit before processing login
    const rateLimitInfo = await checkRateLimit(ip, 'login', 10, 15 * 60); // 10 attempts per 15 minutes
    
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
    
    const { username, password, idToken } = await request.json();
    console.log('Login request for user:', username, 'Token provided:', !!idToken);
    
    // Validate inputs
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // With our new approach, the login is now handled client-side
    // We only need to set the cookie with the token from the client
    
    if (idToken) {
      // Set authentication token as an HTTP-only cookie
      const response = NextResponse.json({ 
        success: true,
        message: 'Login successful'
      });
      
      // Get domain for cookie in production
      let domain: string | undefined = undefined;
      if (process.env.NODE_ENV === 'production') {
        const url = request.headers.get('origin') || '';
        try {
          domain = new URL(url).hostname;
          console.log('Setting cookie for domain:', domain);
        } catch (e) {
          console.error('Failed to parse origin for cookie domain:', e);
        }
      }
      
      // Set the auth token as a secure HTTP-only cookie
      response.cookies.set({
        name: 'auth-token',
        value: idToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        domain: domain, // Will be undefined in development
        // Token expiry is typically 1 hour for Cognito
        maxAge: 60 * 60
      });
      
      console.log('Cookie set successfully with token. Cookie configuration:', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        domain: domain || 'undefined',
        tokenLength: idToken.length
      });
      
      return response;
    }
    
    // If we reach here, the login succeeded client-side but we didn't receive a token
    return NextResponse.json({ 
      success: false,
      error: 'Authentication successful but no token provided'
    }, 
    { status: 400 });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
} 