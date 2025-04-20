import { NextResponse } from 'next/server';
import { confirmPassword, AuthError } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';

export async function POST(request: Request) {
  try {
    // Get client IP for rate limiting
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ip = forwardedFor ? forwardedFor.split(',')[0] : 'unknown';
    
    // Check rate limit before processing password reset confirmation
    const rateLimitInfo = await checkRateLimit(ip, 'confirm-password', 5, 60 * 60); // 5 attempts per hour
    
    if (rateLimitInfo.isBlocked) {
      return NextResponse.json(
        { 
          error: 'Too many password reset attempts', 
          resetTime: rateLimitInfo.resetTime,
          remainingAttempts: 0
        },
        { status: 429 }
      );
    }
    
    const { username, code, newPassword } = await request.json();
    
    // Validate inputs
    if (!username || !code || !newPassword) {
      return NextResponse.json(
        { error: 'Username, code, and new password are required' },
        { status: 400 }
      );
    }
    
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }
    
    // Confirm password reset with Cognito
    await confirmPassword({ username, code, newPassword });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Password reset confirmation error:', error);
    
    if (error instanceof AuthError) {
      // Return appropriate error based on code
      if (error.code === 'CodeMismatchException') {
        return NextResponse.json(
          { error: 'Invalid verification code' },
          { status: 400 }
        );
      }
      
      if (error.code === 'ExpiredCodeException') {
        return NextResponse.json(
          { error: 'Verification code has expired' },
          { status: 400 }
        );
      }
      
      if (error.code === 'UserNotFoundException') {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
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
      { error: 'Password reset failed. Please try again later.' },
      { status: 500 }
    );
  }
} 