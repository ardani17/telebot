import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import {
  User,
  Calendar,
  TrendingUp,
  Activity,
  CheckCircle,
  Zap,
  BarChart3,
  Clock,
  Filter,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { api } from '@/lib/api';

interface UserInfo {
  id: string;
  name: string;
  telegramId: string;
  isActive: boolean;
  activityCount?: number;
}

interface UserAnalytics {
  user: UserInfo;
  summary: {
    totalActivities: number;
    successCount: number;
    failureCount: number;
    successRate: number;
    dateRange: {
      from: string;
      to: string;
    };
  };
  featureUsage: Array<{
    mode: string;
    total: number;
    success: number;
    failure: number;
    successRate: number;
  }>;
  actionUsage: Array<{
    action: string;
    count: number;
  }>;
  topFeatures: Array<{
    mode: string;
    total: number;
    success: number;
    failure: number;
    successRate: number;
  }>;
  timeSeriesData: Array<{
    date: string;
    activities: number;
    success: number;
    failure: number;
    byMode: Record<string, number>;
  }>;
  recentActivities: Array<{
    id: string;
    action: string;
    mode: string;
    success: boolean;
    createdAt: string;
    errorMessage?: string;
  }>;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const FEATURE_COLORS: Record<string, string> = {
  ocr: '#3B82F6',
  geotags: '#10B981',
  kml: '#F59E0B',
  archive: '#8B5CF6',
  translate: '#EF4444',
  qr: '#06B6D4',
  default: '#6B7280',
};

export default function UserAnalytics() {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Set default date range (last 30 days)
  useEffect(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    setDateTo(today.toISOString().split('T')[0]);
    setDateFrom(thirtyDaysAgo.toISOString().split('T')[0]);
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/activity/users-for-analytics');
      setUsers(response.data);
      if (response.data.length > 0 && !selectedUserId) {
        setSelectedUserId(response.data[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const fetchUserAnalytics = async () => {
    if (!selectedUserId) return;

    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);

      const response = await api.get(`/activity/user-analytics/${selectedUserId}?${params}`);
      setAnalytics(response.data);
    } catch (error) {
      console.error('Failed to fetch user analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (selectedUserId && dateFrom && dateTo) {
      fetchUserAnalytics();
    }
  }, [selectedUserId, dateFrom, dateTo]);

  const formatModeDisplay = (mode: string) => {
    const modeMap: Record<string, string> = {
      ocr: 'OCR',
      geotags: 'Geotags',
      kml: 'KML',
      archive: 'Archive',
      translate: 'Translate',
      qr: 'QR Code',
    };
    return modeMap[mode] || mode.charAt(0).toUpperCase() + mode.slice(1);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
    });
  };

  const refreshData = () => {
    fetchUserAnalytics();
  };

  return (
    <div className='p-6 space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold text-gray-900'>Analytics Pengguna</h1>
          <p className='text-gray-600 mt-1'>Analisis mendalam penggunaan fitur per pengguna</p>
        </div>
        <button
          onClick={refreshData}
          disabled={!selectedUserId || loading}
          className='flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className='bg-white p-6 rounded-xl shadow-sm border border-gray-200'>
        <div className='flex items-center gap-4 mb-4'>
          <Filter className='h-5 w-5 text-gray-400' />
          <h3 className='text-lg font-semibold text-gray-900'>Filter</h3>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
          <div>
            <label htmlFor='user-select' className='block text-sm font-medium text-gray-700 mb-2'>
              Pilih Pengguna
            </label>
            <select
              id='user-select'
              value={selectedUserId}
              onChange={e => setSelectedUserId(e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            >
              <option value=''>-- Pilih Pengguna --</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.name} (@{user.telegramId}) - {user.activityCount} aktivitas
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor='date-from' className='block text-sm font-medium text-gray-700 mb-2'>
              Dari Tanggal
            </label>
            <input
              id='date-from'
              type='date'
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            />
          </div>

          <div>
            <label htmlFor='date-to' className='block text-sm font-medium text-gray-700 mb-2'>
              Sampai Tanggal
            </label>
            <input
              id='date-to'
              type='date'
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            />
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className='flex items-center justify-center py-12'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600'></div>
        </div>
      )}

      {/* Analytics Content */}
      {analytics && !loading && (
        <>
          {/* User Info & Summary */}
          <div className='grid grid-cols-1 lg:grid-cols-4 gap-6'>
            {/* User Info Card */}
            <div className='bg-white p-6 rounded-xl shadow-sm border border-gray-200'>
              <div className='flex items-center gap-4'>
                <div className='h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center'>
                  <User className='h-6 w-6 text-blue-600' />
                </div>
                <div>
                  <h3 className='font-semibold text-gray-900'>{analytics.user.name}</h3>
                  <p className='text-sm text-gray-600'>@{analytics.user.telegramId}</p>
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      analytics.user.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {analytics.user.isActive ? 'Aktif' : 'Tidak Aktif'}
                  </span>
                </div>
              </div>
            </div>

            {/* Summary Cards */}
            <div className='bg-white p-6 rounded-xl shadow-sm border border-gray-200'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-sm font-medium text-gray-600'>Total Aktivitas</p>
                  <p className='text-2xl font-bold text-gray-900'>
                    {analytics.summary.totalActivities}
                  </p>
                </div>
                <Activity className='h-8 w-8 text-blue-600' />
              </div>
            </div>

            <div className='bg-white p-6 rounded-xl shadow-sm border border-gray-200'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-sm font-medium text-gray-600'>Tingkat Keberhasilan</p>
                  <p className='text-2xl font-bold text-gray-900'>
                    {analytics.summary.successRate.toFixed(1)}%
                  </p>
                </div>
                <CheckCircle className='h-8 w-8 text-green-600' />
              </div>
            </div>

            <div className='bg-white p-6 rounded-xl shadow-sm border border-gray-200'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-sm font-medium text-gray-600'>Periode</p>
                  <p className='text-sm font-bold text-gray-900'>
                    {formatDate(analytics.summary.dateRange.from)} -{' '}
                    {formatDate(analytics.summary.dateRange.to)}
                  </p>
                </div>
                <Calendar className='h-8 w-8 text-purple-600' />
              </div>
            </div>
          </div>

          {/* Activity Trend Chart */}
          <div className='bg-white p-6 rounded-xl shadow-sm border border-gray-200'>
            <div className='flex items-center justify-between mb-6'>
              <h3 className='text-lg font-semibold text-gray-900'>Tren Aktivitas Pengguna</h3>
              <TrendingUp className='h-5 w-5 text-gray-400' />
            </div>
            <ResponsiveContainer width='100%' height={350}>
              <AreaChart data={analytics.timeSeriesData}>
                <CartesianGrid strokeDasharray='3 3' />
                <XAxis dataKey='date' tickFormatter={formatDate} fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip
                  labelFormatter={label => `Tanggal: ${formatDate(label)}`}
                  formatter={(value, name) => [
                    value,
                    name === 'activities'
                      ? 'Total Aktivitas'
                      : name === 'success'
                        ? 'Berhasil'
                        : 'Gagal',
                  ]}
                />
                <Area
                  type='monotone'
                  dataKey='activities'
                  stroke='#3B82F6'
                  fill='#3B82F6'
                  fillOpacity={0.2}
                  name='activities'
                />
                <Area
                  type='monotone'
                  dataKey='success'
                  stroke='#10B981'
                  fill='#10B981'
                  fillOpacity={0.4}
                  name='success'
                />
                <Area
                  type='monotone'
                  dataKey='failure'
                  stroke='#EF4444'
                  fill='#EF4444'
                  fillOpacity={0.4}
                  name='failure'
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Feature Usage Charts */}
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
            {/* Feature Usage Pie Chart */}
            <div className='bg-white p-6 rounded-xl shadow-sm border border-gray-200'>
              <div className='flex items-center justify-between mb-6'>
                <h3 className='text-lg font-semibold text-gray-900'>Distribusi Penggunaan Fitur</h3>
                <Zap className='h-5 w-5 text-gray-400' />
              </div>
              <ResponsiveContainer width='100%' height={300}>
                <PieChart>
                  <Pie
                    data={analytics.featureUsage}
                    cx='50%'
                    cy='50%'
                    labelLine={false}
                    label={({ mode, total }) => `${formatModeDisplay(mode)} (${total})`}
                    outerRadius={80}
                    fill='#8884d8'
                    dataKey='total'
                  >
                    {analytics.featureUsage.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={FEATURE_COLORS[entry.mode] || COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={value => [value, 'Penggunaan']}
                    labelFormatter={label => formatModeDisplay(label)}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Feature Usage Bar Chart */}
            <div className='bg-white p-6 rounded-xl shadow-sm border border-gray-200'>
              <div className='flex items-center justify-between mb-6'>
                <h3 className='text-lg font-semibold text-gray-900'>Success Rate per Fitur</h3>
                <BarChart3 className='h-5 w-5 text-gray-400' />
              </div>
              <ResponsiveContainer width='100%' height={300}>
                <BarChart data={analytics.featureUsage}>
                  <CartesianGrid strokeDasharray='3 3' />
                  <XAxis dataKey='mode' tickFormatter={formatModeDisplay} fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip
                    formatter={(value, name) => [
                      name === 'successRate' ? `${Number(value).toFixed(1)}%` : value,
                      name === 'successRate'
                        ? 'Success Rate'
                        : name === 'total'
                          ? 'Total'
                          : name === 'success'
                            ? 'Berhasil'
                            : 'Gagal',
                    ]}
                    labelFormatter={label => formatModeDisplay(label)}
                  />
                  <Bar dataKey='total' fill='#3B82F6' name='total' />
                  <Bar dataKey='success' fill='#10B981' name='success' />
                  <Bar dataKey='failure' fill='#EF4444' name='failure' />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Features & Recent Activities */}
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
            {/* Top Features */}
            <div className='bg-white p-6 rounded-xl shadow-sm border border-gray-200'>
              <div className='flex items-center justify-between mb-6'>
                <h3 className='text-lg font-semibold text-gray-900'>
                  Fitur Paling Sering Digunakan
                </h3>
                <TrendingUp className='h-5 w-5 text-gray-400' />
              </div>
              <div className='space-y-4'>
                {analytics.topFeatures.map((feature, index) => (
                  <div
                    key={feature.mode}
                    className='flex items-center justify-between p-3 bg-gray-50 rounded-lg'
                  >
                    <div className='flex items-center gap-3'>
                      <div className='h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-600'>
                        {index + 1}
                      </div>
                      <div>
                        <p className='font-medium text-gray-900'>
                          {formatModeDisplay(feature.mode)}
                        </p>
                        <p className='text-sm text-gray-600'>{feature.total} penggunaan</p>
                      </div>
                    </div>
                    <div className='text-right'>
                      <p className='text-sm font-medium text-green-600'>
                        {feature.successRate.toFixed(1)}%
                      </p>
                      <p className='text-xs text-gray-500'>success rate</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Activities */}
            <div className='bg-white p-6 rounded-xl shadow-sm border border-gray-200'>
              <div className='flex items-center justify-between mb-6'>
                <h3 className='text-lg font-semibold text-gray-900'>Aktivitas Terbaru</h3>
                <Clock className='h-5 w-5 text-gray-400' />
              </div>
              <div className='space-y-3'>
                {analytics.recentActivities.map(activity => (
                  <div
                    key={activity.id}
                    className='flex items-start gap-3 p-3 bg-gray-50 rounded-lg'
                  >
                    <div
                      className={`h-2 w-2 rounded-full mt-2 ${
                        activity.success ? 'bg-green-500' : 'bg-red-500'
                      }`}
                    />
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-center justify-between mb-1'>
                        <p className='text-sm font-medium text-gray-900'>
                          {formatModeDisplay(activity.mode)} - {activity.action}
                        </p>
                        <span className='text-xs text-gray-500'>
                          {new Date(activity.createdAt).toLocaleDateString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      {!activity.success && activity.errorMessage && (
                        <p className='text-xs text-red-600'>{activity.errorMessage}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* No User Selected */}
      {!selectedUserId && !loading && (
        <div className='bg-white p-12 rounded-xl shadow-sm border border-gray-200 text-center'>
          <User className='h-12 w-12 text-gray-400 mx-auto mb-4' />
          <h3 className='text-lg font-semibold text-gray-900 mb-2'>Pilih Pengguna</h3>
          <p className='text-gray-600'>
            Pilih pengguna dari dropdown di atas untuk melihat analytics
          </p>
        </div>
      )}

      {/* No Data */}
      {analytics && analytics.summary.totalActivities === 0 && !loading && (
        <div className='bg-white p-12 rounded-xl shadow-sm border border-gray-200 text-center'>
          <AlertTriangle className='h-12 w-12 text-yellow-400 mx-auto mb-4' />
          <h3 className='text-lg font-semibold text-gray-900 mb-2'>Tidak Ada Data</h3>
          <p className='text-gray-600'>
            Pengguna ini tidak memiliki aktivitas dalam rentang tanggal yang dipilih
          </p>
        </div>
      )}
    </div>
  );
}
