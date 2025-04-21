import { NextResponse } from 'next/server';
import * as jose from 'jose';
import { cognitoConfig } from '@/config/cognito-config';
import { getUserGroups, getUserPermissions } from '@/lib/auth';
import { AdminGetUserCommand, CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';

// Create a Cognito Identity Provider client
const cognitoClient = new CognitoIdentityProviderClient({
  region: cognitoConfig.region,
});

export async function GET(request: Request) {
  try {
    // Try to get token from cookie first
    let token = request.headers.get('cookie')?.split(';')
      .find(c => c.trim().startsWith('auth-token='))
      ?.split('=')[1];
    
    // If no token in cookie, check Authorization header
    if (!token) {
      const authHeader = request.headers.get('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }
    
    if (!token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    try {
      // Decode the Cognito token
      const decodedToken = jose.decodeJwt(token);
      
      // Verify it's a Cognito token
      if (!decodedToken.iss || !decodedToken.iss.includes('cognito-idp')) {
        throw new Error('Invalid token issuer');
      }
      
      // Check if token is expired
      const currentTime = Math.floor(Date.now() / 1000);
      if (decodedToken.exp && decodedToken.exp < currentTime) {
        throw new Error('Token expired');
      }
      
      // Get username from token
      const username = decodedToken['cognito:username'] as string || 
                        decodedToken.sub || '';
      
      if (!username) {
        throw new Error('Invalid token');
      }
      
      // Get user details from Cognito
      const command = new AdminGetUserCommand({
        UserPoolId: cognitoConfig.userPoolId,
        Username: username,
      });
      
      const response = await cognitoClient.send(command);
      
      // Extract user attributes
      const attributes: { [key: string]: string } = {};
      response.UserAttributes?.forEach(attr => {
        if (attr.Name && attr.Value) {
          attributes[attr.Name] = attr.Value;
        }
      });
      
      // Get user groups
      const userGroups = await getUserGroups(username);
      const userPermissions = getUserPermissions(userGroups);
      
      return NextResponse.json({
        user: {
          username,
          email: attributes.email || '',
          name: attributes.name || '',
          groups: userGroups,
          permissions: userPermissions,
          token: '' // Don't return the token in the response
        }
      });
    } catch (error) {
      console.error('Token verification failed:', error);
      // Log details for debugging
      try {
        const decodedToken = jose.decodeJwt(token);
        const currentTime = Math.floor(Date.now() / 1000);
        console.error('Failed token details:', {
          tokenIssuer: decodedToken.iss,
          tokenExpiration: decodedToken.exp,
          serverTime: currentTime,
          usernameClaim: decodedToken['cognito:username'],
          subClaim: decodedToken.sub,
          errorType: error instanceof Error ? error.message : String(error)
        });
      } catch (decodeError) {
        console.error('Failed to decode token during error logging:', decodeError);
        // Also log the raw token (be careful if logging sensitive info in production)
        // Consider logging only a portion or hash if needed
        console.error('Problematic token (first 10 chars):', token.substring(0, 10)); 
      }
      
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 