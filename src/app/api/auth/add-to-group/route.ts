import { NextResponse } from 'next/server';
import * as jose from 'jose';
import { cognitoConfig, USER_GROUPS } from '@/config/cognito-config';
import { addUserToGroup, getUserGroups } from '@/lib/auth';
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';

// Create a Cognito Identity Provider client - This client is imported by lib/auth.ts
// and is re-exported here for consistency. The lib/auth.ts file uses this client.
/* eslint-disable @typescript-eslint/no-unused-vars */
const cognitoClient = new CognitoIdentityProviderClient({
  region: cognitoConfig.region,
});
/* eslint-enable @typescript-eslint/no-unused-vars */

export async function POST(request: Request) {
  try {
    // Get the auth token from cookies (admin must be authenticated)
    const token = request.headers.get('cookie')?.split(';')
      .find(c => c.trim().startsWith('auth-token='))
      ?.split('=')[1];
    
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
      
      // Get admin username from token
      const adminUsername = decodedToken['cognito:username'] as string || 
                            decodedToken.sub || '';
      
      if (!adminUsername) {
        throw new Error('Invalid token');
      }
      
      // Check if the user is an admin by getting their groups
      const adminGroups = await getUserGroups(adminUsername);
      const isAdmin = adminGroups.includes(USER_GROUPS.ADMIN);
      
      if (!isAdmin) {
        return NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        );
      }
      
      // Get request body
      const { username, groupName } = await request.json();
      
      // Validate inputs
      if (!username || !groupName) {
        return NextResponse.json(
          { error: 'Username and group name are required' },
          { status: 400 }
        );
      }
      
      // Check if group name is valid
      const validGroups = Object.values(USER_GROUPS);
      if (!validGroups.includes(groupName)) {
        return NextResponse.json(
          { error: 'Invalid group name', validGroups },
          { status: 400 }
        );
      }
      
      // Add user to group
      const success = await addUserToGroup(username, groupName);
      
      if (!success) {
        return NextResponse.json(
          { error: 'Failed to add user to group' },
          { status: 500 }
        );
      }
      
      return NextResponse.json({ 
        success: true,
        message: `User ${username} added to ${groupName} group`
      });
    } catch (error: unknown) {
      console.error('Add to group error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to add user to group' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 