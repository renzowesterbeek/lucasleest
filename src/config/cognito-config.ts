import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";

// Get Cognito configuration from environment variables
const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '';
const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '';
const clientSecret = process.env.NEXT_PUBLIC_COGNITO_CLIENT_SECRET || '';
const region = process.env.NEXT_PUBLIC_AWS_REGION || 'eu-west-1';
const identityPoolId = process.env.NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID || '';

// Log configuration without exposing secrets
console.log('Cognito config from cognito-config.ts:', {
  region,
  userPoolIdPresent: !!userPoolId,
  clientIdPresent: !!clientId,
  clientSecretPresent: !!clientSecret,
  clientSecretLength: clientSecret?.length,
  identityPoolIdPresent: !!identityPoolId
});

// Validate Cognito configuration - ensure userPoolId contains region and an underscore
const isConfigValid = userPoolId.includes(region) && userPoolId.includes('_') && clientId && clientId.length > 0;

// Cognito configuration
export const cognitoConfig = {
  region,
  userPoolId,
  clientId,
  clientSecret,
  identityPoolId,
  isConfigValid
};

// User groups and their permissions
export const USER_GROUPS = {
  ADMIN: 'Admins',
  USER: 'Users',
};

// Permissions mapping
export const PERMISSIONS = {
  [USER_GROUPS.ADMIN]: [
    'admin:read',
    'admin:write',
    'admin:delete',
    'user:read',
    'user:write',
  ],
  [USER_GROUPS.USER]: [
    'user:read',
  ],
};

// Create a Cognito Identity Provider client only if config is valid
export const cognitoClient = isConfigValid 
  ? new CognitoIdentityProviderClient({
      region: cognitoConfig.region,
    })
  : null; 