import { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Server,
  Database,
  Bot,
  HardDrive,
  Shield,
  Save,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Eye,
  EyeOff,
  Plus,
  X,
  Key,
  Lock,
} from 'lucide-react';
import api from '../lib/api';

interface SystemInfo {
  nodeVersion: string;
  platform: string;
  arch: string;
  totalMemory: string;
  freeMemory: string;
  uptime: string;
  cpus: number;
}

interface EnvironmentConfig {
  backendPort: string;
  frontendPort: string;
  publicIp: string;
  serverHost: string;
  corsOrigin: string;
  botApiServer: string;
  dataPath: string;
  nodeEnv: string;
  logLevel: string;
}

interface DatabaseConfig {
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  maxConnections: number;
  connectionTimeout: number;
  isConnected: boolean;
  lastConnectionTest: string;
}

interface BotConfig {
  isActive: boolean;
  webhookMode: boolean;
  polling: boolean;
  lastActivity: string;
  totalUsers: number;
  activeFeatures: number;
  apiServer: string;
  maxFileSize: string;
  allowedMimeTypes: string[];
}

interface FileManagementConfig {
  maxFileSize: string;
  allowedExtensions: string[];
  autoCleanup: boolean;
  retentionDays: number;
  totalStorage: string;
  usedStorage: string;
  allowedMimeTypes: string[];
  virusScanEnabled: boolean;
}

interface SecurityConfig {
  jwtSecret: string;
  jwtExpirationTime: string;
  refreshTokenExpiration: string;
  rateLimitEnabled: boolean;
  rateLimitRequests: number;
  rateLimitWindow: number;
  corsEnabled: boolean;
  corsOrigins: string[];
  passwordMinLength: number;
  sessionTimeout: number;
  bruteForceProtection: boolean;
  twoFactorEnabled: boolean;
}

export function Settings() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('system');
  const [showPasswords, setShowPasswords] = useState(false);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [envConfig, setEnvConfig] = useState<EnvironmentConfig>({
    backendPort: '3001',
    frontendPort: '3000',
    publicIp: '',
    serverHost: '0.0.0.0',
    corsOrigin: '',
    botApiServer: 'http://localhost:8081',
    dataPath: '/home/teleweb/backend/data-bot-api',
    nodeEnv: 'development',
    logLevel: 'info',
  });

  const [dbConfig, setDbConfig] = useState<DatabaseConfig>({
    host: 'localhost',
    port: '5432',
    database: 'teleweb',
    username: 'teleweb_user',
    password: '',
    ssl: false,
    maxConnections: 10,
    connectionTimeout: 30000,
    isConnected: false,
    lastConnectionTest: 'Never',
  });

  const [botConfig, setBotConfig] = useState<BotConfig>({
    isActive: false,
    webhookMode: false,
    polling: true,
    lastActivity: '',
    totalUsers: 0,
    activeFeatures: 0,
    apiServer: 'http://localhost:8081',
    maxFileSize: '50MB',
    allowedMimeTypes: [],
  });

  const [fileConfig, setFileConfig] = useState<FileManagementConfig>({
    maxFileSize: '50MB',
    allowedExtensions: ['jpg', 'png', 'pdf', 'zip', 'rar', 'xlsx', 'kml'],
    autoCleanup: true,
    retentionDays: 30,
    totalStorage: '0GB',
    usedStorage: '0GB',
    allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf', 'application/zip'],
    virusScanEnabled: false,
  });

  const [securityConfig, setSecurityConfig] = useState<SecurityConfig>({
    jwtSecret: '',
    jwtExpirationTime: '1h',
    refreshTokenExpiration: '7d',
    rateLimitEnabled: true,
    rateLimitRequests: 100,
    rateLimitWindow: 15,
    corsEnabled: true,
    corsOrigins: [],
    passwordMinLength: 8,
    sessionTimeout: 1800,
    bruteForceProtection: true,
    twoFactorEnabled: false,
  });

  const tabs = [
    { id: 'system', name: 'System Info', icon: Server },
    { id: 'environment', name: 'Environment', icon: SettingsIcon },
    { id: 'database', name: 'Database', icon: Database },
    { id: 'bot', name: 'Bot Configuration', icon: Bot },
    { id: 'files', name: 'File Management', icon: HardDrive },
    { id: 'security', name: 'Security', icon: Shield },
  ];

  const fetchSystemInfo = async () => {
    try {
      const response = await api.get('/dashboard/system-status');
      const data = response.data;

      setSystemInfo({
        nodeVersion: data.nodejs?.version || 'Unknown',
        platform: data.platform || 'Unknown',
        arch: data.arch || 'Unknown',
        totalMemory: data.memory?.total || 'Unknown',
        freeMemory: data.memory?.free || 'Unknown',
        uptime: data.uptime || 'Unknown',
        cpus: data.cpus || 0,
      });
    } catch (err) {
      console.error('Failed to fetch system info:', err);
    }
  };

  const fetchBotConfig = async () => {
    try {
      const [statsResponse, usersResponse, featuresResponse] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/admin/users'),
        api.get('/admin/features'),
      ]);

      setBotConfig({
        isActive: statsResponse.data.botStatus === 'running',
        webhookMode: false, // TODO: get from bot config
        polling: true, // TODO: get from bot config
        lastActivity: statsResponse.data.lastActivity || 'Never',
        totalUsers: usersResponse.data.length || 0,
        activeFeatures: featuresResponse.data.filter((f: any) => f.isActive).length || 0,
        apiServer: 'http://localhost:8081',
        maxFileSize: '50MB',
        allowedMimeTypes: [],
      });
    } catch (err) {
      console.error('Failed to fetch bot config:', err);
    }
  };

  const fetchFileConfig = async () => {
    try {
      const response = await api.get('/files/stats/storage');
      const stats = response.data;

      setFileConfig(prev => ({
        ...prev,
        totalStorage: stats.formatted?.totalSizeFormatted || '0GB',
        usedStorage: stats.formatted?.totalSizeFormatted || '0GB',
      }));
    } catch (err) {
      console.error('Failed to fetch file config:', err);
    }
  };

  const fetchDatabaseConfig = async () => {
    try {
      const response = await api.get('/settings/database');
      const { config, status } = response.data;

      if (config) {
        setDbConfig(prev => ({
          ...prev,
          ...config,
          isConnected: status?.connected || false,
          lastConnectionTest: status?.lastTest || 'Never',
        }));
      }
    } catch (err) {
      console.error('Failed to fetch database config:', err);
    }
  };

  const fetchSecurityConfig = async () => {
    try {
      const response = await api.get('/settings/security');
      const { settings } = response.data;

      if (settings) {
        setSecurityConfig(prev => ({
          ...prev,
          ...settings,
        }));
      }
    } catch (err) {
      console.error('Failed to fetch security config:', err);
    }
  };

  const testDatabaseConnection = async () => {
    try {
      // Send only the necessary config data for testing
      const testConfig = {
        host: dbConfig.host,
        port: dbConfig.port,
        database: dbConfig.database,
        username: dbConfig.username,
        password: dbConfig.password,
        ssl: dbConfig.ssl,
        maxConnections: dbConfig.maxConnections,
        connectionTimeout: dbConfig.connectionTimeout,
      };

      const response = await api.post('/settings/database/test', testConfig);
      const { success, message } = response.data;

      setDbConfig(prev => ({
        ...prev,
        isConnected: success,
        lastConnectionTest: new Date().toLocaleString(),
      }));

      alert(success ? message : `Connection failed: ${message}`);
    } catch (err: any) {
      console.error('Database connection test failed:', err);
      setDbConfig(prev => ({
        ...prev,
        isConnected: false,
        lastConnectionTest: new Date().toLocaleString(),
      }));
      alert('Connection test failed: ' + (err.response?.data?.message || err.message));
    }
  };

  const fetchAppSettings = async () => {
    try {
      const response = await api.get('/settings');
      const { settings } = response.data;

      // Update bot config from database settings
      if (settings.BOT) {
        const botSettings = settings.BOT.reduce((acc: any, setting: any) => {
          acc[setting.key] =
            setting.value === 'true' ? true : setting.value === 'false' ? false : setting.value;
          return acc;
        }, {});

        setBotConfig(prev => ({
          ...prev,
          polling:
            botSettings['bot.polling'] !== undefined ? botSettings['bot.polling'] : prev.polling,
          webhookMode:
            botSettings['bot.webhook'] !== undefined
              ? botSettings['bot.webhook']
              : prev.webhookMode,
        }));
      }

      // Update file config from database settings
      if (settings.FILES) {
        const fileSettings = settings.FILES.reduce((acc: any, setting: any) => {
          acc[setting.key] = setting.value;
          return acc;
        }, {});

        setFileConfig(prev => ({
          ...prev,
          maxFileSize: fileSettings['files.maxSize'] || prev.maxFileSize,
          retentionDays: parseInt(fileSettings['files.retentionDays']) || prev.retentionDays,
          autoCleanup: fileSettings['files.autoCleanup'] === 'true',
        }));
      }
    } catch (err) {
      console.error('Failed to fetch app settings:', err);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Collect all changed settings
      const settings = {
        // Bot settings
        'bot.polling': botConfig.polling,
        'bot.webhook': botConfig.webhookMode,
        'bot.apiServer': botConfig.apiServer,
        'bot.maxFileSize': botConfig.maxFileSize,

        // File settings
        'files.maxSize': fileConfig.maxFileSize,
        'files.retentionDays': fileConfig.retentionDays,
        'files.autoCleanup': fileConfig.autoCleanup,
        'files.virusScanEnabled': fileConfig.virusScanEnabled,
        'files.allowedExtensions': fileConfig.allowedExtensions.join(','),

        // Security settings
        'security.rateLimitEnabled': securityConfig.rateLimitEnabled,
        'security.rateLimitRequests': securityConfig.rateLimitRequests,
        'security.rateLimitWindow': securityConfig.rateLimitWindow,
        'security.passwordMinLength': securityConfig.passwordMinLength,
        'security.sessionTimeout': securityConfig.sessionTimeout,
        'security.bruteForceProtection': securityConfig.bruteForceProtection,
        'security.twoFactorEnabled': securityConfig.twoFactorEnabled,

        // Environment settings (for reference, these stay in .env)
        // 'env.publicIp': envConfig.publicIp,
        // 'env.corsOrigin': envConfig.corsOrigin,
      };

      // Save database config separately
      if (activeTab === 'database') {
        await api.post('/settings/database', {
          config: dbConfig,
          updatedBy: 'admin-web',
        });
      }

      await api.post('/settings', {
        settings,
        updatedBy: 'admin-web',
      });

      alert('Settings saved successfully!');
    } catch (err: any) {
      console.error('Failed to save settings:', err);
      alert('Failed to save settings: ' + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchSystemInfo(),
        fetchBotConfig(),
        fetchFileConfig(),
        fetchAppSettings(),
        fetchDatabaseConfig(),
        fetchSecurityConfig(),
      ]);
    } catch (err) {
      console.error('Failed to refresh data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleRefresh();
  }, []);

  const addFileExtension = (ext: string) => {
    if (ext && !fileConfig.allowedExtensions.includes(ext.toLowerCase())) {
      setFileConfig(prev => ({
        ...prev,
        allowedExtensions: [...prev.allowedExtensions, ext.toLowerCase()],
      }));
    }
  };

  const removeFileExtension = (ext: string) => {
    setFileConfig(prev => ({
      ...prev,
      allowedExtensions: prev.allowedExtensions.filter(e => e !== ext),
    }));
  };

  const addCorsOrigin = (origin: string) => {
    if (origin && !securityConfig.corsOrigins.includes(origin.toLowerCase())) {
      setSecurityConfig(prev => ({
        ...prev,
        corsOrigins: [...prev.corsOrigins, origin.toLowerCase()],
      }));
    }
  };

  const removeCorsOrigin = (origin: string) => {
    setSecurityConfig(prev => ({
      ...prev,
      corsOrigins: prev.corsOrigins.filter(o => o !== origin),
    }));
  };

  const renderSystemInfo = () => (
    <div className='space-y-6'>
      <div>
        <h3 className='text-lg font-medium text-gray-900 mb-4'>System Information</h3>
        {systemInfo ? (
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div className='bg-gray-50 p-4 rounded-lg'>
              <dt className='text-sm font-medium text-gray-500'>Node.js Version</dt>
              <dd className='mt-1 text-sm text-gray-900'>{systemInfo.nodeVersion}</dd>
            </div>
            <div className='bg-gray-50 p-4 rounded-lg'>
              <dt className='text-sm font-medium text-gray-500'>Platform</dt>
              <dd className='mt-1 text-sm text-gray-900'>
                {systemInfo.platform} ({systemInfo.arch})
              </dd>
            </div>
            <div className='bg-gray-50 p-4 rounded-lg'>
              <dt className='text-sm font-medium text-gray-500'>Total Memory</dt>
              <dd className='mt-1 text-sm text-gray-900'>{systemInfo.totalMemory}</dd>
            </div>
            <div className='bg-gray-50 p-4 rounded-lg'>
              <dt className='text-sm font-medium text-gray-500'>Free Memory</dt>
              <dd className='mt-1 text-sm text-gray-900'>{systemInfo.freeMemory}</dd>
            </div>
            <div className='bg-gray-50 p-4 rounded-lg'>
              <dt className='text-sm font-medium text-gray-500'>CPU Cores</dt>
              <dd className='mt-1 text-sm text-gray-900'>{systemInfo.cpus}</dd>
            </div>
            <div className='bg-gray-50 p-4 rounded-lg'>
              <dt className='text-sm font-medium text-gray-500'>Uptime</dt>
              <dd className='mt-1 text-sm text-gray-900'>{systemInfo.uptime}</dd>
            </div>
          </div>
        ) : (
          <div className='text-center py-4'>
            <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto'></div>
            <p className='mt-2 text-sm text-gray-500'>Loading system information...</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderEnvironmentConfig = () => (
    <div className='space-y-6'>
      <div>
        <h3 className='text-lg font-medium text-gray-900 mb-4'>Environment Configuration</h3>
        <div className='bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6'>
          <div className='flex'>
            <AlertTriangle className='h-5 w-5 text-yellow-400' />
            <div className='ml-3'>
              <h3 className='text-sm font-medium text-yellow-800'>Environment Variables</h3>
              <div className='mt-2 text-sm text-yellow-700'>
                <p>
                  These settings are read from environment variables. Changes here are for reference
                  only and require server restart to take effect.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700' htmlFor='backend-port'>
              Backend Port
            </label>
            <input
              id='backend-port'
              type='text'
              value={envConfig.backendPort}
              onChange={e => setEnvConfig(prev => ({ ...prev, backendPort: e.target.value }))}
              className='mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500'
              readOnly
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700' htmlFor='frontend-port'>
              Frontend Port
            </label>
            <input
              id='frontend-port'
              type='text'
              value={envConfig.frontendPort}
              onChange={e => setEnvConfig(prev => ({ ...prev, frontendPort: e.target.value }))}
              className='mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500'
              readOnly
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700' htmlFor='public-ip'>
              Public IP
            </label>
            <input
              id='public-ip'
              type='text'
              value={envConfig.publicIp}
              onChange={e => setEnvConfig(prev => ({ ...prev, publicIp: e.target.value }))}
              className='mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500'
              placeholder='103.195.190.235'
              readOnly
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700' htmlFor='server-host'>
              Server Host
            </label>
            <input
              id='server-host'
              type='text'
              value={envConfig.serverHost}
              onChange={e => setEnvConfig(prev => ({ ...prev, serverHost: e.target.value }))}
              className='mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500'
              readOnly
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700' htmlFor='node-env'>
              Node Environment
            </label>
            <input
              id='node-env'
              type='text'
              value={envConfig.nodeEnv}
              className='mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500'
              readOnly
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700' htmlFor='log-level'>
              Log Level
            </label>
            <input
              id='log-level'
              type='text'
              value={envConfig.logLevel}
              className='mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500'
              readOnly
            />
          </div>
          <div className='md:col-span-2'>
            <label className='block text-sm font-medium text-gray-700' htmlFor='cors-origin'>
              CORS Origin
            </label>
            <input
              id='cors-origin'
              type='text'
              value={envConfig.corsOrigin}
              onChange={e => setEnvConfig(prev => ({ ...prev, corsOrigin: e.target.value }))}
              className='mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500'
              placeholder='http://103.195.190.235:3000'
              readOnly
            />
          </div>
          <div className='md:col-span-2'>
            <label className='block text-sm font-medium text-gray-700' htmlFor='bot-api-server'>
              Bot API Server
            </label>
            <input
              id='bot-api-server'
              type='text'
              value={envConfig.botApiServer}
              onChange={e => setEnvConfig(prev => ({ ...prev, botApiServer: e.target.value }))}
              className='mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500'
              readOnly
            />
          </div>
          <div className='md:col-span-2'>
            <label className='block text-sm font-medium text-gray-700' htmlFor='data-path'>
              Data Path
            </label>
            <input
              id='data-path'
              type='text'
              value={envConfig.dataPath}
              onChange={e => setEnvConfig(prev => ({ ...prev, dataPath: e.target.value }))}
              className='mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500'
              readOnly
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderDatabaseConfig = () => (
    <div className='space-y-6'>
      <div>
        <h3 className='text-lg font-medium text-gray-900 mb-4'>Database Configuration</h3>

        {/* Connection Status */}
        <div className='flex items-center justify-between p-4 bg-gray-50 rounded-lg mb-6'>
          <div>
            <h4 className='text-sm font-medium text-gray-900'>Database Connection</h4>
            <p className='text-sm text-gray-500'>Last tested: {dbConfig.lastConnectionTest}</p>
          </div>
          <div className='flex items-center space-x-3'>
            {dbConfig.isConnected ? (
              <CheckCircle className='h-5 w-5 text-green-500' />
            ) : (
              <AlertTriangle className='h-5 w-5 text-red-500' />
            )}
            <span
              className={`text-sm font-medium ${dbConfig.isConnected ? 'text-green-700' : 'text-red-700'}`}
            >
              {dbConfig.isConnected ? 'Connected' : 'Disconnected'}
            </span>
            <button
              onClick={testDatabaseConnection}
              className='inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50'
            >
              Test Connection
            </button>
          </div>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700' htmlFor='db-host'>
              Host
            </label>
            <input
              id='db-host'
              type='text'
              value={dbConfig.host}
              onChange={e => setDbConfig(prev => ({ ...prev, host: e.target.value }))}
              className='mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700' htmlFor='db-port'>
              Port
            </label>
            <input
              id='db-port'
              type='text'
              value={dbConfig.port}
              onChange={e => setDbConfig(prev => ({ ...prev, port: e.target.value }))}
              className='mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700' htmlFor='db-database'>
              Database Name
            </label>
            <input
              id='db-database'
              type='text'
              value={dbConfig.database}
              onChange={e => setDbConfig(prev => ({ ...prev, database: e.target.value }))}
              className='mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700' htmlFor='db-username'>
              Username
            </label>
            <input
              id='db-username'
              type='text'
              value={dbConfig.username}
              onChange={e => setDbConfig(prev => ({ ...prev, username: e.target.value }))}
              className='mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700' htmlFor='db-password'>
              Password
            </label>
            <div className='relative'>
              <input
                id='db-password'
                type={showPasswords ? 'text' : 'password'}
                value={dbConfig.password}
                onChange={e => setDbConfig(prev => ({ ...prev, password: e.target.value }))}
                className='mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 pr-10'
              />
              <button
                type='button'
                onClick={() => setShowPasswords(!showPasswords)}
                className='absolute inset-y-0 right-0 pr-3 flex items-center'
              >
                {showPasswords ? (
                  <EyeOff className='h-4 w-4 text-gray-400' />
                ) : (
                  <Eye className='h-4 w-4 text-gray-400' />
                )}
              </button>
            </div>
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700' htmlFor='db-max-connections'>
              Max Connections
            </label>
            <input
              id='db-max-connections'
              type='number'
              value={dbConfig.maxConnections}
              onChange={e =>
                setDbConfig(prev => ({ ...prev, maxConnections: parseInt(e.target.value) }))
              }
              className='mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500'
            />
          </div>
          <div>
            <label
              className='block text-sm font-medium text-gray-700'
              htmlFor='db-connection-timeout'
            >
              Connection Timeout (ms)
            </label>
            <input
              id='db-connection-timeout'
              type='number'
              value={dbConfig.connectionTimeout}
              onChange={e =>
                setDbConfig(prev => ({ ...prev, connectionTimeout: parseInt(e.target.value) }))
              }
              className='mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500'
            />
          </div>
        </div>

        <div className='mt-4'>
          <label className='flex items-center'>
            <input
              type='checkbox'
              checked={dbConfig.ssl}
              onChange={e => setDbConfig(prev => ({ ...prev, ssl: e.target.checked }))}
              className='rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50'
            />
            <span className='ml-2 text-sm text-gray-900'>Enable SSL Connection</span>
          </label>
        </div>
      </div>
    </div>
  );

  const renderBotConfig = () => (
    <div className='space-y-6'>
      <div>
        <h3 className='text-lg font-medium text-gray-900 mb-4'>Bot Configuration</h3>
        <div className='space-y-4'>
          <div className='flex items-center justify-between p-4 bg-gray-50 rounded-lg'>
            <div>
              <h4 className='text-sm font-medium text-gray-900'>Bot Status</h4>
              <p className='text-sm text-gray-500'>Current bot operational status</p>
            </div>
            <div className='flex items-center'>
              {botConfig.isActive ? (
                <CheckCircle className='h-5 w-5 text-green-500' />
              ) : (
                <AlertTriangle className='h-5 w-5 text-red-500' />
              )}
              <span
                className={`ml-2 text-sm font-medium ${botConfig.isActive ? 'text-green-700' : 'text-red-700'}`}
              >
                {botConfig.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div className='bg-gray-50 p-4 rounded-lg'>
              <dt className='text-sm font-medium text-gray-500'>Total Users</dt>
              <dd className='mt-1 text-2xl font-semibold text-gray-900'>{botConfig.totalUsers}</dd>
            </div>
            <div className='bg-gray-50 p-4 rounded-lg'>
              <dt className='text-sm font-medium text-gray-500'>Active Features</dt>
              <dd className='mt-1 text-2xl font-semibold text-gray-900'>
                {botConfig.activeFeatures}
              </dd>
            </div>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div>
              <label
                className='block text-sm font-medium text-gray-700'
                htmlFor='bot-api-server-config'
              >
                Bot API Server
              </label>
              <input
                id='bot-api-server-config'
                type='text'
                value={botConfig.apiServer}
                onChange={e => setBotConfig(prev => ({ ...prev, apiServer: e.target.value }))}
                className='mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500'
              />
            </div>
            <div>
              <label
                className='block text-sm font-medium text-gray-700'
                htmlFor='bot-max-file-size'
              >
                Max File Size
              </label>
              <input
                id='bot-max-file-size'
                type='text'
                value={botConfig.maxFileSize}
                onChange={e => setBotConfig(prev => ({ ...prev, maxFileSize: e.target.value }))}
                className='mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500'
                placeholder='50MB'
              />
            </div>
          </div>

          <div className='space-y-3'>
            <div>
              <label className='flex items-center'>
                <input
                  type='checkbox'
                  checked={botConfig.polling}
                  onChange={e => setBotConfig(prev => ({ ...prev, polling: e.target.checked }))}
                  className='rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50'
                />
                <span className='ml-2 text-sm text-gray-900'>Enable Polling Mode</span>
              </label>
              <p className='ml-6 text-xs text-gray-500'>
                Bot will continuously poll for new messages
              </p>
            </div>

            <div>
              <label className='flex items-center'>
                <input
                  type='checkbox'
                  checked={botConfig.webhookMode}
                  onChange={e => setBotConfig(prev => ({ ...prev, webhookMode: e.target.checked }))}
                  className='rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50'
                />
                <span className='ml-2 text-sm text-gray-900'>Enable Webhook Mode</span>
              </label>
              <p className='ml-6 text-xs text-gray-500'>
                Bot will receive messages via webhook (recommended for production)
              </p>
            </div>
          </div>

          <div>
            <h4 className='block text-sm font-medium text-gray-700 mb-2'>Allowed MIME Types</h4>
            <div className='flex flex-wrap gap-2'>
              {botConfig.allowedMimeTypes.map((type, index) => (
                <span
                  key={index}
                  className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800'
                >
                  {type}
                </span>
              ))}
              {botConfig.allowedMimeTypes.length === 0 && (
                <span className='text-sm text-gray-500'>No MIME types configured</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderFileConfig = () => (
    <div className='space-y-6'>
      <div>
        <h3 className='text-lg font-medium text-gray-900 mb-4'>File Management Settings</h3>
        <div className='space-y-4'>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div className='bg-blue-50 p-4 rounded-lg'>
              <dt className='text-sm font-medium text-blue-600'>Total Storage</dt>
              <dd className='mt-1 text-2xl font-semibold text-blue-900'>
                {fileConfig.totalStorage}
              </dd>
            </div>
            <div className='bg-green-50 p-4 rounded-lg'>
              <dt className='text-sm font-medium text-green-600'>Used Storage</dt>
              <dd className='mt-1 text-2xl font-semibold text-green-900'>
                {fileConfig.usedStorage}
              </dd>
            </div>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div>
              <label className='block text-sm font-medium text-gray-700' htmlFor='max-file-size'>
                Max File Size
              </label>
              <input
                id='max-file-size'
                type='text'
                value={fileConfig.maxFileSize}
                onChange={e => setFileConfig(prev => ({ ...prev, maxFileSize: e.target.value }))}
                className='mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500'
              />
            </div>
            <div>
              <label className='block text-sm font-medium text-gray-700' htmlFor='retention-days'>
                Retention Days
              </label>
              <input
                id='retention-days'
                type='number'
                value={fileConfig.retentionDays}
                onChange={e =>
                  setFileConfig(prev => ({ ...prev, retentionDays: parseInt(e.target.value) }))
                }
                className='mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500'
              />
            </div>
          </div>

          <div>
            <label className='flex items-center'>
              <input
                type='checkbox'
                checked={fileConfig.autoCleanup}
                onChange={e => setFileConfig(prev => ({ ...prev, autoCleanup: e.target.checked }))}
                className='rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50'
              />
              <span className='ml-2 text-sm text-gray-900'>Enable Auto Cleanup</span>
            </label>
          </div>

          <div>
            <label className='flex items-center'>
              <input
                type='checkbox'
                checked={fileConfig.virusScanEnabled}
                onChange={e =>
                  setFileConfig(prev => ({ ...prev, virusScanEnabled: e.target.checked }))
                }
                className='rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50'
              />
              <span className='ml-2 text-sm text-gray-900'>Enable Virus Scanning</span>
            </label>
            <p className='ml-6 text-xs text-gray-500'>
              Scan uploaded files for malware (requires ClamAV)
            </p>
          </div>

          <div>
            <h4 className='block text-sm font-medium text-gray-700 mb-2'>
              Allowed File Extensions
            </h4>
            <div className='space-y-2'>
              <div className='flex flex-wrap gap-2'>
                {fileConfig.allowedExtensions.map((ext, index) => (
                  <span
                    key={index}
                    className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800'
                  >
                    .{ext}
                    <button
                      onClick={() => removeFileExtension(ext)}
                      className='ml-1 text-blue-600 hover:text-blue-800'
                    >
                      <X className='h-3 w-3' />
                    </button>
                  </span>
                ))}
              </div>
              <div className='flex items-center space-x-2'>
                <input
                  type='text'
                  placeholder='Add extension (e.g. pdf)'
                  className='flex-1 text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500'
                  onKeyPress={e => {
                    if (e.key === 'Enter') {
                      const input = e.target as HTMLInputElement;
                      const ext = input.value.replace('.', '').toLowerCase();
                      if (ext) {
                        addFileExtension(ext);
                        input.value = '';
                      }
                    }
                  }}
                />
                <button
                  onClick={e => {
                    const input = (e.target as HTMLElement).parentElement?.querySelector('input');
                    if (input) {
                      const ext = input.value.replace('.', '').toLowerCase();
                      if (ext) {
                        addFileExtension(ext);
                        input.value = '';
                      }
                    }
                  }}
                  className='inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50'
                >
                  <Plus className='h-3 w-3 mr-1' />
                  Add
                </button>
              </div>
            </div>
          </div>

          <div>
            <h4 className='block text-sm font-medium text-gray-700 mb-2'>Allowed MIME Types</h4>
            <div className='flex flex-wrap gap-2'>
              {fileConfig.allowedMimeTypes.map((type, index) => (
                <span
                  key={index}
                  className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800'
                >
                  {type}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSecurity = () => (
    <div className='space-y-6'>
      <div>
        <h3 className='text-lg font-medium text-gray-900 mb-4'>Security Settings</h3>

        {/* JWT Configuration */}
        <div className='space-y-4'>
          <div className='border-b border-gray-200 pb-4'>
            <h4 className='text-md font-medium text-gray-900 mb-3 flex items-center'>
              <Key className='h-4 w-4 mr-2' />
              JWT Authentication
            </h4>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div>
                <label
                  className='block text-sm font-medium text-gray-700'
                  htmlFor='jwt-expiration-time'
                >
                  JWT Expiration Time
                </label>
                <select
                  id='jwt-expiration-time'
                  value={securityConfig.jwtExpirationTime}
                  onChange={e =>
                    setSecurityConfig(prev => ({ ...prev, jwtExpirationTime: e.target.value }))
                  }
                  className='mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500'
                >
                  <option value='15m'>15 minutes</option>
                  <option value='30m'>30 minutes</option>
                  <option value='1h'>1 hour</option>
                  <option value='2h'>2 hours</option>
                  <option value='24h'>24 hours</option>
                </select>
              </div>
              <div>
                <label
                  className='block text-sm font-medium text-gray-700'
                  htmlFor='refresh-token-expiration'
                >
                  Refresh Token Expiration
                </label>
                <select
                  id='refresh-token-expiration'
                  value={securityConfig.refreshTokenExpiration}
                  onChange={e =>
                    setSecurityConfig(prev => ({ ...prev, refreshTokenExpiration: e.target.value }))
                  }
                  className='mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500'
                >
                  <option value='1d'>1 day</option>
                  <option value='7d'>7 days</option>
                  <option value='30d'>30 days</option>
                  <option value='90d'>90 days</option>
                </select>
              </div>
            </div>
          </div>

          {/* Rate Limiting */}
          <div className='border-b border-gray-200 pb-4'>
            <h4 className='text-md font-medium text-gray-900 mb-3 flex items-center'>
              <Shield className='h-4 w-4 mr-2' />
              Rate Limiting
            </h4>
            <div className='space-y-3'>
              <div>
                <label className='flex items-center'>
                  <input
                    type='checkbox'
                    checked={securityConfig.rateLimitEnabled}
                    onChange={e =>
                      setSecurityConfig(prev => ({ ...prev, rateLimitEnabled: e.target.checked }))
                    }
                    className='rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50'
                  />
                  <span className='ml-2 text-sm text-gray-900'>Enable Rate Limiting</span>
                </label>
              </div>
              {securityConfig.rateLimitEnabled && (
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <div>
                    <label
                      className='block text-sm font-medium text-gray-700'
                      htmlFor='max-requests'
                    >
                      Max Requests
                    </label>
                    <input
                      id='max-requests'
                      type='number'
                      value={securityConfig.rateLimitRequests}
                      onChange={e =>
                        setSecurityConfig(prev => ({
                          ...prev,
                          rateLimitRequests: parseInt(e.target.value),
                        }))
                      }
                      className='mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500'
                    />
                  </div>
                  <div>
                    <label
                      className='block text-sm font-medium text-gray-700'
                      htmlFor='time-window'
                    >
                      Time Window (minutes)
                    </label>
                    <input
                      id='time-window'
                      type='number'
                      value={securityConfig.rateLimitWindow}
                      onChange={e =>
                        setSecurityConfig(prev => ({
                          ...prev,
                          rateLimitWindow: parseInt(e.target.value),
                        }))
                      }
                      className='mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500'
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* CORS Configuration */}
          <div className='border-b border-gray-200 pb-4'>
            <h4 className='text-md font-medium text-gray-900 mb-3 flex items-center'>
              <Lock className='h-4 w-4 mr-2' />
              CORS Configuration
            </h4>
            <div className='space-y-3'>
              <div>
                <label className='flex items-center'>
                  <input
                    type='checkbox'
                    checked={securityConfig.corsEnabled}
                    onChange={e =>
                      setSecurityConfig(prev => ({ ...prev, corsEnabled: e.target.checked }))
                    }
                    className='rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50'
                  />
                  <span className='ml-2 text-sm text-gray-900'>Enable CORS</span>
                </label>
              </div>
              {securityConfig.corsEnabled && (
                <div>
                  <h4 className='block text-sm font-medium text-gray-700 mb-2'>Allowed Origins</h4>
                  <div className='space-y-2'>
                    <div className='flex flex-wrap gap-2'>
                      {securityConfig.corsOrigins.map((origin, index) => (
                        <span
                          key={index}
                          className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800'
                        >
                          {origin}
                          <button
                            onClick={() => removeCorsOrigin(origin)}
                            className='ml-1 text-purple-600 hover:text-purple-800'
                          >
                            <X className='h-3 w-3' />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className='flex items-center space-x-2'>
                      <input
                        type='text'
                        placeholder='Add origin (e.g. https://example.com)'
                        className='flex-1 text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500'
                        onKeyPress={e => {
                          if (e.key === 'Enter') {
                            const input = e.target as HTMLInputElement;
                            const origin = input.value.trim();
                            if (origin) {
                              addCorsOrigin(origin);
                              input.value = '';
                            }
                          }
                        }}
                      />
                      <button
                        onClick={e => {
                          const input = (e.target as HTMLElement).parentElement?.querySelector(
                            'input'
                          );
                          if (input) {
                            const origin = input.value.trim();
                            if (origin) {
                              addCorsOrigin(origin);
                              input.value = '';
                            }
                          }
                        }}
                        className='inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50'
                      >
                        <Plus className='h-3 w-3 mr-1' />
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Additional Security Settings */}
          <div>
            <h4 className='text-md font-medium text-gray-900 mb-3'>Additional Security</h4>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div>
                <label
                  className='block text-sm font-medium text-gray-700'
                  htmlFor='password-min-length'
                >
                  Password Min Length
                </label>
                <input
                  id='password-min-length'
                  type='number'
                  value={securityConfig.passwordMinLength}
                  onChange={e =>
                    setSecurityConfig(prev => ({
                      ...prev,
                      passwordMinLength: parseInt(e.target.value),
                    }))
                  }
                  className='mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500'
                  min='6'
                  max='32'
                />
              </div>
              <div>
                <label
                  className='block text-sm font-medium text-gray-700'
                  htmlFor='session-timeout'
                >
                  Session Timeout (seconds)
                </label>
                <input
                  id='session-timeout'
                  type='number'
                  value={securityConfig.sessionTimeout}
                  onChange={e =>
                    setSecurityConfig(prev => ({
                      ...prev,
                      sessionTimeout: parseInt(e.target.value),
                    }))
                  }
                  className='mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500'
                />
              </div>
            </div>

            <div className='mt-4 space-y-3'>
              <div>
                <label className='flex items-center'>
                  <input
                    type='checkbox'
                    checked={securityConfig.bruteForceProtection}
                    onChange={e =>
                      setSecurityConfig(prev => ({
                        ...prev,
                        bruteForceProtection: e.target.checked,
                      }))
                    }
                    className='rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50'
                  />
                  <span className='ml-2 text-sm text-gray-900'>Enable Brute Force Protection</span>
                </label>
                <p className='ml-6 text-xs text-gray-500'>
                  Block IP addresses after multiple failed login attempts
                </p>
              </div>

              <div>
                <label className='flex items-center'>
                  <input
                    type='checkbox'
                    checked={securityConfig.twoFactorEnabled}
                    onChange={e =>
                      setSecurityConfig(prev => ({ ...prev, twoFactorEnabled: e.target.checked }))
                    }
                    className='rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50'
                  />
                  <span className='ml-2 text-sm text-gray-900'>
                    Enable Two-Factor Authentication
                  </span>
                </label>
                <p className='ml-6 text-xs text-gray-500'>
                  Require 2FA for admin accounts (coming soon)
                </p>
              </div>
            </div>
          </div>

          {/* Current Security Status */}
          <div className='bg-gray-50 border border-gray-200 rounded-md p-4'>
            <h4 className='text-sm font-medium text-gray-900 mb-2'>Current Security Status</h4>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div className='flex justify-between'>
                <span className='text-sm text-gray-500'>Authentication</span>
                <span className='text-sm text-gray-900'>JWT with refresh tokens</span>
              </div>
              <div className='flex justify-between'>
                <span className='text-sm text-gray-500'>Password Hashing</span>
                <span className='text-sm text-gray-900'>SHA256</span>
              </div>
              <div className='flex justify-between'>
                <span className='text-sm text-gray-500'>CORS</span>
                <span
                  className={`text-sm ${securityConfig.corsEnabled ? 'text-green-600' : 'text-red-600'}`}
                >
                  {securityConfig.corsEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className='flex justify-between'>
                <span className='text-sm text-gray-500'>Rate Limiting</span>
                <span
                  className={`text-sm ${securityConfig.rateLimitEnabled ? 'text-green-600' : 'text-red-600'}`}
                >
                  {securityConfig.rateLimitEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className='mb-8'>
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='text-2xl font-bold text-gray-900'>System Settings</h1>
            <p className='mt-1 text-sm text-gray-600'>
              Configure system settings, bot configuration, and environment variables
            </p>
          </div>
          <div className='flex space-x-3'>
            <button
              onClick={handleRefresh}
              className='inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50'
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handleSave}
              className='inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700'
              disabled={saving}
            >
              <Save className='h-4 w-4 mr-2' />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className='border-b border-gray-200 mb-6'>
        <nav className='-mb-px flex space-x-8'>
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center`}
              >
                <Icon className='h-4 w-4 mr-2' />
                {tab.name}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className='bg-white shadow rounded-lg p-6'>
        {activeTab === 'system' && renderSystemInfo()}
        {activeTab === 'environment' && renderEnvironmentConfig()}
        {activeTab === 'database' && renderDatabaseConfig()}
        {activeTab === 'bot' && renderBotConfig()}
        {activeTab === 'files' && renderFileConfig()}
        {activeTab === 'security' && renderSecurity()}
      </div>
    </div>
  );
}
