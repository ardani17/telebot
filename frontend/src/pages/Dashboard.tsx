import { useEffect, useState } from 'react';
import {
  Users,
  Activity,
  TrendingUp,
  Bot,
  Server,
  Database,
  Clock,
  RefreshCw,
  Play,
  Square,
  Monitor,
  Cpu,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  botActivities: number;
  todayActivities: number;
  userGrowthPercentage: number;
  activityGrowthPercentage: number;
  systemStatus: {
    database: 'healthy' | 'warning' | 'error';
    bot: 'healthy' | 'warning' | 'error';
    storage: {
      used: number;
      total: number;
      percentage: number;
    };
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: {
      usage: number;
      cores: number;
      loadAverage: number[];
    };
  };
}

interface RecentActivity {
  id: string;
  type: string;
  user: string;
  description: string;
  timestamp: string;
}

interface SystemLogs {
  backend: string[];
  frontend: string[];
  bot: string[];
  timestamp: string;
}

interface SystemStatus {
  database: string;
  bot: string;
  storage: {
    used: number;
    total: number;
    percentage: number;
  };
  processes: {
    backend: string;
    frontend: string;
    bot: string;
  };
  uptime: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  timestamp: string;
}

interface SystemMetrics {
  memory: {
    used: number;
    total: number;
    percentage: number;
    usedGB: string;
    totalGB: string;
  };
  cpu: {
    usage: number;
    cores: number;
    loadAverage: number[];
    load1m: number;
    load5m: number;
    load15m: number;
  };
  timestamp: string;
}

export function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [systemLogs, setSystemLogs] = useState<SystemLogs | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLogService, setSelectedLogService] = useState<string>('all');
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        // Fetch dashboard stats
        const statsResponse = await api.get('/dashboard/stats');
        setStats(statsResponse.data);

        // Fetch recent activities
        const activitiesResponse = await api.get('/dashboard/activities?limit=10');
        setRecentActivities(activitiesResponse.data);

        // Fetch system status
        const statusResponse = await api.get('/dashboard/system-status');
        setSystemStatus(statusResponse.data);

        // Fetch system metrics
        const metricsResponse = await api.get('/dashboard/system-metrics');
        setSystemMetrics(metricsResponse.data);

        // Fetch logs
        await fetchLogs();
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const fetchLogs = async () => {
    try {
      const logsResponse = await api.get(`/dashboard/logs?service=${selectedLogService}&lines=20`);
      setSystemLogs(logsResponse.data);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    }
  };

  const refreshData = async () => {
    try {
      const [statsRes, statusRes, metricsRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/dashboard/system-status'),
        api.get('/dashboard/system-metrics'),
      ]);

      setStats(statsRes.data);
      setSystemStatus(statusRes.data);
      setSystemMetrics(metricsRes.data);
      await fetchLogs();
    } catch (err) {
      console.error('Failed to refresh data:', err);
    }
  };

  // Auto refresh every 10 seconds when enabled
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(refreshData, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, selectedLogService]);

  // Refresh logs when service selection changes
  useEffect(() => {
    if (systemLogs) {
      fetchLogs();
    }
  }, [selectedLogService]);

  if (loading) {
    return (
      <div className='flex items-center justify-center min-h-96'>
        <div className='animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600'></div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className='rounded-md bg-red-50 p-4'>
        <div className='flex'>
          <div className='ml-3'>
            <h3 className='text-sm font-medium text-red-800'>Error</h3>
            <div className='mt-2 text-sm text-red-700'>
              <p>{error || 'Failed to load dashboard data'}</p>
            </div>
          </div>
        </div>
      </div>
    );
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
      changeType: stats.userGrowthPercentage >= 0 ? ('increase' as const) : ('decrease' as const),
    },
    {
      name: 'Bot Activities',
      stat: stats.botActivities,
      substat: `${stats.todayActivities} today`,
      icon: Activity,
      change: formatPercentageChange(stats.activityGrowthPercentage),
      changeType:
        stats.activityGrowthPercentage >= 0 ? ('increase' as const) : ('decrease' as const),
    },
    {
      name: 'Storage Usage',
      stat: `${stats.systemStatus.storage.percentage}%`,
      substat: `${(stats.systemStatus.storage.used / 1024 / 1024 / 1024).toFixed(1)}GB of ${(stats.systemStatus.storage.total / 1024 / 1024 / 1024).toFixed(1)}GB`,
      icon: Database,
      change: stats.systemStatus.storage.percentage > 80 ? 'High Usage' : 'Normal Usage',
      changeType: stats.systemStatus.storage.percentage > 80 ? 'decrease' : ('increase' as const),
    },
    {
      name: 'RAM Usage',
      stat: `${stats.systemStatus.memory.percentage}%`,
      substat: `${(stats.systemStatus.memory.used / 1024 / 1024 / 1024).toFixed(1)}GB of ${(stats.systemStatus.memory.total / 1024 / 1024 / 1024).toFixed(1)}GB`,
      icon: Monitor,
      change: stats.systemStatus.memory.percentage > 80 ? 'High Usage' : 'Normal Usage',
      changeType: stats.systemStatus.memory.percentage > 80 ? 'decrease' : ('increase' as const),
    },
    {
      name: 'CPU Usage',
      stat: `${stats.systemStatus.cpu.usage.toFixed(1)}%`,
      substat: `${stats.systemStatus.cpu.cores} cores`,
      icon: Cpu,
      change: stats.systemStatus.cpu.usage > 80 ? 'High Load' : 'Normal Load',
      changeType: stats.systemStatus.cpu.usage > 80 ? 'decrease' : ('increase' as const),
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-100';
      case 'warning':
        return 'text-yellow-600 bg-yellow-100';
      case 'error':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const formatRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  return (
    <div className='space-y-6'>
      {/* Welcome Header */}
      <div>
        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
          <div>
            <h1 className='text-2xl font-bold text-gray-900'>
              Welcome back, {user?.name || 'Admin'}!
            </h1>
            <p className='mt-1 text-sm text-gray-600'>
              Here&apos;s what&apos;s happening with your TeleWeb system today.
            </p>
          </div>
          <div className='flex items-center space-x-3'>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center px-3 py-2 text-sm rounded-md ${
                autoRefresh
                  ? 'bg-green-100 text-green-700 border border-green-300'
                  : 'bg-gray-100 text-gray-700 border border-gray-300'
              }`}
            >
              {autoRefresh ? (
                <Square className='h-4 w-4 mr-1' />
              ) : (
                <Play className='h-4 w-4 mr-1' />
              )}
              {autoRefresh ? 'Auto Refresh' : 'Manual'}
            </button>
            <button
              onClick={refreshData}
              className='flex items-center px-3 py-2 text-sm bg-blue-100 text-blue-700 border border-blue-300 rounded-md hover:bg-blue-200'
            >
              <RefreshCw className='h-4 w-4 mr-1' />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid - Mobile Responsive */}
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4'>
        {statCards.map(item => (
          <div
            key={item.name}
            className='relative bg-white p-4 shadow rounded-lg border overflow-hidden'
          >
            <div className='flex items-center'>
              <div className='flex-shrink-0 p-2 bg-blue-500 rounded-md'>
                <item.icon className='h-5 w-5 text-white' aria-hidden='true' />
              </div>
              <div className='ml-3 min-w-0 flex-1'>
                <p className='text-sm font-medium text-gray-500 truncate'>{item.name}</p>
                <p className='text-lg font-semibold text-gray-900'>{item.stat}</p>
              </div>
            </div>
            <div className='mt-3'>
              <div className='flex items-center justify-between'>
                <p className='text-xs text-gray-600'>{item.substat}</p>
                <div className='flex items-center text-xs text-green-600'>
                  <TrendingUp className='h-3 w-3 mr-1' />
                  <span>{item.change}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* System Status - Mobile Cards */}
      <div>
        <h2 className='text-lg font-medium text-gray-900 mb-4'>System Status</h2>
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
          <div className='bg-white p-4 shadow rounded-lg border'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center'>
                <Database className='h-6 w-6 text-gray-400 flex-shrink-0' />
                <div className='ml-3'>
                  <p className='text-sm font-medium text-gray-900'>Database</p>
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-medium rounded-full mt-1 ${getStatusColor(stats.systemStatus.database)}`}
                  >
                    {stats.systemStatus.database}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className='bg-white p-4 shadow rounded-lg border'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center'>
                <Bot className='h-6 w-6 text-gray-400 flex-shrink-0' />
                <div className='ml-3'>
                  <p className='text-sm font-medium text-gray-900'>Bot Service</p>
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-medium rounded-full mt-1 ${getStatusColor(stats.systemStatus.bot)}`}
                  >
                    {stats.systemStatus.bot}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className='bg-white p-4 shadow rounded-lg border sm:col-span-2 lg:col-span-1'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center'>
                <Server className='h-6 w-6 text-gray-400 flex-shrink-0' />
                <div className='ml-3'>
                  <p className='text-sm font-medium text-gray-900'>API Server</p>
                  <span className='inline-flex px-2 py-1 text-xs font-medium rounded-full text-green-600 bg-green-100 mt-1'>
                    healthy
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time System Metrics */}
      {systemMetrics && (
        <div>
          <h2 className='text-lg font-medium text-gray-900 mb-4'>Real-time System Metrics</h2>
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
            {/* Memory Usage Chart */}
            <div className='bg-white p-6 shadow rounded-lg border'>
              <div className='flex items-center justify-between mb-4'>
                <div className='flex items-center'>
                  <Monitor className='h-5 w-5 text-blue-500 mr-2' />
                  <h3 className='text-sm font-medium text-gray-900'>Memory Usage</h3>
                </div>
                <span className='text-sm text-gray-500'>
                  Last updated: {formatRelativeTime(systemMetrics.timestamp)}
                </span>
              </div>
              <div className='space-y-3'>
                <div className='flex justify-between items-center'>
                  <span className='text-2xl font-bold text-gray-900'>
                    {systemMetrics.memory.percentage}%
                  </span>
                  <span className='text-sm text-gray-600'>
                    {systemMetrics.memory.usedGB}GB / {systemMetrics.memory.totalGB}GB
                  </span>
                </div>
                <div className='w-full bg-gray-200 rounded-full h-3'>
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ${
                      systemMetrics.memory.percentage > 80
                        ? 'bg-red-500'
                        : systemMetrics.memory.percentage > 60
                          ? 'bg-yellow-500'
                          : 'bg-blue-500'
                    }`}
                    style={{ width: `${Math.min(systemMetrics.memory.percentage, 100)}%` }}
                  ></div>
                </div>
                <div className='text-xs text-gray-500'>
                  {systemMetrics.memory.percentage > 80
                    ? '⚠️ High memory usage detected'
                    : systemMetrics.memory.percentage > 60
                      ? '⚡ Moderate memory usage'
                      : '✅ Memory usage is normal'}
                </div>
              </div>
            </div>

            {/* CPU Usage Chart */}
            <div className='bg-white p-6 shadow rounded-lg border'>
              <div className='flex items-center justify-between mb-4'>
                <div className='flex items-center'>
                  <Cpu className='h-5 w-5 text-green-500 mr-2' />
                  <h3 className='text-sm font-medium text-gray-900'>CPU Usage</h3>
                </div>
                <span className='text-sm text-gray-500'>{systemMetrics.cpu.cores} cores</span>
              </div>
              <div className='space-y-3'>
                <div className='flex justify-between items-center'>
                  <span className='text-2xl font-bold text-gray-900'>
                    {systemMetrics.cpu.usage.toFixed(1)}%
                  </span>
                  <span className='text-sm text-gray-600'>
                    Load: {systemMetrics.cpu.load1m.toFixed(2)}
                  </span>
                </div>
                <div className='w-full bg-gray-200 rounded-full h-3'>
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ${
                      systemMetrics.cpu.usage > 80
                        ? 'bg-red-500'
                        : systemMetrics.cpu.usage > 60
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(systemMetrics.cpu.usage, 100)}%` }}
                  ></div>
                </div>
                <div className='grid grid-cols-3 gap-2 text-xs text-gray-600'>
                  <div>1m: {systemMetrics.cpu.load1m.toFixed(2)}</div>
                  <div>5m: {systemMetrics.cpu.load5m.toFixed(2)}</div>
                  <div>15m: {systemMetrics.cpu.load15m.toFixed(2)}</div>
                </div>
                <div className='text-xs text-gray-500'>
                  {systemMetrics.cpu.usage > 80
                    ? '⚠️ High CPU usage detected'
                    : systemMetrics.cpu.usage > 60
                      ? '⚡ Moderate CPU usage'
                      : '✅ CPU usage is normal'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Activities - Mobile Responsive */}
      <div>
        <h2 className='text-lg font-medium text-gray-900 mb-4'>Recent Activities</h2>
        <div className='bg-white shadow rounded-lg border overflow-hidden'>
          {recentActivities.length > 0 ? (
            <ul className='divide-y divide-gray-200'>
              {recentActivities.map(activity => (
                <li key={activity.id} className='p-4'>
                  <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2'>
                    <div className='flex items-start space-x-3 min-w-0 flex-1'>
                      <div className='flex-shrink-0 p-1 bg-blue-100 rounded'>
                        <Activity className='h-4 w-4 text-blue-600' />
                      </div>
                      <div className='min-w-0 flex-1'>
                        <div className='flex flex-col sm:flex-row sm:items-center gap-1'>
                          <p className='text-sm font-medium text-blue-600 truncate'>
                            {activity.type}
                          </p>
                          <p className='text-sm text-gray-500'>by {activity.user}</p>
                        </div>
                        <p className='text-sm text-gray-600 mt-1'>{activity.description}</p>
                      </div>
                    </div>
                    <div className='flex items-center text-xs text-gray-500 flex-shrink-0'>
                      <Clock className='h-3 w-3 mr-1' />
                      {formatRelativeTime(activity.timestamp)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className='p-8 text-center text-gray-500'>
              <Activity className='mx-auto h-12 w-12 text-gray-300 mb-2' />
              <p>No recent activities</p>
            </div>
          )}
        </div>
      </div>

      {/* System Logs - Mobile Responsive */}
      <div>
        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4'>
          <h2 className='text-lg font-medium text-gray-900'>System Logs</h2>
          <div className='flex flex-col sm:flex-row items-stretch sm:items-center gap-2'>
            <select
              value={selectedLogService}
              onChange={e => setSelectedLogService(e.target.value)}
              className='text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              <option value='all'>All Services</option>
              <option value='backend'>Backend</option>
              <option value='frontend'>Frontend</option>
              <option value='bot'>Bot</option>
            </select>

            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center justify-center px-3 py-2 text-sm rounded-md whitespace-nowrap ${
                autoRefresh
                  ? 'bg-green-100 text-green-700 border border-green-300'
                  : 'bg-gray-100 text-gray-700 border border-gray-300'
              }`}
            >
              {autoRefresh ? (
                <Square className='h-4 w-4 sm:mr-1' />
              ) : (
                <Play className='h-4 w-4 sm:mr-1' />
              )}
              <span className='hidden sm:inline'>{autoRefresh ? 'Stop' : 'Auto Refresh'}</span>
            </button>

            <button
              onClick={refreshData}
              className='flex items-center justify-center px-3 py-2 text-sm bg-blue-100 text-blue-700 border border-blue-300 rounded-md hover:bg-blue-200 whitespace-nowrap'
            >
              <RefreshCw className='h-4 w-4 sm:mr-1' />
              <span className='hidden sm:inline'>Refresh</span>
            </button>
          </div>
        </div>

        {/* Process Status - Mobile Grid */}
        {systemStatus && (
          <div className='mb-4'>
            <h3 className='text-md font-medium text-gray-900 mb-2'>Process Status</h3>
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'>
              <div className='bg-white p-3 border rounded-lg'>
                <div className='flex items-center justify-between'>
                  <span className='text-sm font-medium text-gray-700'>Backend</span>
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      systemStatus.processes.backend === 'running'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {systemStatus.processes.backend}
                  </span>
                </div>
              </div>
              <div className='bg-white p-3 border rounded-lg'>
                <div className='flex items-center justify-between'>
                  <span className='text-sm font-medium text-gray-700'>Frontend</span>
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      systemStatus.processes.frontend === 'running'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {systemStatus.processes.frontend}
                  </span>
                </div>
              </div>
              <div className='bg-white p-3 border rounded-lg sm:col-span-2 lg:col-span-1'>
                <div className='flex items-center justify-between'>
                  <span className='text-sm font-medium text-gray-700'>Bot</span>
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      systemStatus.processes.bot === 'running'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {systemStatus.processes.bot}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Logs Display - Mobile Responsive */}
        <div className='bg-gray-900 rounded-lg overflow-hidden'>
          <div className='p-4'>
            <h4 className='text-sm font-medium text-gray-300 mb-2'>Live Logs</h4>
            <div className='bg-black rounded p-3 max-h-64 overflow-y-auto'>
              {systemLogs ? (
                <div className='space-y-1'>
                  {systemLogs.backend.length > 0 && selectedLogService === 'all' && (
                    <div>
                      <div className='text-xs text-blue-400 font-medium mb-1'>[BACKEND]</div>
                      {systemLogs.backend.slice(-5).map((log, index) => (
                        <div key={index} className='text-xs text-green-400 font-mono break-all'>
                          {log}
                        </div>
                      ))}
                    </div>
                  )}
                  {systemLogs.frontend.length > 0 && selectedLogService === 'all' && (
                    <div>
                      <div className='text-xs text-purple-400 font-medium mb-1'>[FRONTEND]</div>
                      {systemLogs.frontend.slice(-5).map((log, index) => (
                        <div key={index} className='text-xs text-yellow-400 font-mono break-all'>
                          {log}
                        </div>
                      ))}
                    </div>
                  )}
                  {systemLogs.bot.length > 0 && selectedLogService === 'all' && (
                    <div>
                      <div className='text-xs text-orange-400 font-medium mb-1'>[BOT]</div>
                      {systemLogs.bot.slice(-5).map((log, index) => (
                        <div key={index} className='text-xs text-cyan-400 font-mono break-all'>
                          {log}
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedLogService === 'backend' &&
                    systemLogs.backend.map((log, index) => (
                      <div key={index} className='text-xs text-green-400 font-mono break-all'>
                        {log}
                      </div>
                    ))}
                  {selectedLogService === 'frontend' &&
                    systemLogs.frontend.map((log, index) => (
                      <div key={index} className='text-xs text-yellow-400 font-mono break-all'>
                        {log}
                      </div>
                    ))}
                  {selectedLogService === 'bot' &&
                    systemLogs.bot.map((log, index) => (
                      <div key={index} className='text-xs text-cyan-400 font-mono break-all'>
                        {log}
                      </div>
                    ))}
                </div>
              ) : (
                <div className='text-xs text-gray-500'>Loading logs...</div>
              )}
            </div>
            <div className='text-xs text-gray-400 mt-2'>
              Last updated:{' '}
              {systemLogs?.timestamp
                ? new Date(systemLogs.timestamp).toLocaleTimeString()
                : 'Never'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
