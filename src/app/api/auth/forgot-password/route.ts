import { NextResponse } from 'next/server';
import { resetPassword, AuthError } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';

export async function POST(request: Request) {
  try {
    // Get client IP for rate limiting
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ip = forwardedFor ? forwardedFor.split(',')[0] : 'unknown';
    
    // Check rate limit before processing password reset
    const rateLimitInfo = await checkRateLimit(ip, 'forgot-password', 5, 60 * 60); // 5 attempts per hour
    
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
    
    const { username } = await request.json();
    
    // Validate inputs
    if (!username) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }
    
    // Initiate password reset with Cognito
    await resetPassword({ username });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Password reset error:', error);
    
    if (error instanceof AuthError) {
      // Return appropriate error based on code
      if (error.code === 'UserNotFoundException') {
        // For security reasons, we don't want to reveal that a user doesn't exist
        // So we return success even if the user doesn't exist
        return NextResponse.json({ success: true });
      }
      
      if (error.code === 'LimitExceededException') {
        return NextResponse.json(
          { error: 'Too many attempts. Please try again later.' },
          { status: 429 }
        );
      }
      
      return NextResponse.json(
        { error: 'Password reset failed. Please try again later.' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Password reset failed. Please try again later.' },
      { status: 500 }
    );
  }
} 