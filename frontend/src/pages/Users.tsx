import React, { useState, useEffect } from 'react';
import {
  Users as UsersIcon,
  User as UserIcon,
  Shield,
  ToggleLeft,
  ToggleRight,
  Search,
  RefreshCw,
  Edit,
  Trash2,
  UserPlus,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { User } from '@/types/user';

interface UserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  user?: User | null;
  onSuccess: () => void;
}

interface UserFormData {
  name: string;
  username: string;
  telegramId: string;
  password: string;
  role: 'USER' | 'ADMIN';
  isActive: boolean;
}

function UserDialog({ isOpen, onClose, user, onSuccess }: UserDialogProps) {
  const [formData, setFormData] = useState<UserFormData>({
    name: '',
    username: '',
    telegramId: '',
    password: '',
    role: 'USER',
    isActive: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingUser, setCheckingUser] = useState(false);
  const [checkResult, setCheckResult] = useState<{ name?: string; username?: string } | null>(null);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name,
        username: user.username || '',
        telegramId: user.telegramId,
        password: '',
        role: user.role,
        isActive: user.isActive,
      });
    } else {
      setFormData({
        name: '',
        username: '',
        telegramId: '',
        password: '',
        role: 'USER',
        isActive: true,
      });
    }
    setError(null);
    setCheckResult(null);
  }, [user, isOpen]);

  const handleCheckUser = async () => {
    if (!formData.telegramId.trim()) {
      setError('Masukkan Telegram ID terlebih dahulu');
      return;
    }

    setCheckingUser(true);
    setError(null);
    setCheckResult(null);

    try {
      const response = await api.get(`/admin/users/check-telegram/${formData.telegramId}`);
      const userData = response.data;

      setCheckResult({
        name: userData.first_name + (userData.last_name ? ` ${userData.last_name}` : ''),
        username: userData.username,
      });

      // Auto-fill the form if data is found
      if (userData.first_name) {
        setFormData(prev => ({
          ...prev,
          name: userData.first_name + (userData.last_name ? ` ${userData.last_name}` : ''),
          username: userData.username || '',
        }));
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Tidak dapat mengecek informasi user');
    } finally {
      setCheckingUser(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (user) {
        // Update user
        const updateData: any = {
          name: formData.name,
          username: formData.username || null,
          role: formData.role,
          isActive: formData.isActive,
        };
        // Only include password if it's provided
        if (formData.password && formData.password.trim() !== '') {
          updateData.password = formData.password;
        }
        await api.patch(`/admin/users/${user.telegramId}`, updateData);
      } else {
        // Create user
        await api.post('/admin/users', formData);
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
    <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'>
      <div className='bg-white rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto'>
        <div className='flex items-center justify-between mb-4'>
          <h2 className='text-lg font-semibold'>{user ? 'Edit User' : 'Add User'}</h2>
          <button onClick={onClose} className='text-gray-400 hover:text-gray-600'>
            <XCircle className='h-6 w-6' />
          </button>
        </div>

        {error && (
          <div className='mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded'>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className='space-y-4'>
          <div>
            <label htmlFor='user-name' className='block text-sm font-medium text-gray-700 mb-1'>
              Name
            </label>
            <input
              id='user-name'
              type='text'
              required
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            />
          </div>

          <div>
            <label htmlFor='user-username' className='block text-sm font-medium text-gray-700 mb-1'>
              Username
            </label>
            <input
              id='user-username'
              type='text'
              value={formData.username}
              onChange={e => setFormData({ ...formData, username: e.target.value })}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              placeholder='Optional'
            />
          </div>

          <div>
            <label
              htmlFor='user-telegram-id'
              className='block text-sm font-medium text-gray-700 mb-1'
            >
              Telegram ID
            </label>
            <div className='flex space-x-2'>
              <input
                id='user-telegram-id'
                type='text'
                required
                value={formData.telegramId}
                onChange={e => setFormData({ ...formData, telegramId: e.target.value })}
                className='flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                readOnly={!!user}
                title={user ? 'Telegram ID cannot be changed for existing users' : ''}
              />
              <button
                type='button'
                onClick={handleCheckUser}
                disabled={checkingUser || !formData.telegramId.trim()}
                className='px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md border border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed'
              >
                {checkingUser ? 'Cek...' : 'Cek'}
              </button>
            </div>

            {/* Check Result Display */}
            {checkResult && (
              <div className='mt-2 p-3 bg-green-50 border border-green-200 rounded-md'>
                <div className='text-sm text-green-800'>
                  <div>
                    <strong>Nama:</strong> {checkResult.name || 'Tidak ada'}
                  </div>
                  <div>
                    <strong>Username:</strong> @{checkResult.username || 'Tidak ada'}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label htmlFor='user-password' className='block text-sm font-medium text-gray-700 mb-1'>
              Password {user && '(leave empty to keep current)'}
            </label>
            <input
              id='user-password'
              type='password'
              value={formData.password}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              required={!user}
            />
          </div>

          <div>
            <label htmlFor='user-role' className='block text-sm font-medium text-gray-700 mb-1'>
              Role
            </label>
            <select
              id='user-role'
              value={formData.role}
              onChange={e => setFormData({ ...formData, role: e.target.value as 'USER' | 'ADMIN' })}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            >
              <option value='USER'>User</option>
              <option value='ADMIN'>Admin</option>
            </select>
          </div>

          <div className='flex items-center space-x-2'>
            <input
              type='checkbox'
              id='isActive'
              checked={formData.isActive}
              onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
              className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
            />
            <label htmlFor='isActive' className='text-sm font-medium text-gray-700'>
              Active User
            </label>
          </div>

          <div className='flex justify-end space-x-3 pt-4'>
            <button
              type='button'
              onClick={onClose}
              className='px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md'
            >
              Cancel
            </button>
            <button
              type='submit'
              disabled={loading}
              className='px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50'
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
      const response = await api.get('/admin/users');
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
      await api.delete(`/admin/users/${user.telegramId}`);
      await fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete user');
    }
  };

  const handleToggleStatus = async (user: User) => {
    try {
      await api.patch(`/admin/users/${user.telegramId}`, {
        isActive: !user.isActive,
      });
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
    <div className='space-y-6'>
      {/* Header */}
      <div>
        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
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
            className='inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 whitespace-nowrap'
          >
            <UserPlus className='h-4 w-4 mr-2' />
            Add User
          </button>
        </div>
      </div>

      {/* Search and Actions */}
      <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
        <div className='relative flex-1 max-w-md'>
          <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4' />
          <input
            type='text'
            placeholder='Search users...'
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className='pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full'
          />
        </div>
        <button
          onClick={fetchUsers}
          className='inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 whitespace-nowrap'
        >
          <RefreshCw className='h-4 w-4 mr-2' />
          Refresh
        </button>
      </div>

      {error && (
        <div className='p-4 bg-red-100 border border-red-400 text-red-700 rounded-md'>{error}</div>
      )}

      {/* Users List - Mobile Card Layout */}
      <div className='lg:hidden space-y-4'>
        {filteredUsers.map(user => (
          <div key={user.id} className='bg-white rounded-lg shadow border p-4'>
            <div className='flex items-start justify-between mb-3'>
              <div className='flex items-center space-x-3 min-w-0 flex-1'>
                <div className='flex-shrink-0'>
                  {user.role === 'ADMIN' ? (
                    <Shield className='h-8 w-8 text-red-500' />
                  ) : (
                    <UserIcon className='h-8 w-8 text-gray-400' />
                  )}
                </div>
                <div className='min-w-0 flex-1'>
                  <h3 className='text-sm font-medium text-gray-900 truncate'>{user.name}</h3>
                  <p className='text-xs text-gray-500 truncate'>
                    @{user.username || 'No username'} • ID: {user.telegramId}
                  </p>
                </div>
              </div>
              <div className='flex items-center space-x-2 flex-shrink-0'>
                <button
                  onClick={() => handleToggleStatus(user)}
                  className={`p-2 rounded-md ${
                    user.isActive
                      ? 'text-yellow-600 hover:text-yellow-900 hover:bg-yellow-50'
                      : 'text-green-600 hover:text-green-900 hover:bg-green-50'
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
                  className='p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-md'
                  title='Edit user'
                >
                  <Edit className='h-4 w-4' />
                </button>
                <button
                  onClick={() => handleDeleteUser(user)}
                  className='p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-md'
                  title='Delete user'
                >
                  <Trash2 className='h-4 w-4' />
                </button>
              </div>
            </div>

            <div className='space-y-2'>
              <div className='flex items-center justify-between'>
                <span className='text-xs text-gray-500'>Role:</span>
                <span
                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    user.role === 'ADMIN' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {user.role}
                </span>
              </div>

              <div className='flex items-center justify-between'>
                <span className='text-xs text-gray-500'>Password:</span>
                <span
                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    user.password ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {user.password ? 'Set' : 'Not Set'}
                </span>
              </div>

              <div className='flex items-center justify-between'>
                <span className='text-xs text-gray-500'>Status:</span>
                <span
                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    user.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {user.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className='flex items-center justify-between'>
                <span className='text-xs text-gray-500'>Features:</span>
                <span className='text-xs text-gray-600'>{user.featureAccess.length} features</span>
              </div>

              <div className='flex items-center text-xs text-gray-500'>
                <Clock className='h-3 w-3 mr-1' />
                Created: {formatDate(user.createdAt)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Users Table - Desktop Layout */}
      <div className='hidden lg:block bg-white shadow rounded-lg overflow-hidden border'>
        <div className='overflow-x-auto'>
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
        </div>

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

      {/* Empty State for Mobile */}
      {filteredUsers.length === 0 && (
        <div className='lg:hidden text-center py-12'>
          <UsersIcon className='mx-auto h-12 w-12 text-gray-400' />
          <h3 className='mt-2 text-sm font-medium text-gray-900'>No users found</h3>
          <p className='mt-1 text-sm text-gray-500'>
            {searchTerm
              ? 'Try adjusting your search terms.'
              : 'Get started by creating a new user.'}
          </p>
        </div>
      )}

      {/* Stats */}
      <div className='grid grid-cols-2 lg:grid-cols-3 gap-4'>
        <div className='bg-white p-4 rounded-lg shadow border'>
          <div className='flex items-center'>
            <UsersIcon className='h-6 w-6 text-blue-500 flex-shrink-0' />
            <span className='ml-2 text-sm font-medium text-gray-600 truncate'>Total Users</span>
          </div>
          <p className='mt-2 text-2xl font-semibold text-gray-900'>{users.length}</p>
        </div>
        <div className='bg-white p-4 rounded-lg shadow border'>
          <div className='flex items-center'>
            <Shield className='h-6 w-6 text-red-500 flex-shrink-0' />
            <span className='ml-2 text-sm font-medium text-gray-600 truncate'>Admins</span>
          </div>
          <p className='mt-2 text-2xl font-semibold text-gray-900'>
            {users.filter(u => u.role === 'ADMIN').length}
          </p>
        </div>
        <div className='bg-white p-4 rounded-lg shadow border lg:col-span-1 col-span-2'>
          <div className='flex items-center'>
            <CheckCircle className='h-6 w-6 text-green-500 flex-shrink-0' />
            <span className='ml-2 text-sm font-medium text-gray-600 truncate'>Active Users</span>
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
