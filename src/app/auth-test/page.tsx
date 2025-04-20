'use client';

import { AuthStatus } from '@/components/AuthStatus';
import { AdminGroupManager } from '@/components/AdminGroupManager';
import Link from 'next/link';
import { cognitoConfig } from '@/config/cognito-config';
import { useAuth } from '@/lib/AuthContext';

// Debug component for Cognito configuration
function CognitoDebug() {
  return (
    <div className="mt-8 p-4 bg-gray-100 rounded-md">
      <h2 className="text-lg font-bold mb-2">Cognito Configuration</h2>
      <pre className="text-sm overflow-auto p-2 bg-gray-800 text-white rounded">
        {JSON.stringify({
          region: cognitoConfig.region,
          userPoolId: cognitoConfig.userPoolId,
          clientId: cognitoConfig.clientId,
          isConfigValid: cognitoConfig.isConfigValid
        }, null, 2)}
      </pre>
      
      <div className="mt-4">
        <h3 className="font-semibold">Valid User Pool Format Example:</h3>
        <code className="bg-gray-200 p-1 text-sm">eu-west-1_abcdefgh1</code>
        <p className="text-sm mt-2">The User Pool ID should contain the region code followed by an underscore and a unique identifier.</p>
      </div>
      
      <div className="mt-4">
        <a 
          href="/api/test-cognito" 
          target="_blank" 
          rel="noopener noreferrer"
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 inline-block text-sm"
        >
          Test Cognito Configuration
        </a>
        <p className="text-sm mt-2">
          This will test your AWS credentials and verify if the User Pool ID exists in your AWS account.
        </p>
      </div>
    </div>
  );
}

export default function AuthTestPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Authentication Test Page</h1>
      
      <div className="mb-6">
        <AuthStatus />
      </div>
      
      {!isAuthenticated && (
        <div className="flex gap-4 mb-8">
          <Link 
            href="/login" 
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Go to Login
          </Link>
          <Link 
            href="/register" 
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Go to Register
          </Link>
        </div>
      )}
      
      {isAuthenticated && <AdminGroupManager />}
      
      <CognitoDebug />
    </div>
  );
} 