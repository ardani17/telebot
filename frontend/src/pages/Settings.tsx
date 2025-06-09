import { useState, useEffect } from 'react'
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
  CheckCircle
} from 'lucide-react'
import api from '../lib/api'

interface SystemInfo {
  nodeVersion: string
  platform: string
  arch: string
  totalMemory: string
  freeMemory: string
  uptime: string
  cpus: number
}

interface EnvironmentConfig {
  backendPort: string
  frontendPort: string
  publicIp: string
  serverHost: string
  corsOrigin: string
  botApiServer: string
  dataPath: string
}

// DatabaseConfig interface - will be implemented later
// interface DatabaseConfig {
//   host: string
//   port: string
//   database: string
//   ssl: boolean
//   maxConnections: number
// }

interface BotConfig {
  isActive: boolean
  webhookMode: boolean
  polling: boolean
  lastActivity: string
  totalUsers: number
  activeFeatures: number
}

interface FileManagementConfig {
  maxFileSize: string
  allowedExtensions: string[]
  autoCleanup: boolean
  retentionDays: number
  totalStorage: string
  usedStorage: string
}

export function Settings() {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('system')
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)
  const [envConfig, setEnvConfig] = useState<EnvironmentConfig>({
    backendPort: '3001',
    frontendPort: '3000',
    publicIp: '',
    serverHost: '0.0.0.0',
    corsOrigin: '',
    botApiServer: 'http://localhost:8081',
    dataPath: '/home/teleweb/backend/data-bot-api'
  })
  // Database config - will be implemented later
  // const [dbConfig, setDbConfig] = useState<DatabaseConfig>({
  //   host: 'localhost',
  //   port: '5432', 
  //   database: 'teleweb',
  //   ssl: false,
  //   maxConnections: 10
  // })
  const [botConfig, setBotConfig] = useState<BotConfig>({
    isActive: false,
    webhookMode: false,
    polling: true,
    lastActivity: '',
    totalUsers: 0,
    activeFeatures: 0
  })
  const [fileConfig, setFileConfig] = useState<FileManagementConfig>({
    maxFileSize: '50MB',
    allowedExtensions: ['jpg', 'png', 'pdf', 'zip', 'rar', 'xlsx', 'kml'],
    autoCleanup: true,
    retentionDays: 30,
    totalStorage: '0GB',
    usedStorage: '0GB'
  })

  const tabs = [
    { id: 'system', name: 'System Info', icon: Server },
    { id: 'environment', name: 'Environment', icon: SettingsIcon },
    { id: 'database', name: 'Database', icon: Database },
    { id: 'bot', name: 'Bot Configuration', icon: Bot },
    { id: 'files', name: 'File Management', icon: HardDrive },
    { id: 'security', name: 'Security', icon: Shield }
  ]

  const fetchSystemInfo = async () => {
    try {
      const response = await api.get('/dashboard/system-status')
      const data = response.data
      
      setSystemInfo({
        nodeVersion: data.nodejs?.version || 'Unknown',
        platform: data.platform || 'Unknown',
        arch: data.arch || 'Unknown',
        totalMemory: data.memory?.total || 'Unknown',
        freeMemory: data.memory?.free || 'Unknown',
        uptime: data.uptime || 'Unknown',
        cpus: data.cpus || 0
      })
    } catch (err) {
      console.error('Failed to fetch system info:', err)
    }
  }

  const fetchBotConfig = async () => {
    try {
      const [statsResponse, usersResponse, featuresResponse] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/admin/users'),
        api.get('/admin/features')
      ])

      setBotConfig({
        isActive: statsResponse.data.botStatus === 'running',
        webhookMode: false, // TODO: get from bot config
        polling: true, // TODO: get from bot config
        lastActivity: statsResponse.data.lastActivity || 'Never',
        totalUsers: usersResponse.data.length || 0,
        activeFeatures: featuresResponse.data.filter((f: any) => f.isActive).length || 0
      })
    } catch (err) {
      console.error('Failed to fetch bot config:', err)
    }
  }

  const fetchFileConfig = async () => {
    try {
      const response = await api.get('/files/stats/storage')
      const stats = response.data
      
      setFileConfig(prev => ({
        ...prev,
        totalStorage: stats.formatted?.totalSizeFormatted || '0GB',
        usedStorage: stats.formatted?.totalSizeFormatted || '0GB'
      }))
    } catch (err) {
      console.error('Failed to fetch file config:', err)
    }
  }

  const fetchAppSettings = async () => {
    try {
      const response = await api.get('/settings')
      const { settings } = response.data

      // Update bot config from database settings
      if (settings.BOT) {
        const botSettings = settings.BOT.reduce((acc: any, setting: any) => {
          acc[setting.key] = setting.value === 'true' ? true : setting.value === 'false' ? false : setting.value
          return acc
        }, {})

        setBotConfig(prev => ({
          ...prev,
          polling: botSettings['bot.polling'] !== undefined ? botSettings['bot.polling'] : prev.polling,
          webhookMode: botSettings['bot.webhook'] !== undefined ? botSettings['bot.webhook'] : prev.webhookMode,
        }))
      }

      // Update file config from database settings
      if (settings.FILES) {
        const fileSettings = settings.FILES.reduce((acc: any, setting: any) => {
          acc[setting.key] = setting.value
          return acc
        }, {})

        setFileConfig(prev => ({
          ...prev,
          maxFileSize: fileSettings['files.maxSize'] || prev.maxFileSize,
          retentionDays: parseInt(fileSettings['files.retentionDays']) || prev.retentionDays,
          autoCleanup: fileSettings['files.autoCleanup'] === 'true',
        }))
      }

    } catch (err) {
      console.error('Failed to fetch app settings:', err)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Collect all changed settings
      const settings = {
        // Bot settings
        'bot.polling': botConfig.polling,
        'bot.webhook': botConfig.webhookMode,
        
        // File settings
        'files.maxSize': fileConfig.maxFileSize,
        'files.retentionDays': fileConfig.retentionDays,
        'files.autoCleanup': fileConfig.autoCleanup,
        
        // Environment settings (for reference, these stay in .env)
        // 'env.publicIp': envConfig.publicIp,
        // 'env.corsOrigin': envConfig.corsOrigin,
      }

      await api.post('/settings', {
        settings,
        updatedBy: 'admin-web'
      })

      alert('Settings saved successfully!')
    } catch (err: any) {
      console.error('Failed to save settings:', err)
      alert('Failed to save settings: ' + (err.response?.data?.message || err.message))
    } finally {
      setSaving(false)
    }
  }

  const handleRefresh = async () => {
    setLoading(true)
    try {
      await Promise.all([
        fetchSystemInfo(),
        fetchBotConfig(),
        fetchFileConfig(),
        fetchAppSettings()
      ])
    } catch (err) {
      console.error('Failed to refresh data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    handleRefresh()
  }, [])

  const renderSystemInfo = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">System Information</h3>
        {systemInfo ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <dt className="text-sm font-medium text-gray-500">Node.js Version</dt>
              <dd className="mt-1 text-sm text-gray-900">{systemInfo.nodeVersion}</dd>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <dt className="text-sm font-medium text-gray-500">Platform</dt>
              <dd className="mt-1 text-sm text-gray-900">{systemInfo.platform} ({systemInfo.arch})</dd>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <dt className="text-sm font-medium text-gray-500">Total Memory</dt>
              <dd className="mt-1 text-sm text-gray-900">{systemInfo.totalMemory}</dd>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <dt className="text-sm font-medium text-gray-500">Free Memory</dt>
              <dd className="mt-1 text-sm text-gray-900">{systemInfo.freeMemory}</dd>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <dt className="text-sm font-medium text-gray-500">CPU Cores</dt>
              <dd className="mt-1 text-sm text-gray-900">{systemInfo.cpus}</dd>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <dt className="text-sm font-medium text-gray-500">Uptime</dt>
              <dd className="mt-1 text-sm text-gray-900">{systemInfo.uptime}</dd>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-500">Loading system information...</p>
          </div>
        )}
      </div>
    </div>
  )

  const renderEnvironmentConfig = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Environment Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Backend Port</label>
            <input
              type="text"
              value={envConfig.backendPort}
              onChange={(e) => setEnvConfig(prev => ({ ...prev, backendPort: e.target.value }))}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Frontend Port</label>
            <input
              type="text"
              value={envConfig.frontendPort}
              onChange={(e) => setEnvConfig(prev => ({ ...prev, frontendPort: e.target.value }))}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Public IP</label>
            <input
              type="text"
              value={envConfig.publicIp}
              onChange={(e) => setEnvConfig(prev => ({ ...prev, publicIp: e.target.value }))}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="103.195.190.235"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Server Host</label>
            <input
              type="text"
              value={envConfig.serverHost}
              onChange={(e) => setEnvConfig(prev => ({ ...prev, serverHost: e.target.value }))}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">CORS Origin</label>
            <input
              type="text"
              value={envConfig.corsOrigin}
              onChange={(e) => setEnvConfig(prev => ({ ...prev, corsOrigin: e.target.value }))}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="http://103.195.190.235:3000"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Bot API Server</label>
            <input
              type="text"
              value={envConfig.botApiServer}
              onChange={(e) => setEnvConfig(prev => ({ ...prev, botApiServer: e.target.value }))}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Data Path</label>
            <input
              type="text"
              value={envConfig.dataPath}
              onChange={(e) => setEnvConfig(prev => ({ ...prev, dataPath: e.target.value }))}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>
    </div>
  )

  const renderBotConfig = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Bot Configuration</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h4 className="text-sm font-medium text-gray-900">Bot Status</h4>
              <p className="text-sm text-gray-500">Current bot operational status</p>
            </div>
            <div className="flex items-center">
              {botConfig.isActive ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-red-500" />
              )}
              <span className={`ml-2 text-sm font-medium ${botConfig.isActive ? 'text-green-700' : 'text-red-700'}`}>
                {botConfig.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <dt className="text-sm font-medium text-gray-500">Total Users</dt>
              <dd className="mt-1 text-2xl font-semibold text-gray-900">{botConfig.totalUsers}</dd>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <dt className="text-sm font-medium text-gray-500">Active Features</dt>
              <dd className="mt-1 text-2xl font-semibold text-gray-900">{botConfig.activeFeatures}</dd>
            </div>
          </div>

          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={botConfig.polling}
                onChange={(e) => setBotConfig(prev => ({ ...prev, polling: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
              />
              <span className="ml-2 text-sm text-gray-900">Enable Polling Mode</span>
            </label>
          </div>
          
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={botConfig.webhookMode}
                onChange={(e) => setBotConfig(prev => ({ ...prev, webhookMode: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
              />
              <span className="ml-2 text-sm text-gray-900">Enable Webhook Mode</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  )

  const renderFileConfig = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">File Management Settings</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <dt className="text-sm font-medium text-blue-600">Total Storage</dt>
              <dd className="mt-1 text-2xl font-semibold text-blue-900">{fileConfig.totalStorage}</dd>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <dt className="text-sm font-medium text-green-600">Used Storage</dt>
              <dd className="mt-1 text-2xl font-semibold text-green-900">{fileConfig.usedStorage}</dd>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Max File Size</label>
              <input
                type="text"
                value={fileConfig.maxFileSize}
                onChange={(e) => setFileConfig(prev => ({ ...prev, maxFileSize: e.target.value }))}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Retention Days</label>
              <input
                type="number"
                value={fileConfig.retentionDays}
                onChange={(e) => setFileConfig(prev => ({ ...prev, retentionDays: parseInt(e.target.value) }))}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={fileConfig.autoCleanup}
                onChange={(e) => setFileConfig(prev => ({ ...prev, autoCleanup: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
              />
              <span className="ml-2 text-sm text-gray-900">Enable Auto Cleanup</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Allowed File Extensions</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {fileConfig.allowedExtensions.map((ext, index) => (
                <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  .{ext}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderSecurity = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Security Settings</h3>
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <div className="flex">
              <AlertTriangle className="h-5 w-5 text-yellow-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">Security Configuration</h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>Security settings will be available in future updates. Currently managed through environment variables.</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <dt className="text-sm font-medium text-gray-500">Authentication</dt>
              <dd className="mt-1 text-sm text-gray-900">JWT with refresh tokens</dd>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <dt className="text-sm font-medium text-gray-500">Password Hashing</dt>
              <dd className="mt-1 text-sm text-gray-900">SHA256</dd>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <dt className="text-sm font-medium text-gray-500">CORS</dt>
              <dd className="mt-1 text-sm text-gray-900">Configured</dd>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <dt className="text-sm font-medium text-gray-500">Rate Limiting</dt>
              <dd className="mt-1 text-sm text-gray-900">Coming Soon</dd>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
            <p className="mt-1 text-sm text-gray-600">
              Configure system settings, bot configuration, and environment variables
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={handleRefresh}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handleSave}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              disabled={saving}
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon
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
                <Icon className="h-4 w-4 mr-2" />
                {tab.name}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white shadow rounded-lg p-6">
        {activeTab === 'system' && renderSystemInfo()}
        {activeTab === 'environment' && renderEnvironmentConfig()}
        {activeTab === 'database' && (
          <div className="text-center py-8">
            <Database className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Database Configuration</h3>
            <p className="mt-1 text-sm text-gray-500">Coming soon</p>
          </div>
        )}
        {activeTab === 'bot' && renderBotConfig()}
        {activeTab === 'files' && renderFileConfig()}
        {activeTab === 'security' && renderSecurity()}
      </div>
    </div>
  )
} 