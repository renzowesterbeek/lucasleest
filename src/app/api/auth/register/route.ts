import { NextResponse } from 'next/server';
import { register, AuthError } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';

export async function POST(request: Request) {
  try {
    // Get client IP for rate limiting
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ip = forwardedFor ? forwardedFor.split(',')[0] : 'unknown';
    
    // Check rate limit before processing registration
    const rateLimitInfo = await checkRateLimit(ip, 'registration', 5, 30 * 60); // 5 attempts per 30 minutes
    
    if (rateLimitInfo.isBlocked) {
      return NextResponse.json(
        { 
          error: 'Too many registration attempts', 
          resetTime: rateLimitInfo.resetTime,
          remainingAttempts: 0
        },
        { status: 429 }
      );
    }
    
    const { username, email, password } = await request.json();
    
    // Validate inputs
    if (!username || !email || !password) {
      return NextResponse.json(
        { error: 'Username, email, and password are required' },
        { status: 400 }
      );
    }
    
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }
    
    // Register user with Cognito
    await register({ username, email, password });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Registration error:', error);
    
    if (error instanceof AuthError) {
      // Return appropriate error based on code
      if (error.code === 'UsernameExistsException') {
        return NextResponse.json(
          { error: 'Username already exists' },
          { status: 400 }
        );
      }
      
      if (error.code === 'InvalidPasswordException') {
        return NextResponse.json(
          { error: 'Password does not meet requirements' },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Registration failed. Please try again later.' },
      { status: 500 }
    );
  }
} 