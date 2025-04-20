'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Amplify } from 'aws-amplify';
import { signOut, fetchUserAttributes, getCurrentUser } from 'aws-amplify/auth';
import { awsConfig } from './auth/awsConfig';
import { 
  CognitoIdentityProviderClient, 
  InitiateAuthCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  AuthFlowType
} from "@aws-sdk/client-cognito-identity-provider";
import { calculateSecretHash } from './auth/utils';
import { USER_GROUPS } from '@/config/cognito-config';

// Don't initialize Amplify here - we'll do it in useEffect

// Define user interface
interface User {
  username: string;
  email?: string;
  groups?: string[];
  permissions?: string[];
  attributes?: Record<string, string>;
}

// Define Auth Context interface
interface AuthContextType {
  isAuthenticated: boolean;
  isInitializing: boolean;
  user: User | null;
  login: (username: string, password: string) => Promise<unknown>;
  register: (username: string, password: string, email: string) => Promise<unknown>;
  confirmRegistration: (username: string, code: string) => Promise<unknown>;
  logout: () => Promise<void>;
  forgotPassword: (username: string) => Promise<unknown>;
  confirmPassword: (username: string, code: string, newPassword: string) => Promise<unknown>;
  isAdmin: boolean;
  configError: string | null;
}

// Create the Auth Context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth Provider Props
interface AuthProviderProps {
  children: ReactNode;
}

// Auth Provider Component
export function AuthProvider({ children }: AuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [user, setUser] = useState<User | null>(null);
  const [isAmplifyConfigured, setIsAmplifyConfigured] = useState<boolean>(false);
  const [cognitoClient, setCognitoClient] = useState<CognitoIdentityProviderClient | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  
  // Configuration values
  const region = process.env.NEXT_PUBLIC_AWS_REGION || 'eu-west-1';
  const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '';
  const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '';
  const clientSecret = process.env.NEXT_PUBLIC_COGNITO_CLIENT_SECRET || '';

  // Compute isAdmin from user groups
  const isAdmin = user?.groups?.includes(USER_GROUPS.ADMIN) || false;

  // Function to check current auth state (defined using useCallback to avoid dependency issues)
  const checkAuthState = useCallback(async () => {
    try {
      setIsInitializing(true);
      
      if (configError) {
        setIsInitializing(false);
        return;
      }
      
      // First check if we have tokens in localStorage
      if (typeof window !== 'undefined') {
        const accessToken = localStorage.getItem('accessToken');
        const idToken = localStorage.getItem('idToken');
        const username = localStorage.getItem('username');
        const groups = localStorage.getItem('userGroups');
        
        if (accessToken && idToken && username) {
          try {
            const user: User = {
              username: username,
              email: username.includes('@') ? username : undefined,
              groups: groups ? JSON.parse(groups) : []
            };
            
            setUser(user);
            setIsAuthenticated(true);
            
            // Also try to fetch user attributes from Amplify for more details
            try {
              // Remove the unused currentUser assignment
              await getCurrentUser();
              const attributes = await fetchUserAttributes();
              
              // Update user with additional details
              setUser(prev => {
                if (!prev) return prev;
                return {
                  ...prev,
                  email: attributes.email || prev.email,
                  attributes: attributes as unknown as Record<string, string>
                };
              });
            } catch (e) {
              // Continue with basic user info if Amplify fetch fails
              console.log('Error fetching additional user details:', e);
            }
            
            setIsInitializing(false);
            return;
          } catch (e) {
            console.log('Error with stored tokens:', e);
            // Clear invalid tokens
            localStorage.removeItem('accessToken');
            localStorage.removeItem('idToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('username');
            localStorage.removeItem('userGroups');
          }
        }
      }
      
      // If no valid tokens in localStorage, try Amplify auth check
      try {
        const currentUser = await getCurrentUser();
        const attributes = await fetchUserAttributes();
        
        setUser({
          username: currentUser.username,
          email: attributes.email,
          attributes: attributes as unknown as Record<string, string>
        });
        setIsAuthenticated(true);
      } catch (error) {
        console.log('Not authenticated:', error);
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsInitializing(false);
    }
  }, [configError]);

  // Initialize Amplify and Cognito client on component mount (client-side only)
  useEffect(() => {
    try {
      if (!userPoolId || !clientId) {
        setConfigError('AWS Cognito is not properly configured. Please check your environment variables.');
        setIsInitializing(false);
        return;
      }

      // Log configuration for debugging
      console.log('Cognito configuration:', {
        region,
        userPoolId,
        clientId,
        hasClientSecret: !!clientSecret,
        clientSecretLength: clientSecret?.length
      });

      // Configure Amplify
      Amplify.configure(awsConfig);
      console.log('Amplify configured');
      setIsAmplifyConfigured(true);
      
      // Initialize the Cognito client (only in browser context)
      if (typeof window !== 'undefined') {
        const client = new CognitoIdentityProviderClient({ 
          region: region 
        });
        setCognitoClient(client);
        console.log('Cognito client initialized');
      }
    } catch (error) {
      console.error('Error configuring auth services:', error);
      setConfigError('Failed to initialize authentication services.');
    }
  }, [region, userPoolId, clientId, clientSecret]);

  // Check authentication status after services are configured
  useEffect(() => {
    if (isAmplifyConfigured) {
      checkAuthState();
    }
  }, [isAmplifyConfigured, checkAuthState]);

  // Login function using CognitoIdentityProviderClient
  const login = async (username: string, password: string) => {
    if (!cognitoClient) {
      throw new Error('Cognito client not initialized');
    }
    
    setIsInitializing(true);
    setConfigError(null);
    
    try {
      // Calculate the secret hash using browser-compatible utility
      // Only attempt to calculate if clientSecret is not empty
      let secretHash = '';
      if (clientSecret) {
        try {
          secretHash = await calculateSecretHash(username, clientId, clientSecret);
          console.log('Secret hash calculated successfully');
        } catch (hashError) {
          console.error('Error calculating secret hash:', hashError);
        }
      } else {
        console.log('No client secret available, skipping secret hash calculation');
      }
      
      // Prepare the auth parameters
      const params = {
        ClientId: clientId,
        AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
        AuthParameters: {
          USERNAME: username,
          PASSWORD: password,
          ...(secretHash ? { SECRET_HASH: secretHash } : {})
        }
      };
      
      console.log('Login attempt with params:', {
        ...params,
        AuthParameters: {
          ...params.AuthParameters,
          PASSWORD: '******', // Don't log the actual password
          ...(secretHash ? { SECRET_HASH: '[SECRET_HASH_PRESENT]' } : {})
        }
      });
      
      // Execute the InitiateAuth command
      const command = new InitiateAuthCommand(params);
      const response = await cognitoClient.send(command);
      
      console.log('Sign in successful:', !!response.AuthenticationResult);
      
      if (response.AuthenticationResult) {
        // Store tokens in localStorage for persistence between page refreshes
        if (typeof window !== 'undefined' && response.AuthenticationResult) {
          localStorage.setItem('accessToken', response.AuthenticationResult.AccessToken || '');
          localStorage.setItem('refreshToken', response.AuthenticationResult.RefreshToken || '');
          localStorage.setItem('idToken', response.AuthenticationResult.IdToken || '');
          localStorage.setItem('username', username);
        }
        
        // Set user state with username
        setUser({
          username: username,
          email: username.includes('@') ? username : undefined
        });
        
        setIsAuthenticated(true);
        
        // Important: Send idToken to API to set HTTP-only cookie for server-side auth
        try {
          const cookieResponse = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              username,
              password: 'REDACTED', // Password not needed by API but required by validation
              idToken: response.AuthenticationResult.IdToken
            }),
          });
          
          if (!cookieResponse.ok) {
            console.error('Failed to set authentication cookie:', await cookieResponse.json());
          } else {
            console.log('Authentication cookie set successfully');
          }
        } catch (e) {
          console.error('Error setting authentication cookie:', e);
        }
        
        // After successful sign-in, try to fetch full user details
        try {
          // Call the API to get user details including groups
          console.log('Fetching user details with token');
          const userResponse = await fetch('/api/auth/me', {
            headers: {
              Authorization: `Bearer ${response.AuthenticationResult.IdToken}`
            }
          });
          
          if (userResponse.ok) {
            const userData = await userResponse.json();
            console.log('User data fetched successfully:', userData);
            if (userData.user) {
              const groups = userData.user.groups || [];
              const permissions = userData.user.permissions || [];
              
              // Update the user object with groups and permissions
              setUser(prev => ({
                ...prev!,
                groups,
                permissions,
                email: userData.user.email || prev?.email
              }));
              
              // Store groups in localStorage
              if (typeof window !== 'undefined') {
                localStorage.setItem('userGroups', JSON.stringify(groups));
              }
            }
          } else {
            const errorText = await userResponse.text();
            console.error('Failed to fetch user data. Status:', userResponse.status, 'Response:', errorText);
          }
        } catch (e) {
          console.error('Error fetching user data:', e);
        }
      }
      
      return response;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsInitializing(false);
    }
  };

  // Register function
  const register = async (username: string, password: string, email: string) => {
    if (!cognitoClient) {
      throw new Error('Cognito client not initialized');
    }
    
    try {
      // Calculate the secret hash only if clientSecret exists
      let secretHash = '';
      if (clientSecret) {
        try {
          secretHash = await calculateSecretHash(username, clientId, clientSecret);
        } catch (error) {
          console.error('Error calculating secret hash for registration:', error);
        }
      }
      
      // Prepare the sign-up parameters
      const params = {
        ClientId: clientId,
        ...(secretHash ? { SecretHash: secretHash } : {}),
        Username: username,
        Password: password,
        UserAttributes: [
          {
            Name: 'email',
            Value: email
          }
        ]
      };
      
      // Execute the SignUp command
      const command = new SignUpCommand(params);
      const response = await cognitoClient.send(command);
      
      console.log('Registration result:', response);
      return response;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  // Confirm registration function
  const confirmRegistration = async (username: string, code: string) => {
    if (!cognitoClient) {
      throw new Error('Cognito client not initialized');
    }
    
    try {
      // Calculate the secret hash only if clientSecret exists
      let secretHash = '';
      if (clientSecret) {
        try {
          secretHash = await calculateSecretHash(username, clientId, clientSecret);
        } catch (error) {
          console.error('Error calculating secret hash for confirmation:', error);
        }
      }
      
      // Prepare the confirm sign-up parameters
      const params = {
        ClientId: clientId,
        ...(secretHash ? { SecretHash: secretHash } : {}),
        Username: username,
        ConfirmationCode: code
      };
      
      // Execute the ConfirmSignUp command
      const command = new ConfirmSignUpCommand(params);
      const response = await cognitoClient.send(command);
      
      console.log('Confirm registration result:', response);
      return response;
    } catch (error) {
      console.error('Confirm registration error:', error);
      throw error;
    }
  };

  // Logout function
  const logout = async () => {
    setIsInitializing(true);
    
    try {
      // Clear localStorage tokens
      if (typeof window !== 'undefined') {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('idToken');
        localStorage.removeItem('username');
        localStorage.removeItem('userGroups');
      }
      
      // Call Amplify signOut
      await signOut();
      setUser(null);
      setIsAuthenticated(false);
      
      // Call API logout to clear cookies
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    } finally {
      setIsInitializing(false);
    }
  };

  // Forgot Password function
  const forgotPassword = async (username: string) => {
    if (!cognitoClient) {
      throw new Error('Cognito client not initialized');
    }
    
    try {
      // Calculate the secret hash only if clientSecret exists
      let secretHash = '';
      if (clientSecret) {
        try {
          secretHash = await calculateSecretHash(username, clientId, clientSecret);
        } catch (error) {
          console.error('Error calculating secret hash for forgot password:', error);
        }
      }
      
      // Prepare the forgot password parameters
      const params = {
        ClientId: clientId,
        ...(secretHash ? { SecretHash: secretHash } : {}),
        Username: username
      };
      
      // Execute the ForgotPassword command
      const command = new ForgotPasswordCommand(params);
      const response = await cognitoClient.send(command);
      
      console.log('Forgot password result:', response);
      return response;
    } catch (error) {
      console.error('Forgot password error:', error);
      throw error;
    }
  };

  // Confirm Password Reset function
  const confirmPassword = async (username: string, code: string, newPassword: string) => {
    if (!cognitoClient) {
      throw new Error('Cognito client not initialized');
    }
    
    try {
      // Calculate the secret hash only if clientSecret exists
      let secretHash = '';
      if (clientSecret) {
        try {
          secretHash = await calculateSecretHash(username, clientId, clientSecret);
        } catch (error) {
          console.error('Error calculating secret hash for password reset:', error);
        }
      }
      
      // Prepare the confirm password parameters
      const params = {
        ClientId: clientId,
        ...(secretHash ? { SecretHash: secretHash } : {}),
        Username: username,
        ConfirmationCode: code,
        Password: newPassword
      };
      
      // Execute the ConfirmForgotPassword command
      const command = new ConfirmForgotPasswordCommand(params);
      const response = await cognitoClient.send(command);
      
      console.log('Confirm password reset result:', response);
      return response;
    } catch (error) {
      console.error('Confirm password reset error:', error);
      throw error;
    }
  };

  const contextValue: AuthContextType = {
    isAuthenticated,
    isInitializing,
    user,
    login,
    register,
    confirmRegistration,
    logout,
    forgotPassword,
    confirmPassword,
    isAdmin,
    configError
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use Auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 