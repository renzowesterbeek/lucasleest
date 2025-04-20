import { NextResponse } from 'next/server';
import { AuthError } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
import { cognitoConfig } from '@/config/cognito-config';
import crypto from 'crypto';
import { 
  CognitoIdentityProviderClient, 
  ResendConfirmationCodeCommand 
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
    
    // Check rate limit before resending confirmation code
    const rateLimitInfo = await checkRateLimit(ip, 'resend-confirmation', 3, 60 * 60); // 3 attempts per hour
    
    if (rateLimitInfo.isBlocked) {
      return NextResponse.json(
        { 
          error: 'Too many requests', 
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

    // Create Cognito Identity Provider client
    const client = new CognitoIdentityProviderClient({ 
      region: cognitoConfig.region 
    });
    
    // Calculate SECRET_HASH if client secret exists
    const secretHash = cognitoConfig.clientSecret ? calculateSecretHash(username) : undefined;
    
    // Create the command with SECRET_HASH if needed
    const resendCommand = new ResendConfirmationCodeCommand({
      ClientId: cognitoConfig.clientId,
      Username: username,
      ...(secretHash && { SecretHash: secretHash })
    });
    
    // Send the command
    await client.send(resendCommand);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Resend confirmation error:', error);
    
    if (error.name === 'UserNotFoundException') {
      // For security reasons, don't reveal that a user doesn't exist
      return NextResponse.json({ success: true });
    }
    
    if (error.name === 'LimitExceededException') {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' },
        { status: 429 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to resend confirmation code. Please try again later.' },
      { status: 500 }
    );
  }
} 