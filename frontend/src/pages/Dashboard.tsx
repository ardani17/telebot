import React, { useEffect, useState } from 'react'
import { 
  Users, 
  Activity, 
  TrendingUp,
  Bot,
  Server,
  Database,
  Clock,
  Terminal,
  RefreshCw,
  Play,
  Square
} from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'

interface DashboardStats {
  totalUsers: number
  activeUsers: number
  botActivities: number
  todayActivities: number
  userGrowthPercentage: number
  activityGrowthPercentage: number
  systemStatus: {
    database: 'healthy' | 'warning' | 'error'
    bot: 'healthy' | 'warning' | 'error'
    storage: {
      used: number
      total: number
      percentage: number
    }
  }
}

interface RecentActivity {
  id: string
  type: string
  user: string
  description: string
  timestamp: string
}

interface SystemLogs {
  backend: string[]
  frontend: string[]
  bot: string[]
  timestamp: string
}

interface SystemStatus {
  database: string
  bot: string
  storage: {
    used: number
    total: number
    percentage: number
  }
  processes: {
    backend: string
    frontend: string
    bot: string
  }
  uptime: number
  memory: {
    rss: number
    heapTotal: number
    heapUsed: number
    external: number
  }
  timestamp: string
}

export function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([])
  const [systemLogs, setSystemLogs] = useState<SystemLogs | null>(null)
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedLogService, setSelectedLogService] = useState<string>('all')
  const [autoRefresh, setAutoRefresh] = useState(false)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true)
        
        // Fetch dashboard stats
        const statsResponse = await api.get('/dashboard/stats')
        setStats(statsResponse.data)

        // Fetch recent activities
        const activitiesResponse = await api.get('/dashboard/activities?limit=10')
        setRecentActivities(activitiesResponse.data)

        // Fetch system status
        const statusResponse = await api.get('/dashboard/system-status')
        setSystemStatus(statusResponse.data)

        // Fetch logs
        await fetchLogs()

      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load dashboard data')
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  const fetchLogs = async () => {
    try {
      const logsResponse = await api.get(`/dashboard/logs?service=${selectedLogService}&lines=20`)
      setSystemLogs(logsResponse.data)
    } catch (err) {
      console.error('Failed to fetch logs:', err)
    }
  }

  const refreshData = async () => {
    try {
      const [statsRes, statusRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/dashboard/system-status')
      ])
      
      setStats(statsRes.data)
      setSystemStatus(statusRes.data)
      await fetchLogs()
    } catch (err) {
      console.error('Failed to refresh data:', err)
    }
  }

  // Auto refresh every 10 seconds when enabled
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(refreshData, 10000)
    return () => clearInterval(interval)
  }, [autoRefresh, selectedLogService])

  // Refresh logs when service selection changes
  useEffect(() => {
    if (systemLogs) {
      fetchLogs()
    }
  }, [selectedLogService])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error || 'Failed to load dashboard data'}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const formatPercentageChange = (percentage: number) => {
    const absPercentage = Math.abs(percentage);
    const sign = percentage >= 0 ? '+' : '-';
    const direction = percentage >= 0 ? 'Increased' : 'Decreased';
    return `${direction} by ${sign}${absPercentage.toFixed(2)}%`;
  };

  const statCards = [
    {
      name: 'Total Users',
      stat: stats.totalUsers,
      substat: `${stats.activeUsers} active`,
      icon: Users,
      change: formatPercentageChange(stats.userGrowthPercentage),
      changeType: stats.userGrowthPercentage >= 0 ? 'increase' as const : 'decrease' as const,
    },
    {
      name: 'Bot Activities',
      stat: stats.botActivities,
      substat: `${stats.todayActivities} today`,
      icon: Activity,
      change: formatPercentageChange(stats.activityGrowthPercentage),
      changeType: stats.activityGrowthPercentage >= 0 ? 'increase' as const : 'decrease' as const,
    },
    {
      name: 'Storage Usage',
      stat: `${stats.systemStatus.storage.percentage}%`,
      substat: `${(stats.systemStatus.storage.used / 1024 / 1024 / 1024).toFixed(1)}GB of ${(stats.systemStatus.storage.total / 1024 / 1024 / 1024).toFixed(1)}GB`,
      icon: Database,
      change: stats.systemStatus.storage.percentage > 80 ? 'High Usage' : 'Normal Usage',
      changeType: stats.systemStatus.storage.percentage > 80 ? 'decrease' : 'increase' as const,
    },
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100'
      case 'warning': return 'text-yellow-600 bg-yellow-100'
      case 'error': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const formatRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    
    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) return `${diffInHours}h ago`
    
    const diffInDays = Math.floor(diffInHours / 24)
    return `${diffInDays}d ago`
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Welcome back, {user?.name}! Here's what's happening with your system.
        </p>
      </div>

      {/* System Status */}
      <div className="mb-8">
        <h2 className="text-lg font-medium text-gray-900 mb-4">System Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Database className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Database</dt>
                    <dd className="flex items-baseline">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(stats.systemStatus.database)}`}>
                        {stats.systemStatus.database}
                      </span>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Bot className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Bot Service</dt>
                    <dd className="flex items-baseline">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(stats.systemStatus.bot)}`}>
                        {stats.systemStatus.bot}
                      </span>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Server className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">API Server</dt>
                    <dd className="flex items-baseline">
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full text-green-600 bg-green-100">
                        healthy
                      </span>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-8">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Overview</h2>
        <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((item) => (
            <div key={item.name} className="relative bg-white pt-5 px-4 pb-12 sm:pt-6 sm:px-6 shadow rounded-lg overflow-hidden">
              <dt>
                <div className="absolute bg-blue-500 rounded-md p-3">
                  <item.icon className="h-6 w-6 text-white" aria-hidden="true" />
                </div>
                <p className="ml-16 text-sm font-medium text-gray-500 truncate">{item.name}</p>
              </dt>
              <dd className="ml-16 pb-6 flex items-baseline sm:pb-7">
                <p className="text-2xl font-semibold text-gray-900">{item.stat}</p>
                <p className="ml-2 flex items-baseline text-sm font-semibold text-green-600">
                  <TrendingUp className="self-center flex-shrink-0 h-4 w-4 text-green-500" aria-hidden="true" />
                  <span className="sr-only"> {item.changeType === 'increase' ? 'Increased' : 'Decreased'} by </span>
                  {item.change}
                </p>
                <div className="absolute bottom-0 inset-x-0 bg-gray-50 px-4 py-4 sm:px-6">
                  <div className="text-sm">
                    <p className="text-gray-600">{item.substat}</p>
                  </div>
                </div>
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Recent Activities */}
      <div className="mb-8">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Activities</h2>
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul role="list" className="divide-y divide-gray-200">
            {recentActivities.length > 0 ? (
              recentActivities.map((activity) => (
                <li key={activity.id}>
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <Activity className="h-5 w-5 text-gray-400" />
                        </div>
                        <div className="ml-4">
                          <div className="flex items-center">
                            <p className="text-sm font-medium text-blue-600 truncate">
                              {activity.type}
                            </p>
                            <p className="ml-2 text-sm text-gray-500">
                              by {activity.user}
                            </p>
                          </div>
                          <p className="text-sm text-gray-600">{activity.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center text-sm text-gray-500">
                        <Clock className="h-4 w-4 mr-1" />
                        {formatRelativeTime(activity.timestamp)}
                      </div>
                    </div>
                  </div>
                </li>
              ))
            ) : (
              <li>
                <div className="px-4 py-4 sm:px-6 text-center text-gray-500">
                  No recent activities
                </div>
              </li>
            )}
          </ul>
        </div>
      </div>

      {/* System Logs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">System Logs</h2>
          <div className="flex items-center space-x-4">
            {/* Service selector */}
            <select
              value={selectedLogService}
              onChange={(e) => setSelectedLogService(e.target.value)}
              className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Services</option>
              <option value="backend">Backend</option>
              <option value="frontend">Frontend</option>
              <option value="bot">Bot</option>
            </select>

            {/* Auto refresh toggle */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center px-3 py-1 text-sm rounded-md ${
                autoRefresh
                  ? 'bg-green-100 text-green-700 border border-green-300'
                  : 'bg-gray-100 text-gray-700 border border-gray-300'
              }`}
            >
              {autoRefresh ? <Square className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
              {autoRefresh ? 'Stop' : 'Auto Refresh'}
            </button>

            {/* Manual refresh */}
            <button
              onClick={refreshData}
              className="flex items-center px-3 py-1 text-sm bg-blue-100 text-blue-700 border border-blue-300 rounded-md hover:bg-blue-200"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </button>
          </div>
        </div>

        {/* Process Status */}
        {systemStatus && (
          <div className="mb-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="flex items-center">
                  <Server className="h-5 w-5 text-blue-500 mr-2" />
                  <span className="text-sm font-medium">Backend</span>
                  <span className={`ml-auto px-2 py-1 text-xs rounded-full ${
                    systemStatus.processes.backend === 'running'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {systemStatus.processes.backend}
                  </span>
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="flex items-center">
                  <Terminal className="h-5 w-5 text-purple-500 mr-2" />
                  <span className="text-sm font-medium">Frontend</span>
                  <span className={`ml-auto px-2 py-1 text-xs rounded-full ${
                    systemStatus.processes.frontend === 'running'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {systemStatus.processes.frontend}
                  </span>
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="flex items-center">
                  <Bot className="h-5 w-5 text-green-500 mr-2" />
                  <span className="text-sm font-medium">Bot</span>
                  <span className={`ml-auto px-2 py-1 text-xs rounded-full ${
                    systemStatus.processes.bot === 'running'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {systemStatus.processes.bot}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Logs Display */}
        <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-300">
              📋 {selectedLogService === 'all' ? 'All Services' : selectedLogService.charAt(0).toUpperCase() + selectedLogService.slice(1)} Logs
            </span>
            {systemLogs && (
              <span className="text-xs text-gray-400">
                Last updated: {new Date(systemLogs.timestamp).toLocaleTimeString()}
              </span>
            )}
          </div>
          
          <div className="max-h-64 overflow-y-auto space-y-1">
            {systemLogs ? (
              <>
                {selectedLogService === 'all' || selectedLogService === 'backend' ? (
                  systemLogs.backend.map((log, index) => (
                    <div key={`backend-${index}`} className="text-blue-400">
                      <span className="text-blue-300">[BACKEND]</span> {log}
                    </div>
                  ))
                ) : null}
                
                {selectedLogService === 'all' || selectedLogService === 'frontend' ? (
                  systemLogs.frontend.map((log, index) => (
                    <div key={`frontend-${index}`} className="text-purple-400">
                      <span className="text-purple-300">[FRONTEND]</span> {log}
                    </div>
                  ))
                ) : null}
                
                {selectedLogService === 'all' || selectedLogService === 'bot' ? (
                  systemLogs.bot.map((log, index) => (
                    <div key={`bot-${index}`} className="text-green-400">
                      <span className="text-green-300">[BOT]</span> {log}
                    </div>
                  ))
                ) : null}
                
                {systemLogs.backend.length === 0 && 
                 systemLogs.frontend.length === 0 && 
                 systemLogs.bot.length === 0 && (
                  <div className="text-gray-400">No logs available for {selectedLogService}</div>
                )}
              </>
            ) : (
              <div className="text-gray-400">Loading logs...</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 