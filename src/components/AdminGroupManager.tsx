'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { USER_GROUPS } from '@/config/cognito-config';

export function AdminGroupManager() {
  const { isAdmin } = useAuth();
  const [username, setUsername] = useState('');
  const [selectedGroup, setSelectedGroup] = useState(USER_GROUPS.USER);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Only admins should see this component
  if (!isAdmin) {
    return null;
  }

  const handleAddToGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !selectedGroup) {
      setStatus({
        type: 'error',
        message: 'Please provide both username and group'
      });
      return;
    }
    
    try {
      setIsLoading(true);
      setStatus({ type: 'info', message: 'Adding user to group...' });
      
      const response = await fetch('/api/auth/add-to-group', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          groupName: selectedGroup
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setStatus({
          type: 'success',
          message: data.message || `User added to ${selectedGroup} group successfully`
        });
        setUsername('');
      } else {
        setStatus({
          type: 'error',
          message: data.error || 'Failed to add user to group'
        });
      }
    } catch (error) {
      setStatus({
        type: 'error',
        message: 'An error occurred while adding user to group'
      });
      console.error('Error adding user to group:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-8 p-4 bg-white rounded-md shadow-sm border border-gray-200">
      <h2 className="text-xl font-bold mb-4">Admin: Manage User Groups</h2>
      
      {status && (
        <div className={`p-3 mb-4 rounded ${
          status.type === 'success' ? 'bg-green-100 text-green-700' :
          status.type === 'error' ? 'bg-red-100 text-red-700' :
          'bg-blue-100 text-blue-700'
        }`}>
          {status.message}
        </div>
      )}
      
      <form onSubmit={handleAddToGroup} className="space-y-4">
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
            Username or Email
          </label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter username or email"
            required
          />
        </div>
        
        <div>
          <label htmlFor="group" className="block text-sm font-medium text-gray-700 mb-1">
            Group
          </label>
          <select
            id="group"
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            required
          >
            {Object.values(USER_GROUPS).map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </select>
        </div>
        
        <button
          type="submit"
          disabled={isLoading}
          className={`w-full px-4 py-2 text-white rounded-md ${
            isLoading ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'
          }`}
        >
          {isLoading ? 'Processing...' : 'Add User to Group'}
        </button>
      </form>
    </div>
  );
} 