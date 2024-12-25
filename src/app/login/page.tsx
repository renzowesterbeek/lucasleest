'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface LoginError {
  message: string;
  remainingAttempts?: number;
  resetTime?: string;
}

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<LoginError | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (response.ok) {
        router.push('/admin');
      } else {
        let errorMessage = data.error;
        
        // Add remaining attempts info if available
        if (data.remainingAttempts !== undefined) {
          errorMessage += ` (${data.remainingAttempts} attempts remaining)`;
        }
        
        // Add reset time if available
        if (data.resetTime) {
          const resetTime = new Date(data.resetTime);
          errorMessage += `\nPlease try again after ${resetTime.toLocaleTimeString()}`;
        }
        
        setError({
          message: errorMessage,
          remainingAttempts: data.remainingAttempts,
          resetTime: data.resetTime
        });
      }
    } catch {
      setError({ message: 'Er is iets misgegaan' });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Admin Login
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="password" className="sr-only">
              Wachtwoord
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
              placeholder="Wachtwoord"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center whitespace-pre-line">
              {error.message}
            </div>
          )}

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              disabled={error?.remainingAttempts === 0}
            >
              Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 