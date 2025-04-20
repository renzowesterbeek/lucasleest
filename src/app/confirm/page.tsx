'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

// Create a separate client component that uses useSearchParams
function ConfirmPageContent() {
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    const usernameParam = searchParams.get('username');
    if (usernameParam) {
      setUsername(usernameParam);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!username) {
      setError('Email is required');
      return;
    }
    
    if (!code) {
      setError('Confirmation code is required');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/auth/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          code,
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setConfirmed(true);
      } else {
        setError(data.error || 'Confirmation failed');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!username) {
      setError('Email is required');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/auth/resend-confirmation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setError('Confirmation code has been resent to your email');
      } else {
        setError(data.error || 'Failed to resend confirmation code');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (confirmed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Account Confirmed
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Your account has been successfully verified.
            </p>
          </div>
          
          <div className="mt-6">
            <Link 
              href="/login"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Confirm Your Account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter the confirmation code sent to your email
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
            <label htmlFor="code" className="block text-sm font-medium text-gray-700">
              Confirmation Code
            </label>
            <input
              id="code"
              name="code"
              type="text"
              required
              className="mt-1 appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
              placeholder="Confirmation Code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center">
              {error}
            </div>
          )}

          <div className="flex flex-col space-y-4">
            <button
              type="submit"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              disabled={isLoading}
            >
              {isLoading ? 'Confirming...' : 'Confirm Account'}
            </button>
            
            <button
              type="button"
              onClick={handleResendCode}
              className="text-indigo-600 hover:text-indigo-500 text-sm text-center"
              disabled={isLoading}
            >
              Resend confirmation code
            </button>
            
            <Link 
              href="/login"
              className="text-gray-500 hover:text-gray-700 text-sm text-center"
            >
              Back to Login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

// Main component with Suspense
export default function ConfirmPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
          <div className="text-center">
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <ConfirmPageContent />
    </Suspense>
  );
} 