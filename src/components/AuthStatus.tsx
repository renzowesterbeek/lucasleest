'use client';

import { useAuth } from '@/lib/AuthContext';

export function AuthStatus() {
  const { isLoading, isAuthenticated, user, isAdmin, configError } = useAuth();

  if (configError) {
    return (
      <div className="p-4 bg-yellow-100 text-yellow-700 rounded-md border border-yellow-300">
        <p className="font-bold">Configuration Error</p>
        <p>{configError}</p>
        <p className="text-sm mt-2">
          To fix this, make sure you have the correct AWS Cognito settings in your .env.local file:
        </p>
        <ul className="list-disc pl-5 text-sm mt-1">
          <li>NEXT_PUBLIC_AWS_REGION</li>
          <li>NEXT_PUBLIC_COGNITO_USER_POOL_ID</li>
          <li>NEXT_PUBLIC_COGNITO_CLIENT_ID</li>
        </ul>
      </div>
    );
  }

  if (isLoading) {
    return <div className="p-4 bg-gray-100 rounded-md">Loading authentication state...</div>;
  }

  if (!isAuthenticated) {
    return <div className="p-4 bg-red-100 rounded-md">Not authenticated</div>;
  }

  return (
    <div className="p-4 bg-green-100 rounded-md">
      <p className="font-bold">Authenticated</p>
      <p>Username: {user?.username}</p>
      <p>Email: {user?.email}</p>
      <p>Groups: {user?.groups.join(', ') || 'None'}</p>
      <p>Admin: {isAdmin ? 'Yes' : 'No'}</p>
    </div>
  );
} 