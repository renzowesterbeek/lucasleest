import { NextResponse } from 'next/server';
import { refreshTokens } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get('refresh-token')?.value;
    
    if (!refreshToken) {
      return NextResponse.json(
        { error: 'No refresh token found' },
        { status: 401 }
      );
    }
    
    // Get new tokens from the refresh token without passing the refresh token
    const tokens = await refreshTokens();
    
    // Create response with refreshed tokens
    const response = NextResponse.json({ success: true });
    
    // Set the new ID token as a cookie
    response.cookies.set({
      name: 'auth-token',
      value: tokens.idToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 // 1 hour
    });
    
    // Update the refresh token cookie with the existing refresh token
    // since refreshTokens() doesn't return a new refresh token
    response.cookies.set({
      name: 'refresh-token',
      value: refreshToken, // Reuse the existing refresh token
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 // 30 days
    });
    
    return response;
  } catch (error) {
    console.error('Token refresh error:', error);
    
    // Clear cookies on error
    const response = NextResponse.json(
      { error: 'Failed to refresh token' },
      { status: 401 }
    );
    
    response.cookies.delete('auth-token');
    response.cookies.delete('refresh-token');
    
    return response;
  }
} 