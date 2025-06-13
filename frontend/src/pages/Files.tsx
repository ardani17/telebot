import { useState, useEffect } from 'react';
import {
  Files as FilesIcon,
  Folder,
  FileText,
  Download,
  Trash2,
  RefreshCw,
  Users as UsersIcon,
  HardDrive,
  Database,
  ChevronDown,
  ChevronRight,
  FileImage,
  FileArchive,
  FileVideo,
  FileAudio,
  User,
} from 'lucide-react';
import { api } from '@/lib/api';
import { UserFilesystem, StorageStats } from '@/types/file';
import { User as UserType } from '@/types/user';
import { useAuth } from '@/hooks/useAuth';

interface UserSelectorProps {
  users: UserType[];
  selectedUser: string | null;
  onUserSelect: (telegramId: string | null) => void;
  loading: boolean;
}

function UserSelector({ users, selectedUser, onUserSelect, loading }: UserSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className='relative'>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className='inline-flex items-center px-4 py-2 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
        disabled={loading}
      >
        <User className='h-4 w-4 mr-2' />
        {selectedUser
          ? users.find(u => u.telegramId === selectedUser)?.name || selectedUser
          : 'All Users'}
        <ChevronDown className='h-4 w-4 ml-2' />
      </button>

      {isOpen && (
        <div className='absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10'>
          <div className='py-1'>
            <button
              onClick={() => {
                onUserSelect(null);
                setIsOpen(false);
              }}
              className={`block px-4 py-2 text-sm w-full text-left hover:bg-gray-100 ${
                selectedUser === null ? 'bg-blue-50 text-blue-700' : 'text-gray-900'
              }`}
            >
              All Users
            </button>
            {users.map(user => (
              <button
                key={user.id}
                onClick={() => {
                  onUserSelect(user.telegramId);
                  setIsOpen(false);
                }}
                className={`block px-4 py-2 text-sm w-full text-left hover:bg-gray-100 ${
                  selectedUser === user.telegramId ? 'bg-blue-50 text-blue-700' : 'text-gray-900'
                }`}
              >
                {user.name} ({user.telegramId})
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface FilesystemViewProps {
  filesystem: UserFilesystem;
  onDownload: (filePath: string, fileName: string) => void;
  onDelete: (filePath: string, fileName: string) => void;
  loading: boolean;
}

function FilesystemView({ filesystem, onDownload, onDelete, loading }: FilesystemViewProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const toggleFolder = (folderPath: string) => {
    const newExpanded = new Set(expandedFolders);
    if (expandedFolders.has(folderPath)) {
      newExpanded.delete(folderPath);
    } else {
      newExpanded.add(folderPath);
    }
    setExpandedFolders(newExpanded);
  };

  const getFileIcon = (fileName: string, mimeType?: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();

    if (
      mimeType?.startsWith('image/') ||
      ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext || '')
    ) {
      return <FileImage className='h-4 w-4 text-blue-500' />;
    }
    if (mimeType?.startsWith('video/') || ['mp4', 'avi', 'mov', 'wmv'].includes(ext || '')) {
      return <FileVideo className='h-4 w-4 text-purple-500' />;
    }
    if (mimeType?.startsWith('audio/') || ['mp3', 'wav', 'flac'].includes(ext || '')) {
      return <FileAudio className='h-4 w-4 text-green-500' />;
    }
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext || '')) {
      return <FileArchive className='h-4 w-4 text-orange-500' />;
    }
    return <FileText className='h-4 w-4 text-gray-500' />;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!filesystem.exists) {
    return (
      <div className='text-center py-8 text-gray-500'>
        <Folder className='mx-auto h-12 w-12 text-gray-300 mb-2' />
        <p>No files found for this user</p>
      </div>
    );
  }

  return (
    <div className='space-y-2'>
      {/* Root files */}
      {filesystem.files.map(file => (
        <div
          key={file.path}
          className='flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50'
        >
          <div className='flex items-center space-x-3'>
            {getFileIcon(file.name, file.mimeType)}
            <div>
              <div className='font-medium text-sm'>{file.name}</div>
              <div className='text-xs text-gray-500'>
                {formatBytes(file.size)} • {formatDate(file.modifiedAt)}
              </div>
            </div>
          </div>
          <div className='flex items-center space-x-2'>
            <button
              onClick={() => onDownload(file.path, file.name)}
              className='p-1 text-blue-600 hover:text-blue-800 rounded'
              title='Download'
              disabled={loading}
            >
              <Download className='h-4 w-4' />
            </button>
            <button
              onClick={() => onDelete(file.path, file.name)}
              className='p-1 text-red-600 hover:text-red-800 rounded'
              title='Delete'
              disabled={loading}
            >
              <Trash2 className='h-4 w-4' />
            </button>
          </div>
        </div>
      ))}

      {/* Folders */}
      {filesystem.folders.map(folder => (
        <div key={folder.path} className='border rounded-lg'>
          <div
            className='flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50'
            onClick={() => toggleFolder(folder.path)}
          >
            <div className='flex items-center space-x-3'>
              {expandedFolders.has(folder.path) ? (
                <ChevronDown className='h-4 w-4 text-gray-400' />
              ) : (
                <ChevronRight className='h-4 w-4 text-gray-400' />
              )}
              <Folder className='h-4 w-4 text-yellow-500' />
              <div>
                <div className='font-medium text-sm'>{folder.name}</div>
                <div className='text-xs text-gray-500'>
                  {folder.fileCount} files • {formatBytes(folder.size)}
                </div>
              </div>
            </div>
            <div className='text-xs text-gray-400'>{formatDate(folder.modifiedAt)}</div>
          </div>

          {expandedFolders.has(folder.path) && (
            <div className='border-t bg-gray-50 p-3'>
              <div className='space-y-2'>
                {/* Render nested folders first */}
                {folder.folders?.map(nestedFolder => (
                  <div key={nestedFolder.path} className='ml-4'>
                    <div
                      className='flex items-center justify-between p-2 cursor-pointer hover:bg-gray-100 rounded border bg-white'
                      onClick={() => toggleFolder(nestedFolder.path)}
                    >
                      <div className='flex items-center space-x-3'>
                        {expandedFolders.has(nestedFolder.path) ? (
                          <ChevronDown className='h-4 w-4 text-gray-400' />
                        ) : (
                          <ChevronRight className='h-4 w-4 text-gray-400' />
                        )}
                        <Folder className='h-4 w-4 text-yellow-500' />
                        <div>
                          <div className='font-medium text-sm'>{nestedFolder.name}</div>
                          <div className='text-xs text-gray-500'>
                            {nestedFolder.fileCount} files • {formatBytes(nestedFolder.size)}
                          </div>
                        </div>
                      </div>
                      <div className='text-xs text-gray-400'>
                        {formatDate(nestedFolder.modifiedAt)}
                      </div>
                    </div>

                    {/* Recursively render nested folder contents */}
                    {expandedFolders.has(nestedFolder.path) && (
                      <div className='ml-6 mt-2 space-y-2'>
                        {/* Files in nested folder */}
                        {nestedFolder.files.map(file => (
                          <div
                            key={file.path}
                            className='flex items-center justify-between p-2 bg-white rounded border'
                          >
                            <div className='flex items-center space-x-3'>
                              {getFileIcon(file.name, file.mimeType)}
                              <div>
                                <div className='font-medium text-sm'>{file.name}</div>
                                <div className='text-xs text-gray-500'>
                                  {formatBytes(file.size)} • {formatDate(file.modifiedAt)}
                                </div>
                              </div>
                            </div>
                            <div className='flex items-center space-x-2'>
                              <button
                                onClick={() => onDownload(file.path, file.name)}
                                className='p-1 text-blue-600 hover:text-blue-800 rounded'
                                title='Download'
                                disabled={loading}
                              >
                                <Download className='h-4 w-4' />
                              </button>
                              <button
                                onClick={() => onDelete(file.path, file.name)}
                                className='p-1 text-red-600 hover:text-red-800 rounded'
                                title='Delete'
                                disabled={loading}
                              >
                                <Trash2 className='h-4 w-4' />
                              </button>
                            </div>
                          </div>
                        ))}

                        {/* Render further nested folders if any */}
                        {nestedFolder.folders?.map(deepFolder => (
                          <div key={deepFolder.path} className='ml-4'>
                            <div
                              className='flex items-center justify-between p-2 cursor-pointer hover:bg-gray-100 rounded border bg-white'
                              onClick={() => toggleFolder(deepFolder.path)}
                            >
                              <div className='flex items-center space-x-3'>
                                {expandedFolders.has(deepFolder.path) ? (
                                  <ChevronDown className='h-4 w-4 text-gray-400' />
                                ) : (
                                  <ChevronRight className='h-4 w-4 text-gray-400' />
                                )}
                                <Folder className='h-4 w-4 text-yellow-500' />
                                <div>
                                  <div className='font-medium text-sm'>{deepFolder.name}</div>
                                  <div className='text-xs text-gray-500'>
                                    {deepFolder.fileCount} files • {formatBytes(deepFolder.size)}
                                  </div>
                                </div>
                              </div>
                            </div>
                            {/* Note: For simplicity, only showing 2 levels. For infinite nesting, create a recursive component */}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* Render files in current folder */}
                {folder.files.map(file => (
                  <div
                    key={file.path}
                    className='flex items-center justify-between p-2 bg-white rounded border'
                  >
                    <div className='flex items-center space-x-3 ml-6'>
                      {getFileIcon(file.name, file.mimeType)}
                      <div>
                        <div className='font-medium text-sm'>{file.name}</div>
                        <div className='text-xs text-gray-500'>
                          {formatBytes(file.size)} • {formatDate(file.modifiedAt)}
                        </div>
                      </div>
                    </div>
                    <div className='flex items-center space-x-2'>
                      <button
                        onClick={() => onDownload(file.path, file.name)}
                        className='p-1 text-blue-600 hover:text-blue-800 rounded'
                        title='Download'
                        disabled={loading}
                      >
                        <Download className='h-4 w-4' />
                      </button>
                      <button
                        onClick={() => onDelete(file.path, file.name)}
                        className='p-1 text-red-600 hover:text-red-800 rounded'
                        title='Delete'
                        disabled={loading}
                      >
                        <Trash2 className='h-4 w-4' />
                      </button>
                    </div>
                  </div>
                ))}

                {folder.files.length === 0 && (!folder.folders || folder.folders.length === 0) && (
                  <div className='text-center py-4 text-gray-400 text-sm'>
                    No files or folders in this directory
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}

      {filesystem.folders.length === 0 && filesystem.files.length === 0 && (
        <div className='text-center py-8 text-gray-500'>
          <FilesIcon className='mx-auto h-12 w-12 text-gray-300 mb-2' />
          <p>No files found</p>
        </div>
      )}
    </div>
  );
}

export function Files() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserType[]>([]);
  // const [allUserDirectories, setAllUserDirectories] = useState<AllUserDirectoriesResponse | null>(null)
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [filesystem, setFilesystem] = useState<UserFilesystem | null>(null);
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.role === 'ADMIN';

  const fetchUsers = async () => {
    try {
      if (isAdmin) {
        const response = await api.get('/users');
        setUsers(response.data);
      } else {
        // Non-admin users can only see themselves
        if (user) {
          const currentUser: UserType = {
            id: user.id,
            telegramId: user.telegramId,
            name: user.name,
            username: undefined,
            role: user.role,
            isActive: user.isActive,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            featureAccess: [],
          };
          setUsers([currentUser]);
          setSelectedUser(user.telegramId);
        }
      }
    } catch (err: any) {
      setError('Failed to load users');
    }
  };

  // const fetchAllUserDirectories = async () => {
  //   if (!isAdmin) return
  //
  //   try {
  //     const response = await api.get('/files/filesystem/all')
  //     setAllUserDirectories(response.data)
  //   } catch (err: any) {
  //     console.error('Failed to load all user directories:', err)
  //   }
  // }

  const fetchFilesystem = async (telegramId: string) => {
    try {
      setLoading(true);
      const response = await api.get(`/files/filesystem/${telegramId}`);
      setFilesystem(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load filesystem');
      setFilesystem(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchStorageStats = async () => {
    try {
      const response = await api.get('/files/stats/storage');
      setStorageStats(response.data);
    } catch (err: any) {
      console.error('Failed to load storage stats:', err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchUsers();
      fetchStorageStats();
      // fetchAllUserDirectories()
    }
  }, [user, isAdmin]);

  useEffect(() => {
    if (selectedUser) {
      fetchFilesystem(selectedUser);
    } else {
      setFilesystem(null);
      setLoading(false);
    }
  }, [selectedUser]);

  const handleDownload = async (filePath: string, fileName: string) => {
    if (!selectedUser) return;

    console.log('Download request:', { filePath, fileName, selectedUser });

    try {
      setActionLoading(true);
      
      // Use alternative endpoint with query parameter
      const params = new URLSearchParams({ path: filePath });
      const url = `/files/download-file/${selectedUser}?${params}`;
      
      console.log('Download URL:', url);
      console.log('Query params:', params.toString());
      console.log('API base URL:', api.defaults.baseURL);
      console.log('Full URL will be:', `${api.defaults.baseURL}${url}`);
      
      const response = await api.get(url, {
        responseType: 'blob',
      });

      const url2 = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url2;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url2);
      
      console.log('Download successful');
    } catch (err: any) {
      console.error('Download error:', err);
      console.error('Error response:', err.response);
      console.error('Error status:', err.response?.status);
      console.error('Error data:', err.response?.data);
      alert('Failed to download file: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (filePath: string, fileName: string) => {
    if (!selectedUser) return;

    console.log('Delete request:', { filePath, fileName, selectedUser });

    if (!confirm(`Are you sure you want to delete "${fileName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setActionLoading(true);
      
      // Use alternative endpoint with query parameter
      const params = new URLSearchParams({ path: filePath });
      const url = `/files/delete-file/${selectedUser}?${params}`;
      
      console.log('Delete URL:', url);
      console.log('Query params:', params.toString());
      console.log('API base URL:', api.defaults.baseURL);
      console.log('Full URL will be:', `${api.defaults.baseURL}${url}`);
      
      await api.delete(url);
      
      console.log('Delete successful');
      
      // Refresh filesystem
      await fetchFilesystem(selectedUser);
      await fetchStorageStats();
    } catch (err: any) {
      console.error('Delete error:', err);
      console.error('Error response:', err.response);
      console.error('Error status:', err.response?.status);
      console.error('Error data:', err.response?.data);
      alert('Failed to delete file: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (selectedUser) {
      await fetchFilesystem(selectedUser);
    }
    await fetchStorageStats();
  };

  return (
    <div>
      {/* Header */}
      <div className='mb-8'>
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='text-2xl font-bold text-gray-900'>File Management</h1>
            <p className='mt-1 text-sm text-gray-600'>
              View, download, and manage user files from the bot
            </p>
          </div>
          <button
            onClick={handleRefresh}
            className='inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50'
            disabled={loading || actionLoading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading || actionLoading ? 'animate-spin' : ''}`}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* Storage Stats */}
      {storageStats && (
        <div className='mb-6 grid grid-cols-1 md:grid-cols-4 gap-4'>
          <div className='bg-white p-4 rounded-lg shadow'>
            <div className='flex items-center'>
              <HardDrive className='h-6 w-6 text-blue-500' />
              <span className='ml-2 text-sm font-medium text-gray-600'>Total Storage</span>
            </div>
            <p className='mt-2 text-2xl font-semibold text-gray-900'>
              {storageStats.formatted.totalSizeFormatted}
            </p>
          </div>
          <div className='bg-white p-4 rounded-lg shadow'>
            <div className='flex items-center'>
              <Database className='h-6 w-6 text-green-500' />
              <span className='ml-2 text-sm font-medium text-gray-600'>DB Storage</span>
            </div>
            <p className='mt-2 text-2xl font-semibold text-gray-900'>
              {storageStats.formatted.dbSizeFormatted}
            </p>
          </div>
          <div className='bg-white p-4 rounded-lg shadow'>
            <div className='flex items-center'>
              <FilesIcon className='h-6 w-6 text-purple-500' />
              <span className='ml-2 text-sm font-medium text-gray-600'>Total Files</span>
            </div>
            <p className='mt-2 text-2xl font-semibold text-gray-900'>
              {storageStats.filesystem.fileCount.toLocaleString()}
            </p>
          </div>
          <div className='bg-white p-4 rounded-lg shadow'>
            <div className='flex items-center'>
              <UsersIcon className='h-6 w-6 text-orange-500' />
              <span className='ml-2 text-sm font-medium text-gray-600'>Users</span>
            </div>
            <p className='mt-2 text-2xl font-semibold text-gray-900'>
              {storageStats.filesystem.userCount}
            </p>
          </div>
        </div>
      )}

      {/* User Selection */}
      <div className='mb-6 flex items-center justify-between'>
        <div>
          <h2 className='text-lg font-medium text-gray-900 mb-2'>Select User</h2>
          <p className='text-sm text-gray-600'>Choose a user to view their files</p>
        </div>
        <UserSelector
          users={users}
          selectedUser={selectedUser}
          onUserSelect={setSelectedUser}
          loading={loading}
        />
      </div>

      {error && (
        <div className='mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded'>
          {error}
        </div>
      )}

      {/* Filesystem View */}
      {selectedUser ? (
        <div className='bg-white shadow rounded-lg p-6'>
          <div className='flex items-center justify-between mb-4'>
            <h3 className='text-lg font-medium text-gray-900'>
              Files for {users.find(u => u.telegramId === selectedUser)?.name || selectedUser}
            </h3>
            {filesystem && (
              <div className='text-sm text-gray-500'>
                {filesystem.totalSize
                  ? `Total: ${Math.round(filesystem.totalSize / 1024 / 1024)} MB`
                  : ''}
              </div>
            )}
          </div>

          {loading ? (
            <div className='flex items-center justify-center py-8'>
              <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
            </div>
          ) : filesystem ? (
            <FilesystemView
              filesystem={filesystem}
              onDownload={handleDownload}
              onDelete={handleDelete}
              loading={actionLoading}
            />
          ) : null}
        </div>
      ) : (
        <div className='bg-white shadow rounded-lg p-12 text-center'>
          <FilesIcon className='mx-auto h-12 w-12 text-gray-400 mb-4' />
          <h3 className='text-lg font-medium text-gray-900 mb-2'>Select a User</h3>
          <p className='text-gray-600'>
            Choose a user from the dropdown above to view their uploaded files
          </p>
        </div>
      )}
    </div>
  );
}
