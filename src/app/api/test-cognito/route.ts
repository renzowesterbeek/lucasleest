import { NextResponse } from 'next/server';
import { cognitoConfig } from '@/config/cognito-config';
import { ListUserPoolsCommand, CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';

export async function GET() {
  try {
    // Check if environment variables exist
    const hasAwsRegion = !!process.env.NEXT_PUBLIC_AWS_REGION;
    const hasUserPoolId = !!process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
    const hasClientId = !!process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
    const hasAccessKey = !!process.env.ACCESS_KEY_ID;
    const hasSecretKey = !!process.env.SECRET_ACCESS_KEY;
    
    // Format validation for User Pool ID
    const isValidFormat = cognitoConfig.userPoolId.includes('_') && 
                         cognitoConfig.userPoolId.startsWith(cognitoConfig.region);
    
    // Try to validate User Pool existence
    let isValidUserPool = false;
    let availableUserPools: string[] = [];

    if (hasAwsRegion && hasAccessKey && hasSecretKey) {
      try {
        const client = new CognitoIdentityProviderClient({
          region: cognitoConfig.region,
          credentials: {
            accessKeyId: process.env.ACCESS_KEY_ID || '',
            secretAccessKey: process.env.SECRET_ACCESS_KEY || '',
          }
        });
        
        const command = new ListUserPoolsCommand({ MaxResults: 60 });
        const response = await client.send(command);
        
        availableUserPools = (response.UserPools || [])
          .map(pool => pool.Id || '')
          .filter(Boolean);
        
        isValidUserPool = availableUserPools.includes(cognitoConfig.userPoolId);
      } catch (error) {
        console.error('Error validating user pool:', error);
      }
    }
    
    return NextResponse.json({
      config: {
        region: cognitoConfig.region,
        userPoolId: cognitoConfig.userPoolId,
        clientId: cognitoConfig.clientId.substring(0, 6) + '...',
        isConfigValid: cognitoConfig.isConfigValid
      },
      validation: {
        isValidFormat,
        isValidUserPool,
        availableUserPools
      },
      environmentVariables: {
        hasAwsRegion,
        hasUserPoolId,
        hasClientId,
        hasAccessKey,
        hasSecretKey
      }
    });
  } catch (error) {
    console.error('Cognito test error:', error);
    return NextResponse.json(
      { error: 'Failed to test Cognito configuration' },
      { status: 500 }
    );
  }
} 