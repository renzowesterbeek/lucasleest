'use client';

// AWS Cognito Configuration for Amplify v6
// These values will be picked up from environment variables

// Debug environment variables
console.log('Auth env vars available:', {
  region: !!process.env.NEXT_PUBLIC_AWS_REGION,
  userPoolId: !!process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID,
  userPoolClientId: !!process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID,
  hasClientSecret: !!process.env.NEXT_PUBLIC_COGNITO_CLIENT_SECRET,
});

export const awsConfig = {
  Auth: {
    Cognito: {
      region: process.env.NEXT_PUBLIC_AWS_REGION || 'eu-west-1',
      userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '',
      userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '',
      userPoolClientSecret: process.env.NEXT_PUBLIC_COGNITO_CLIENT_SECRET || '',
    }
  }
}; 