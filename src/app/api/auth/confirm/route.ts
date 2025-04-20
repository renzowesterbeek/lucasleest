import { NextResponse } from 'next/server';
import { AuthError } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
import { cognitoConfig } from '@/config/cognito-config';
import crypto from 'crypto';
import { 
  CognitoIdentityProviderClient, 
  ConfirmSignUpCommand 
} from "@aws-sdk/client-cognito-identity-provider";

// Helper function to calculate SECRET_HASH
const calculateSecretHash = (username: string): string => {
  if (!cognitoConfig.clientSecret) {
    return '';
  }
  
  const message = username + cognitoConfig.clientId;
  const hmac = crypto.createHmac('sha256', cognitoConfig.clientSecret);
  hmac.update(message);
  return hmac.digest('base64');
};

export async function POST(request: Request) {
  try {
    // Get client IP for rate limiting
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ip = forwardedFor ? forwardedFor.split(',')[0] : 'unknown';
    
    // Check rate limit before processing confirmation
    const rateLimitInfo = await checkRateLimit(ip, 'confirmation', 10, 60 * 60); // 10 attempts per hour
    
    if (rateLimitInfo.isBlocked) {
      return NextResponse.json(
        { 
          error: 'Too many confirmation attempts', 
          resetTime: rateLimitInfo.resetTime,
          remainingAttempts: 0
        },
        { status: 429 }
      );
    }
    
    const { username, code } = await request.json();
    
    // Validate inputs
    if (!username || !code) {
      return NextResponse.json(
        { error: 'Username and confirmation code are required' },
        { status: 400 }
      );
    }
    
    // Create Cognito Identity Provider client
    const client = new CognitoIdentityProviderClient({ 
      region: cognitoConfig.region 
    });
    
    // Calculate SECRET_HASH if client secret exists
    const secretHash = cognitoConfig.clientSecret ? calculateSecretHash(username) : undefined;
    
    // Create the command with SECRET_HASH if needed
    const confirmCommand = new ConfirmSignUpCommand({
      ClientId: cognitoConfig.clientId,
      Username: username,
      ConfirmationCode: code,
      ForceAliasCreation: true,
      ...(secretHash && { SecretHash: secretHash })
    });
    
    // Send the command
    await client.send(confirmCommand);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Confirmation error:', error);
    
    // Return appropriate error based on error name
    if (error.name === 'CodeMismatchException') {
      return NextResponse.json(
        { error: 'Invalid confirmation code' },
        { status: 400 }
      );
    }
    
    if (error.name === 'ExpiredCodeException') {
      return NextResponse.json(
        { error: 'Confirmation code has expired' },
        { status: 400 }
      );
    }
    
    if (error.name === 'UserNotFoundException') {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Confirmation failed. Please try again later.' },
      { status: 500 }
    );
  }
} 