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
    <div className='relative w-full sm:w-auto'>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className='inline-flex items-center justify-between w-full px-4 py-2 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
        disabled={loading}
      >
        <div className='flex items-center min-w-0 flex-1'>
          <User className='h-4 w-4 mr-2 flex-shrink-0' />
          <span className='truncate'>
            {selectedUser
              ? users.find(u => u.telegramId === selectedUser)?.name || selectedUser
              : 'All Users'}
          </span>
        </div>
        <ChevronDown className='h-4 w-4 ml-2 flex-shrink-0' />
      </button>

      {isOpen && (
        <div className='absolute right-0 mt-2 w-full sm:w-72 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-20 max-h-64 overflow-y-auto'>
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
              <div className='flex items-center'>
                <UsersIcon className='h-4 w-4 mr-2 flex-shrink-0' />
                <span>All Users</span>
              </div>
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
                <div className='flex items-center min-w-0'>
                  <User className='h-4 w-4 mr-2 flex-shrink-0' />
                  <div className='min-w-0 flex-1'>
                    <div className='truncate font-medium'>{user.name}</div>
                    <div className='truncate text-xs text-gray-500'>ID: {user.telegramId}</div>
                  </div>
                </div>
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

  // Truncate file names for mobile display
  const truncateFileName = (fileName: string, maxLength: number = 30) => {
    if (fileName.length <= maxLength) return fileName;
    
    const extension = fileName.split('.').pop();
    const nameWithoutExt = fileName.slice(0, fileName.lastIndexOf('.'));
    const truncatedName = nameWithoutExt.slice(0, maxLength - (extension?.length || 0) - 3);
    
    return `${truncatedName}...${extension ? '.' + extension : ''}`;
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
    <div className='space-y-2 overflow-hidden'>
      {/* Root files */}
      {filesystem.files.map(file => (
        <div
          key={file.path}
          className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors'
        >
          <div className='flex items-center space-x-3 min-w-0 flex-1 overflow-hidden'>
            <div className='flex-shrink-0'>{getFileIcon(file.name, file.mimeType)}</div>
            <div className='min-w-0 flex-1 overflow-hidden'>
              <div className='font-medium text-sm text-gray-900 break-all' title={file.name}>
                <span className='sm:hidden'>{truncateFileName(file.name)}</span>
                <span className='hidden sm:inline'>{file.name}</span>
              </div>
              <div className='text-xs text-gray-500 mt-1'>
                {formatBytes(file.size)} • {formatDate(file.modifiedAt)}
              </div>
            </div>
          </div>
          <div className='flex items-center justify-end gap-2 flex-shrink-0'>
            <button
              onClick={() => onDownload(file.path, file.name)}
              className='flex items-center gap-1 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-md border border-blue-200 hover:border-blue-300 transition-colors text-sm'
              title='Download'
              disabled={loading}
            >
              <Download className='h-4 w-4' />
              <span className='hidden sm:inline'>Download</span>
            </button>
            <button
              onClick={() => onDelete(file.path, file.name)}
              className='flex items-center gap-1 px-3 py-2 text-red-600 hover:bg-red-50 rounded-md border border-red-200 hover:border-red-300 transition-colors text-sm'
              title='Delete'
              disabled={loading}
            >
              <Trash2 className='h-4 w-4' />
              <span className='hidden sm:inline'>Delete</span>
            </button>
          </div>
        </div>
      ))}

      {/* Folders */}
      {filesystem.folders.map(folder => (
        <div key={folder.path} className='space-y-2'>
          <div
            className='flex items-center justify-between p-3 cursor-pointer hover:bg-gray-100 rounded-lg border bg-gray-50'
            onClick={() => toggleFolder(folder.path)}
          >
            <div className='flex items-center space-x-3 min-w-0 flex-1 overflow-hidden'>
              {expandedFolders.has(folder.path) ? (
                <ChevronDown className='h-4 w-4 text-gray-400 flex-shrink-0' />
              ) : (
                <ChevronRight className='h-4 w-4 text-gray-400 flex-shrink-0' />
              )}
              <Folder className='h-4 w-4 text-yellow-500 flex-shrink-0' />
              <div className='min-w-0 flex-1 overflow-hidden'>
                <div className='font-medium text-sm text-gray-900 break-all' title={folder.name}>
                  <span className='sm:hidden'>{truncateFileName(folder.name)}</span>
                  <span className='hidden sm:inline'>{folder.name}</span>
                </div>
                <div className='text-xs text-gray-500 mt-1'>
                  {folder.fileCount} files • {formatBytes(folder.size)}
                </div>
              </div>
            </div>
            <div className='text-xs text-gray-400 hidden sm:block'>
              {formatDate(folder.modifiedAt)}
            </div>
          </div>

          {/* Folder contents */}
          {expandedFolders.has(folder.path) && (
            <div className='ml-3 space-y-2 border-l-2 border-gray-200 pl-4'>
              {/* Nested folders */}
              {folder.folders?.map(nestedFolder => (
                <div key={nestedFolder.path}>
                  <div
                    className='flex items-center justify-between p-2 cursor-pointer hover:bg-gray-100 rounded border bg-white'
                    onClick={() => toggleFolder(nestedFolder.path)}
                  >
                    <div className='flex items-center space-x-3 min-w-0 flex-1 overflow-hidden'>
                      {expandedFolders.has(nestedFolder.path) ? (
                        <ChevronDown className='h-4 w-4 text-gray-400 flex-shrink-0' />
                      ) : (
                        <ChevronRight className='h-4 w-4 text-gray-400 flex-shrink-0' />
                      )}
                      <Folder className='h-4 w-4 text-yellow-500 flex-shrink-0' />
                      <div className='min-w-0 flex-1 overflow-hidden'>
                        <div className='font-medium text-sm text-gray-900 break-all' title={nestedFolder.name}>
                          <span className='sm:hidden'>{truncateFileName(nestedFolder.name)}</span>
                          <span className='hidden sm:inline'>{nestedFolder.name}</span>
                        </div>
                        <div className='text-xs text-gray-500 mt-1'>
                          {nestedFolder.fileCount} files • {formatBytes(nestedFolder.size)}
                        </div>
                      </div>
                    </div>
                    <div className='text-xs text-gray-400 hidden sm:block'>
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
                          className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-2 bg-white rounded border'
                        >
                          <div className='flex items-center space-x-3 min-w-0 flex-1 overflow-hidden'>
                            {getFileIcon(file.name, file.mimeType)}
                            <div className='min-w-0 flex-1 overflow-hidden'>
                              <div className='font-medium text-sm text-gray-900 break-all' title={file.name}>
                                <span className='sm:hidden'>{truncateFileName(file.name)}</span>
                                <span className='hidden sm:inline'>{file.name}</span>
                              </div>
                              <div className='text-xs text-gray-500 mt-1'>
                                {formatBytes(file.size)} • {formatDate(file.modifiedAt)}
                              </div>
                            </div>
                          </div>
                          <div className='flex items-center justify-end space-x-2 flex-shrink-0'>
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
                            <div className='flex items-center space-x-3 min-w-0 flex-1 overflow-hidden'>
                              {expandedFolders.has(deepFolder.path) ? (
                                <ChevronDown className='h-4 w-4 text-gray-400 flex-shrink-0' />
                              ) : (
                                <ChevronRight className='h-4 w-4 text-gray-400 flex-shrink-0' />
                              )}
                              <Folder className='h-4 w-4 text-yellow-500 flex-shrink-0' />
                              <div className='min-w-0 flex-1 overflow-hidden'>
                                <div className='font-medium text-sm text-gray-900 break-all' title={deepFolder.name}>
                                  <span className='sm:hidden'>{truncateFileName(deepFolder.name)}</span>
                                  <span className='hidden sm:inline'>{deepFolder.name}</span>
                                </div>
                                <div className='text-xs text-gray-500 mt-1'>
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
                  className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-2 bg-white rounded border'
                >
                  <div className='flex items-center space-x-3 min-w-0 flex-1 overflow-hidden'>
                    {getFileIcon(file.name, file.mimeType)}
                    <div className='min-w-0 flex-1 overflow-hidden'>
                      <div className='font-medium text-sm text-gray-900 break-all' title={file.name}>
                        <span className='sm:hidden'>{truncateFileName(file.name)}</span>
                        <span className='hidden sm:inline'>{file.name}</span>
                      </div>
                      <div className='text-xs text-gray-500 mt-1'>
                        {formatBytes(file.size)} • {formatDate(file.modifiedAt)}
                      </div>
                    </div>
                  </div>
                  <div className='flex items-center justify-end space-x-2 flex-shrink-0'>
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
    } catch {
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
    <div className='space-y-6'>
      {/* Header */}
      <div>
        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
          <div className='flex items-center gap-3'>
            <FilesIcon className='w-8 h-8 text-blue-600 flex-shrink-0' />
            <div>
              <h1 className='text-2xl font-bold text-gray-900'>File Management</h1>
              <p className='text-sm text-gray-600'>
                View, download, and manage user files from the bot
              </p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            className='flex items-center justify-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50'
            disabled={loading || actionLoading}
          >
            <RefreshCw className={`h-4 w-4 ${loading || actionLoading ? 'animate-spin' : ''}`} />
            <span className='hidden sm:inline'>Refresh</span>
          </button>
        </div>
      </div>

      {/* Storage Stats - Mobile Responsive */}
      {storageStats && (
        <div className='grid grid-cols-2 lg:grid-cols-4 gap-4'>
          <div className='bg-white p-4 rounded-lg shadow border'>
            <div className='flex items-center justify-between'>
              <div className='min-w-0 flex-1'>
                <p className='text-sm text-gray-600 truncate'>Total Storage</p>
                <p className='text-xl font-bold text-gray-900'>
                  {storageStats.formatted.totalSizeFormatted}
                </p>
              </div>
              <HardDrive className='w-6 h-6 text-blue-500 flex-shrink-0' />
            </div>
          </div>
          <div className='bg-white p-4 rounded-lg shadow border'>
            <div className='flex items-center justify-between'>
              <div className='min-w-0 flex-1'>
                <p className='text-sm text-gray-600 truncate'>DB Storage</p>
                <p className='text-xl font-bold text-gray-900'>
                  {storageStats.formatted.dbSizeFormatted}
                </p>
              </div>
              <Database className='w-6 h-6 text-green-500 flex-shrink-0' />
            </div>
          </div>
          <div className='bg-white p-4 rounded-lg shadow border'>
            <div className='flex items-center justify-between'>
              <div className='min-w-0 flex-1'>
                <p className='text-sm text-gray-600 truncate'>Total Files</p>
                <p className='text-xl font-bold text-gray-900'>
                  {storageStats.filesystem.fileCount.toLocaleString()}
                </p>
              </div>
              <FilesIcon className='w-6 h-6 text-purple-500 flex-shrink-0' />
            </div>
          </div>
          <div className='bg-white p-4 rounded-lg shadow border'>
            <div className='flex items-center justify-between'>
              <div className='min-w-0 flex-1'>
                <p className='text-sm text-gray-600 truncate'>Users</p>
                <p className='text-xl font-bold text-gray-900'>
                  {storageStats.filesystem.userCount}
                </p>
              </div>
              <UsersIcon className='w-6 h-6 text-orange-500 flex-shrink-0' />
            </div>
          </div>
        </div>
      )}

      {/* User Selection - Mobile Responsive */}
      <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
        <div>
          <h2 className='text-lg font-medium text-gray-900'>Select User</h2>
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
        <div className='bg-white shadow rounded-lg p-4 sm:p-6 overflow-hidden'>
          <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4'>
            <h3 className='text-lg font-medium text-gray-900 min-w-0 flex-1'>
              <span className='block truncate'>
                Files for {users.find(u => u.telegramId === selectedUser)?.name || selectedUser}
              </span>
            </h3>
            {filesystem && (
              <div className='text-sm text-gray-500 flex-shrink-0'>
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
