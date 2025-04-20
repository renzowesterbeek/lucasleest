'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';

interface LoginError {
  message: string;
  remainingAttempts?: number;
  resetTime?: string;
  userConfirmationRequired?: boolean;
  username?: string;
}

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<LoginError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { login, isInitializing, configError } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      // First, perform client-side authentication with Cognito
      await login(username, password);
      
      // If login is successful, redirect to admin dashboard
      router.push('/admin');
    } catch (error: unknown) {
      console.error('Login error:', error);
      
      let errorMessage = 'Login failed. Please check your credentials.';
      
      // Handle known Cognito error codes
      if (error instanceof Error) {
        if (error.name === 'UserNotConfirmedException') {
          errorMessage = 'Please confirm your account before logging in.';
          setError({
            message: errorMessage,
            userConfirmationRequired: true,
            username
          });
        } else if (error.name === 'NotAuthorizedException') {
          errorMessage = 'Incorrect username or password.';
          setError({ message: errorMessage });
        } else if (error.name === 'UserNotFoundException') {
          errorMessage = 'User does not exist.';
          setError({ message: errorMessage });
        } else if (error.message) {
          errorMessage = error.message;
          setError({ message: errorMessage });
        } else {
          setError({ message: errorMessage });
        }
      } else {
        setError({ message: errorMessage });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    router.push('/reset-password');
  };

  const handleResendConfirmation = async () => {
    if (!error?.username) {
      setError({ message: 'Username is required for confirmation' });
      return;
    }
    
    const username = error.username;
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/auth/resend-confirmation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setError({ 
          message: 'Confirmation code sent. Please check your email.',
          username
        });
      } else {
        setError({ 
          message: data.error || 'Failed to resend confirmation code',
          username
        });
      }
    } catch {
      setError({ 
        message: 'Failed to resend confirmation code',
        username
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Show configuration error if Cognito is not properly set up
  if (configError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full p-8 bg-white rounded-lg shadow">
          <div className="p-4 mb-4 bg-red-100 text-red-700 rounded-md">
            <h2 className="text-lg font-semibold">Configuration Error</h2>
            <p>{configError}</p>
            <p className="mt-2 text-sm">Please check your environment variables and ensure AWS Cognito is properly configured.</p>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state while initializing auth
  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full p-8 bg-white rounded-lg shadow text-center">
          <p className="text-gray-500">Loading authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Admin Login
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sign in to your account
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="username"
              name="username"
              type="email"
              required
              className="mt-1 appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
              placeholder="Email address"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="mt-1 appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center whitespace-pre-line">
              {error.message}
              
              {error.userConfirmationRequired && (
                <button 
                  type="button"
                  onClick={handleResendConfirmation}
                  className="mt-2 block w-full text-indigo-600 hover:text-indigo-500"
                  disabled={isLoading}
                >
                  Resend confirmation code
                </button>
              )}
            </div>
          )}

          <div className="flex flex-col space-y-4">
            <button
              type="submit"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
            
            <div className="text-sm">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-indigo-600 hover:text-indigo-500"
                disabled={isLoading}
              >
                Forgot your password?
              </button>
            </div>
            
            <div className="text-sm mt-4">
              <Link href="/register" className="text-indigo-600 hover:text-indigo-500">
                Need an account? Register here
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
} 