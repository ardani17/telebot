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
  BarChart3,
  TrendingUp,
  Users,
  Activity,
  AlertTriangle,
  RefreshCw,
  Calendar,
  CheckCircle,
  Zap,
} from 'lucide-react';
import { api } from '@/lib/api';

interface ActivityStats {
  total: number;
  today: number;
  yesterday: number;
  lastWeek: number;
  lastMonth: number;
  successRate: number;
  failureRate: number;
  byMode: Array<{
    mode: string;
    count: number;
  }>;
  recentErrors: Array<{
    id: string;
    action: string;
    errorMessage: string;
    createdAt: string;
    user: {
      name: string;
      telegramId: string;
    };
  }>;
}

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalFiles: number;
  totalActivities: number;
}

interface TimeSeriesData {
  date: string;
  activities: number;
  success: number;
  failure: number;
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

export default function Statistics() {
  const [activityStats, setActivityStats] = useState<ActivityStats | null>(null);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7' | '30' | '90'>('30');

  const fetchActivityStats = async () => {
    try {
      const response = await api.get('/activity/stats');
      setActivityStats(response.data);
    } catch (error) {
      console.error('Failed to fetch activity stats:', error);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      const response = await api.get('/dashboard/stats');
      setDashboardStats(response.data);
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
    }
  };

  const fetchTimeSeriesData = async () => {
    try {
      const response = await api.get(`/activity/time-series?days=${timeRange}`);
      setTimeSeriesData(response.data);
    } catch (error) {
      console.error('Failed to fetch time series data:', error);
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([fetchActivityStats(), fetchDashboardStats(), fetchTimeSeriesData()]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    fetchTimeSeriesData();
  }, [timeRange]);

  const refreshData = () => {
    fetchAllData();
  };

  if (loading) {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600'></div>
      </div>
    );
  }

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

  return (
    <div className='p-4 sm:p-6 space-y-6 overflow-hidden'>
      {/* Header */}
      <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
        <div className='min-w-0 flex-1'>
          <h1 className='text-2xl sm:text-3xl font-bold text-gray-900 break-words'>Statistik Sistem</h1>
          <p className='text-gray-600 mt-1 text-sm sm:text-base break-words'>
            Dashboard analitik penggunaan dan aktivitas pengguna
          </p>
        </div>
        <div className='flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 flex-shrink-0'>
          <select
            value={timeRange}
            onChange={e => setTimeRange(e.target.value as '7' | '30' | '90')}
            className='px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm'
          >
            <option value='7'>7 Hari Terakhir</option>
            <option value='30'>30 Hari Terakhir</option>
            <option value='90'>90 Hari Terakhir</option>
          </select>
          <button
            onClick={refreshData}
            className='flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm'
          >
            <RefreshCw className='h-4 w-4' />
            <span className='hidden sm:inline'>Refresh</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6'>
        <div className='bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200'>
          <div className='flex items-center justify-between'>
            <div className='min-w-0 flex-1'>
              <p className='text-sm font-medium text-gray-600 truncate'>Total Pengguna</p>
              <p className='text-xl sm:text-2xl font-bold text-gray-900'>{dashboardStats?.totalUsers || 0}</p>
            </div>
            <div className='h-10 w-10 sm:h-12 sm:w-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0'>
              <Users className='h-5 w-5 sm:h-6 sm:w-6 text-blue-600' />
            </div>
          </div>
          <div className='mt-3 sm:mt-4 flex items-center'>
            <span className='text-sm text-green-600 font-medium truncate'>
              {dashboardStats?.activeUsers || 0} aktif
            </span>
          </div>
        </div>

        <div className='bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200'>
          <div className='flex items-center justify-between'>
            <div className='min-w-0 flex-1'>
              <p className='text-sm font-medium text-gray-600 truncate'>Total Aktivitas</p>
              <p className='text-xl sm:text-2xl font-bold text-gray-900'>{activityStats?.total || 0}</p>
            </div>
            <div className='h-10 w-10 sm:h-12 sm:w-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0'>
              <Activity className='h-5 w-5 sm:h-6 sm:w-6 text-green-600' />
            </div>
          </div>
          <div className='mt-3 sm:mt-4 flex items-center'>
            <span className='text-sm text-blue-600 font-medium truncate'>
              {activityStats?.today || 0} hari ini
            </span>
          </div>
        </div>

        <div className='bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200'>
          <div className='flex items-center justify-between'>
            <div className='min-w-0 flex-1'>
              <p className='text-sm font-medium text-gray-600 truncate'>Tingkat Keberhasilan</p>
              <p className='text-xl sm:text-2xl font-bold text-gray-900'>
                {activityStats?.successRate?.toFixed(1) || 0}%
              </p>
            </div>
            <div className='h-10 w-10 sm:h-12 sm:w-12 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0'>
              <CheckCircle className='h-5 w-5 sm:h-6 sm:w-6 text-emerald-600' />
            </div>
          </div>
          <div className='mt-3 sm:mt-4 flex items-center'>
            <span className='text-sm text-emerald-600 font-medium truncate'>Sangat baik</span>
          </div>
        </div>

        <div className='bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200'>
          <div className='flex items-center justify-between'>
            <div className='min-w-0 flex-1'>
              <p className='text-sm font-medium text-gray-600 truncate'>Total File</p>
              <p className='text-xl sm:text-2xl font-bold text-gray-900'>{dashboardStats?.totalFiles || 0}</p>
            </div>
            <div className='h-10 w-10 sm:h-12 sm:w-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0'>
              <BarChart3 className='h-5 w-5 sm:h-6 sm:w-6 text-purple-600' />
            </div>
          </div>
          <div className='mt-3 sm:mt-4 flex items-center'>
            <span className='text-sm text-purple-600 font-medium truncate'>Diproses</span>
          </div>
        </div>
      </div>

      {/* Activity Trend Chart */}
      <div className='bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200 overflow-hidden'>
        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 sm:mb-6'>
          <h3 className='text-lg font-semibold text-gray-900 min-w-0 flex-1'>
            <span className='block break-words'>
              Tren Aktivitas ({timeRange} Hari Terakhir)
            </span>
          </h3>
          <TrendingUp className='h-5 w-5 text-gray-400 flex-shrink-0' />
        </div>
        <div className='overflow-x-auto'>
          <ResponsiveContainer width='100%' height={300} minWidth={300}>
            <AreaChart data={timeSeriesData}>
              <CartesianGrid strokeDasharray='3 3' />
              <XAxis dataKey='date' tickFormatter={formatDate} fontSize={10} />
              <YAxis fontSize={10} />
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
      </div>

      {/* Charts Grid */}
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6'>
        {/* Feature Usage Distribution */}
        <div className='bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200 overflow-hidden'>
          <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 sm:mb-6'>
            <h3 className='text-lg font-semibold text-gray-900 min-w-0 flex-1'>
              <span className='block break-words'>Penggunaan Fitur</span>
            </h3>
            <Zap className='h-5 w-5 text-gray-400 flex-shrink-0' />
          </div>
          <div className='overflow-x-auto'>
            <ResponsiveContainer width='100%' height={280} minWidth={250}>
              <PieChart>
                <Pie
                  data={activityStats?.byMode || []}
                  cx='50%'
                  cy='50%'
                  labelLine={false}
                  label={({ mode, percent }) =>
                    `${formatModeDisplay(mode)} ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={70}
                  fill='#8884d8'
                  dataKey='count'
                >
                  {activityStats?.byMode?.map((entry, index) => (
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
        </div>

        {/* Feature Usage Bar Chart */}
        <div className='bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200 overflow-hidden'>
          <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 sm:mb-6'>
            <h3 className='text-lg font-semibold text-gray-900 min-w-0 flex-1'>
              <span className='block break-words'>Detail Penggunaan Fitur</span>
            </h3>
            <BarChart3 className='h-5 w-5 text-gray-400 flex-shrink-0' />
          </div>
          <div className='overflow-x-auto'>
            <ResponsiveContainer width='100%' height={280} minWidth={250}>
              <BarChart data={activityStats?.byMode || []}>
                <CartesianGrid strokeDasharray='3 3' />
                <XAxis dataKey='mode' tickFormatter={formatModeDisplay} fontSize={10} />
                <YAxis fontSize={10} />
                <Tooltip
                  formatter={value => [value, 'Jumlah Penggunaan']}
                  labelFormatter={label => formatModeDisplay(label)}
                />
                <Bar dataKey='count' fill='#3B82F6' radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Activity Comparison */}
      <div className='bg-white p-6 rounded-xl shadow-sm border border-gray-200'>
        <div className='flex items-center justify-between mb-6'>
          <h3 className='text-lg font-semibold text-gray-900'>Perbandingan Aktivitas</h3>
          <Calendar className='h-5 w-5 text-gray-400' />
        </div>
        <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
          <div className='text-center p-4 bg-blue-50 rounded-lg'>
            <p className='text-2xl font-bold text-blue-600'>{activityStats?.today || 0}</p>
            <p className='text-sm text-gray-600'>Hari Ini</p>
          </div>
          <div className='text-center p-4 bg-green-50 rounded-lg'>
            <p className='text-2xl font-bold text-green-600'>{activityStats?.yesterday || 0}</p>
            <p className='text-sm text-gray-600'>Kemarin</p>
          </div>
          <div className='text-center p-4 bg-purple-50 rounded-lg'>
            <p className='text-2xl font-bold text-purple-600'>{activityStats?.lastWeek || 0}</p>
            <p className='text-sm text-gray-600'>7 Hari Lalu</p>
          </div>
          <div className='text-center p-4 bg-orange-50 rounded-lg'>
            <p className='text-2xl font-bold text-orange-600'>{activityStats?.lastMonth || 0}</p>
            <p className='text-sm text-gray-600'>30 Hari Lalu</p>
          </div>
        </div>
      </div>

      {/* Recent Errors */}
      {activityStats?.recentErrors && activityStats.recentErrors.length > 0 && (
        <div className='bg-white p-6 rounded-xl shadow-sm border border-gray-200'>
          <div className='flex items-center justify-between mb-6'>
            <h3 className='text-lg font-semibold text-gray-900'>Error Terbaru</h3>
            <AlertTriangle className='h-5 w-5 text-red-500' />
          </div>
          <div className='space-y-4'>
            {activityStats.recentErrors.map(error => (
              <div
                key={error.id}
                className='flex items-start gap-4 p-4 bg-red-50 rounded-lg border border-red-200'
              >
                <div className='flex-1 min-w-0'>
                  <div className='flex items-center justify-between mb-1'>
                    <p className='text-sm font-medium text-gray-900'>{error.action}</p>
                    <span className='text-xs text-gray-500'>
                      {new Date(error.createdAt).toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className='text-sm text-red-700 mb-2'>{error.errorMessage}</p>
                  <p className='text-xs text-gray-600'>
                    Pengguna: {error.user?.name} (@{error.user?.telegramId})
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
