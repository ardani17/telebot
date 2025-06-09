import React, { useState, useEffect } from 'react';
import {
  Users as UsersIcon,
  Plus,
  Edit,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Shield,
  User as UserIcon,
  Search,
  RefreshCw,
} from 'lucide-react';
import { api } from '@/lib/api';
import { User, CreateUserData, UpdateUserData } from '@/types/user';

interface UserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  user?: User | null;
  onSuccess: () => void;
}

function UserDialog({ isOpen, onClose, user, onSuccess }: UserDialogProps) {
  const [formData, setFormData] = useState<CreateUserData>({
    telegramId: '',
    name: '',
    username: '',
    password: '',
    role: 'USER',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFormData({
        telegramId: user.telegramId,
        name: user.name,
        username: user.username || '',
        password: '', // Always empty for security
        role: user.role,
      });
    } else {
      setFormData({
        telegramId: '',
        name: '',
        username: '',
        password: '',
        role: 'USER',
      });
    }
    setError(null);
  }, [user, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (user) {
        // Update user
        const updateData: UpdateUserData = {
          name: formData.name,
          username: formData.username || undefined,
          role: formData.role,
        };
        // Only include password if it's provided
        if (formData.password && formData.password.trim() !== '') {
          updateData.password = formData.password;
        }
        await api.patch(`/users/${user.id}`, updateData);
      } else {
        // Create user
        await api.post('/users', formData);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
      <div className='bg-white rounded-lg p-6 w-full max-w-md'>
        <h2 className='text-lg font-semibold mb-4'>{user ? 'Edit User' : 'Create New User'}</h2>

        {error && (
          <div className='mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded'>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className='space-y-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1' htmlFor='telegram-id'>
              Telegram ID
            </label>
            <input
              id='telegram-id'
              type='text'
              value={formData.telegramId}
              onChange={e => setFormData(prev => ({ ...prev, telegramId: e.target.value }))}
              className='w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              required
              disabled={!!user} // Can't change telegram ID when editing
            />
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1' htmlFor='name'>
              Name
            </label>
            <input
              id='name'
              type='text'
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className='w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              required
            />
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1' htmlFor='username'>
              Username (optional)
            </label>
            <input
              id='username'
              type='text'
              value={formData.username}
              onChange={e => setFormData(prev => ({ ...prev, username: e.target.value }))}
              className='w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            />
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1' htmlFor='password'>
              Password {user ? '(leave empty to keep current)' : '(optional)'}
            </label>
            <input
              id='password'
              type='password'
              value={formData.password}
              onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
              className='w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              placeholder={user ? 'Enter new password to change' : 'Enter password'}
            />
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1' htmlFor='role'>
              Role
            </label>
            <select
              id='role'
              value={formData.role}
              onChange={e =>
                setFormData(prev => ({ ...prev, role: e.target.value as 'USER' | 'ADMIN' }))
              }
              className='w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            >
              <option value='USER'>User</option>
              <option value='ADMIN'>Admin</option>
            </select>
          </div>

          <div className='flex justify-end space-x-3 pt-4'>
            <button
              type='button'
              onClick={onClose}
              className='px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300'
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type='submit'
              className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50'
              disabled={loading}
            >
              {loading ? 'Saving...' : user ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/users');
      setUsers(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleDeleteUser = async (user: User) => {
    if (
      !confirm(`Are you sure you want to delete user "${user.name}"? This action cannot be undone.`)
    ) {
      return;
    }

    try {
      await api.delete(`/users/${user.id}`);
      await fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete user');
    }
  };

  const handleToggleStatus = async (user: User) => {
    try {
      await api.patch(`/users/${user.id}/toggle-status`);
      await fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to toggle user status');
    }
  };

  const filteredUsers = users.filter(
    user =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.telegramId.includes(searchTerm) ||
      user.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className='flex items-center justify-center min-h-96'>
        <div className='animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600'></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className='mb-8'>
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='text-2xl font-bold text-gray-900'>User Management</h1>
            <p className='mt-1 text-sm text-gray-600'>
              Manage users, roles, and access permissions
            </p>
          </div>
          <button
            onClick={() => {
              setEditingUser(null);
              setIsDialogOpen(true);
            }}
            className='inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
          >
            <Plus className='h-4 w-4 mr-2' />
            Add User
          </button>
        </div>
      </div>

      {/* Search and Actions */}
      <div className='mb-6 flex items-center justify-between'>
        <div className='relative'>
          <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4' />
          <input
            type='text'
            placeholder='Search users...'
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className='pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent'
          />
        </div>
        <button
          onClick={fetchUsers}
          className='inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50'
        >
          <RefreshCw className='h-4 w-4 mr-2' />
          Refresh
        </button>
      </div>

      {error && (
        <div className='mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded'>
          {error}
        </div>
      )}

      {/* Users Table */}
      <div className='bg-white shadow rounded-lg overflow-hidden'>
        <table className='min-w-full divide-y divide-gray-200'>
          <thead className='bg-gray-50'>
            <tr>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                User
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                Role
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                Password
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                Status
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                Features
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                Created
              </th>
              <th className='px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider'>
                Actions
              </th>
            </tr>
          </thead>
          <tbody className='bg-white divide-y divide-gray-200'>
            {filteredUsers.map(user => (
              <tr key={user.id} className='hover:bg-gray-50'>
                <td className='px-6 py-4 whitespace-nowrap'>
                  <div className='flex items-center'>
                    <div className='flex-shrink-0 h-8 w-8'>
                      {user.role === 'ADMIN' ? (
                        <Shield className='h-8 w-8 text-red-500' />
                      ) : (
                        <UserIcon className='h-8 w-8 text-gray-400' />
                      )}
                    </div>
                    <div className='ml-4'>
                      <div className='text-sm font-medium text-gray-900'>{user.name}</div>
                      <div className='text-sm text-gray-500'>
                        @{user.username || 'No username'} • ID: {user.telegramId}
                      </div>
                    </div>
                  </div>
                </td>
                <td className='px-6 py-4 whitespace-nowrap'>
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      user.role === 'ADMIN'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {user.role}
                  </span>
                </td>
                <td className='px-6 py-4 whitespace-nowrap'>
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      user.password ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {user.password ? 'Set' : 'Not Set'}
                  </span>
                </td>
                <td className='px-6 py-4 whitespace-nowrap'>
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      user.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                  {user.featureAccess.length} features
                </td>
                <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                  {formatDate(user.createdAt)}
                </td>
                <td className='px-6 py-4 whitespace-nowrap text-right text-sm font-medium'>
                  <div className='flex items-center justify-end space-x-2'>
                    <button
                      onClick={() => handleToggleStatus(user)}
                      className={`p-1 rounded ${
                        user.isActive
                          ? 'text-yellow-600 hover:text-yellow-900'
                          : 'text-green-600 hover:text-green-900'
                      }`}
                      title={user.isActive ? 'Deactivate user' : 'Activate user'}
                    >
                      {user.isActive ? (
                        <ToggleRight className='h-4 w-4' />
                      ) : (
                        <ToggleLeft className='h-4 w-4' />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setEditingUser(user);
                        setIsDialogOpen(true);
                      }}
                      className='text-blue-600 hover:text-blue-900 p-1 rounded'
                      title='Edit user'
                    >
                      <Edit className='h-4 w-4' />
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user)}
                      className='text-red-600 hover:text-red-900 p-1 rounded'
                      title='Delete user'
                    >
                      <Trash2 className='h-4 w-4' />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredUsers.length === 0 && (
          <div className='text-center py-12'>
            <UsersIcon className='mx-auto h-12 w-12 text-gray-400' />
            <h3 className='mt-2 text-sm font-medium text-gray-900'>No users found</h3>
            <p className='mt-1 text-sm text-gray-500'>
              {searchTerm
                ? 'Try adjusting your search terms.'
                : 'Get started by creating a new user.'}
            </p>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className='mt-6 grid grid-cols-1 md:grid-cols-3 gap-4'>
        <div className='bg-white p-4 rounded-lg shadow'>
          <div className='flex items-center'>
            <UsersIcon className='h-6 w-6 text-blue-500' />
            <span className='ml-2 text-sm font-medium text-gray-600'>Total Users</span>
          </div>
          <p className='mt-2 text-2xl font-semibold text-gray-900'>{users.length}</p>
        </div>
        <div className='bg-white p-4 rounded-lg shadow'>
          <div className='flex items-center'>
            <Shield className='h-6 w-6 text-red-500' />
            <span className='ml-2 text-sm font-medium text-gray-600'>Admins</span>
          </div>
          <p className='mt-2 text-2xl font-semibold text-gray-900'>
            {users.filter(u => u.role === 'ADMIN').length}
          </p>
        </div>
        <div className='bg-white p-4 rounded-lg shadow'>
          <div className='flex items-center'>
            <ToggleRight className='h-6 w-6 text-green-500' />
            <span className='ml-2 text-sm font-medium text-gray-600'>Active Users</span>
          </div>
          <p className='mt-2 text-2xl font-semibold text-gray-900'>
            {users.filter(u => u.isActive).length}
          </p>
        </div>
      </div>

      {/* User Dialog */}
      <UserDialog
        isOpen={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false);
          setEditingUser(null);
        }}
        user={editingUser}
        onSuccess={fetchUsers}
      />
    </div>
  );
}
