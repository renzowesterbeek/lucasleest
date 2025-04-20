import { 
  AdminGetUserCommand, 
  AdminListGroupsForUserCommand,
  CognitoIdentityProviderClient,
  AdminAddUserToGroupCommand,
  GetUserCommand,
  SignUpCommand
} from '@aws-sdk/client-cognito-identity-provider';
import { cognitoConfig, PERMISSIONS, USER_GROUPS } from '@/config/cognito-config';
import { Amplify } from 'aws-amplify';
import { signIn, signOut, getCurrentUser, confirmSignUp, resetPassword, confirmResetPassword, resendSignUpCode, signUp, fetchAuthSession } from 'aws-amplify/auth';
import crypto from 'crypto';

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

// Configure Amplify
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: cognitoConfig.userPoolId,
      userPoolClientId: cognitoConfig.clientId
    }
  }
});

// Create a Cognito Identity Provider client
const cognitoClient = cognitoConfig.isConfigValid
  ? new CognitoIdentityProviderClient({
      region: cognitoConfig.region,
    })
  : null;

// Interfaces
export interface AuthUser {
  username: string;
  email: string;
  id: string;
  groups: string[];
  permissions: string[];
  tokens: {
    idToken: string;
  };
}

export interface LoginParams {
  username: string;
  password: string;
}

export interface RegisterParams {
  username: string;
  password: string;
  email: string;
  phone_number?: string;
}

export interface ConfirmRegistrationParams {
  username: string;
  code: string;
}

export interface ResetPasswordParams {
  username: string;
}

export interface ConfirmPasswordParams {
  username: string;
  code: string;
  newPassword: string;
}

// Error class for auth operations
export class AuthError extends Error {
  code: string;
  
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = 'AuthError';
  }
}

// Helper to get the current authenticated user
export const getCurrentUserHelper = async (): Promise<any> => {
  try {
    const user = await getCurrentUser();
    return user;
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
};

// Login function
export const login = async ({ username, password }: LoginParams): Promise<AuthUser> => {
  try {
    // Calculate SECRET_HASH if client secret exists
    const secretHash = cognitoConfig.clientSecret ? calculateSecretHash(username) : undefined;
    
    // Log the secret hash for debugging (remove in production)
    console.log('Using secret hash:', !!secretHash);
    
    // Create signIn parameters
    const signInParams: any = {
      username,
      password,
      options: {
        authFlowType: 'USER_PASSWORD_AUTH'
      }
    };
    
    // Add the secret hash if it exists
    if (secretHash) {
      signInParams.options.clientMetadata = {
        SECRET_HASH: secretHash
      };
    }
    
    // Call signIn with proper params
    const signInOutput = await signIn(signInParams);
    
    // Extract token info more safely
    const idToken = signInOutput.isSignedIn && signInOutput.nextStep.signInStep === 'DONE' 
      ? await fetchAuthSession().then(session => session.tokens?.idToken?.toString() || '')
      : '';
    
    // For debugging
    console.log('Sign in successful, received tokens:', !!idToken);
    
    // Basic user info
    const user = {
      username: username,
      email: username.includes('@') ? username : '',
      id: username,
      groups: [],
      permissions: [],
      tokens: {
        idToken: idToken
      }
    };
    
    // Get full user data from server
    try {
      const userResponse = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${idToken}`
        }
      });
      
      if (userResponse.ok) {
        const userData = await userResponse.json();
        if (userData.user) {
          user.groups = userData.user.groups || [];
          user.permissions = userData.user.permissions || [];
          user.email = userData.user.email || user.email;
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
    
    return user;
  } catch (error: any) {
    console.error('Login error:', error);
    if (error.name === 'UserNotConfirmedException') {
      throw new AuthError('USER_NOT_CONFIRMED', 'Please confirm your account before logging in');
    }
    throw new AuthError('LOGIN_FAILED', error.message || 'Failed to login');
  }
};

// Logout function
export const logout = async (): Promise<void> => {
  try {
    await signOut();
  } catch (error: any) {
    console.error('Logout error:', error);
    throw new AuthError('LOGOUT_FAILED', error.message || 'Failed to logout');
  }
};

// Register a new user
export const register = async ({ username, password, email, phone_number }: RegisterParams): Promise<void> => {
  try {
    // Check if username is email, if not, use email attribute
    const isEmailUsername = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username);
    const attributes: Array<{ Name: string; Value: string }> = [];
    
    if (!isEmailUsername && email) {
      attributes.push({ 
        Name: 'email',
        Value: email
      });
    }
    
    if (phone_number) {
      attributes.push({
        Name: 'phone_number',
        Value: phone_number
      });
    }
    
    // Calculate SECRET_HASH
    const secretHash = cognitoConfig.clientSecret ? calculateSecretHash(username) : undefined;
    
    // Log for debugging
    console.log('Registration: Using secret hash:', !!secretHash);
    
    if (!cognitoConfig.isConfigValid || !cognitoClient) {
      throw new Error('Cognito configuration is invalid');
    }
    
    // Use AWS SDK directly to ensure SECRET_HASH is passed correctly
    const command = new SignUpCommand({
      ClientId: cognitoConfig.clientId,
      Username: username,
      Password: password,
      ...(secretHash && { SecretHash: secretHash }),
      UserAttributes: attributes
    });
    
    await cognitoClient.send(command);
  } catch (error: any) {
    console.error('Registration error:', error);
    if (error.name === 'UsernameExistsException') {
      throw new AuthError('USERNAME_EXISTS', 'Username already exists');
    }
    throw new AuthError('REGISTRATION_FAILED', error.message || 'Failed to register');
  }
};

// Confirm registration with verification code
export const confirmRegistration = async ({ username, code }: ConfirmRegistrationParams): Promise<void> => {
  try {
    // Calculate SECRET_HASH if client secret exists
    const secretHash = cognitoConfig.clientSecret ? calculateSecretHash(username) : undefined;
    
    await confirmSignUp({
      username,
      confirmationCode: code,
      options: {
        secretHash: secretHash
      }
    });
  } catch (error: any) {
    console.error('Confirmation error:', error);
    if (error.name === 'CodeMismatchException') {
      throw new AuthError('CODE_MISMATCH', 'Invalid confirmation code');
    }
    if (error.name === 'ExpiredCodeException') {
      throw new AuthError('CODE_EXPIRED', 'Confirmation code has expired');
    }
    throw new AuthError('CONFIRMATION_FAILED', error.message || 'Failed to confirm registration');
  }
};

// Initiate reset password
export const resetPasswordHelper = async ({ username }: ResetPasswordParams): Promise<void> => {
  try {
    // Calculate SECRET_HASH if client secret exists
    const secretHash = cognitoConfig.clientSecret ? calculateSecretHash(username) : undefined;
    
    await resetPassword({
      username,
      options: {
        secretHash: secretHash
      }
    });
  } catch (error: any) {
    console.error('Reset password error:', error);
    if (error.name === 'UserNotFoundException') {
      throw new AuthError('USER_NOT_FOUND', 'User not found');
    }
    throw new AuthError('RESET_PASSWORD_FAILED', error.message || 'Failed to reset password');
  }
};

// Confirm new password with verification code
export const confirmPassword = async ({ username, code, newPassword }: ConfirmPasswordParams): Promise<void> => {
  try {
    // Calculate SECRET_HASH if client secret exists
    const secretHash = cognitoConfig.clientSecret ? calculateSecretHash(username) : undefined;
    
    await confirmResetPassword({
      username,
      confirmationCode: code,
      newPassword,
      options: {
        secretHash: secretHash
      }
    });
  } catch (error: any) {
    console.error('Confirm password error:', error);
    if (error.name === 'CodeMismatchException') {
      throw new AuthError('CODE_MISMATCH', 'Invalid confirmation code');
    }
    if (error.name === 'ExpiredCodeException') {
      throw new AuthError('CODE_EXPIRED', 'Confirmation code has expired');
    }
    throw new AuthError('CONFIRM_PASSWORD_FAILED', error.message || 'Failed to confirm password reset');
  }
};

// Resend confirmation code
export const resendConfirmationCode = async (username: string): Promise<void> => {
  try {
    // Calculate SECRET_HASH if client secret exists
    const secretHash = cognitoConfig.clientSecret ? calculateSecretHash(username) : undefined;
    
    await resendSignUpCode({
      username,
      options: {
        secretHash: secretHash
      }
    });
  } catch (error: any) {
    console.error('Resend confirmation code error:', error);
    if (error.name === 'UserNotFoundException') {
      throw new AuthError('USER_NOT_FOUND', 'User not found');
    }
    if (error.name === 'LimitExceededException') {
      throw new AuthError('LIMIT_EXCEEDED', 'Attempt limit exceeded, please try again later');
    }
    throw new AuthError('RESEND_CODE_FAILED', error.message || 'Failed to resend confirmation code');
  }
};

// Get user groups (server-side only)
export const getUserGroups = async (username: string): Promise<string[]> => {
  try {
    if (!cognitoClient || !cognitoConfig.userPoolId) {
      console.warn('Cognito client or User Pool ID not configured');
      return [];
    }

    const command = new AdminListGroupsForUserCommand({
      UserPoolId: cognitoConfig.userPoolId,
      Username: username,
    });
    
    const response = await cognitoClient.send(command);
    
    return (response.Groups || []).map(group => group.GroupName || '').filter(Boolean);
  } catch (error) {
    console.error('Error getting user groups:', error);
    return [];
  }
};

// Get user permissions based on groups
export const getUserPermissions = (groups: string[]): string[] => {
  const permissions = new Set<string>();
  
  groups.forEach(group => {
    const groupPermissions = PERMISSIONS[group as keyof typeof PERMISSIONS] || [];
    groupPermissions.forEach(permission => permissions.add(permission));
  });
  
  return Array.from(permissions);
};

// Check if user has permission
export const hasPermission = (user: AuthUser | null, permission: string): boolean => {
  if (!user) return false;
  return user.permissions.includes(permission);
};

// Check if user has one of the given permissions
export const hasAnyPermission = (user: AuthUser | null, permissions: string[]): boolean => {
  if (!user) return false;
  return permissions.some(permission => user.permissions.includes(permission));
};

// Check if user belongs to a group
export const isInGroup = (user: AuthUser | null, group: string): boolean => {
  if (!user) return false;
  return user.groups.includes(group);
};

// Check if user is admin
export const isAdmin = (user: AuthUser | null): boolean => {
  return isInGroup(user, USER_GROUPS.ADMIN);
};

// Add user to a Cognito group (server-side only)
export const addUserToGroup = async (username: string, groupName: string): Promise<boolean> => {
  try {
    if (!cognitoClient || !cognitoConfig.userPoolId) {
      console.warn('Cognito client or User Pool ID not configured');
      return false;
    }

    const command = new AdminAddUserToGroupCommand({
      UserPoolId: cognitoConfig.userPoolId,
      Username: username,
      GroupName: groupName
    });
    
    await cognitoClient.send(command);
    return true;
  } catch (error) {
    console.error('Error adding user to group:', error);
    return false;
  }
};

/**
 * Refresh authentication tokens using a refresh token
 * @param refreshToken The refresh token to use for generating new tokens
 * @returns New ID token and access token
 */
export const refreshTokens = async (refreshToken: string) => {
  try {
    // Use the fetchAuthSession to get new tokens
    const authSession = await fetchAuthSession({
      forceRefresh: true
    });

    if (!authSession.tokens) {
      throw new Error('Failed to get new tokens');
    }

    return {
      idToken: authSession.tokens.idToken?.toString() || '',
      accessToken: authSession.tokens.accessToken?.toString() || ''
    };
  } catch (error: any) {
    console.error('Token refresh error:', error);
    throw new AuthError('REFRESH_TOKEN_FAILED', error.message || 'Failed to refresh tokens');
  }
}; 