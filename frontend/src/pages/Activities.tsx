import { useState, useEffect } from 'react';
import {
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  Filter,
  TrendingUp,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { api } from '@/lib/api';

interface ActivityItem {
  id: string;
  userId: string;
  telegramId: string;
  action: string;
  mode?: string;
  details?: any;
  success: boolean;
  errorMessage?: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    telegramId: string;
  };
}

interface ActivityStats {
  total: number;
  today: number;
  yesterday: number;
  lastWeek: number;
  lastMonth: number;
  successRate: number;
  failureRate: number;
  byMode: Array<{ mode: string; count: number }>;
  recentErrors: any[];
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function Activities() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    success: '',
    mode: '',
    dateFrom: '',
    dateTo: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });

      if (filters.success) params.append('success', filters.success);
      if (filters.mode) params.append('mode', filters.mode);
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);

      const response = await api.get(`/activity/list?${params}`);
      setActivities(response.data.data);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Failed to fetch activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/activity/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch activity stats:', error);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, [page, filters]);

  useEffect(() => {
    fetchStats();
  }, []);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Baru saja';
    if (diffInMinutes < 60) return `${diffInMinutes} menit yang lalu`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} jam yang lalu`;
    return date.toLocaleString('id-ID');
  };

  const handleRefresh = () => {
    fetchActivities();
    fetchStats();
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const resetFilters = () => {
    setFilters({
      success: '',
      mode: '',
      dateFrom: '',
      dateTo: '',
    });
    setPage(1);
  };

  if (loading && !activities.length) {
    return (
      <div className='p-6'>
        <div className='animate-pulse'>
          <div className='h-8 bg-gray-200 rounded w-1/4 mb-6'></div>
          <div className='space-y-4'>
            {[...Array(5)].map((_, i) => (
              <div key={i} className='h-16 bg-gray-200 rounded'></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div>
        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
          <div className='flex items-center gap-3'>
            <Activity className='w-8 h-8 text-blue-600 flex-shrink-0' />
            <div>
              <h1 className='text-2xl font-bold text-gray-900'>Activities</h1>
              <p className='text-sm text-gray-600'>Monitor sistem dan user activities</p>
            </div>
          </div>
          <div className='flex flex-col sm:flex-row items-stretch sm:items-center gap-2'>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className='flex items-center justify-center gap-2 px-4 py-2 text-gray-700 bg-white border rounded-md hover:bg-gray-50'
            >
              <Filter className='w-4 h-4' />
              <span className='hidden sm:inline'>Filter</span>
            </button>
            <button
              onClick={handleRefresh}
              className='flex items-center justify-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700'
            >
              <RefreshCw className='w-4 h-4' />
              <span className='hidden sm:inline'>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Statistics - Mobile Responsive */}
      {stats && (
        <div className='grid grid-cols-2 lg:grid-cols-4 gap-4'>
          <div className='bg-white p-4 rounded-lg shadow border'>
            <div className='flex items-center justify-between'>
              <div className='min-w-0 flex-1'>
                <p className='text-sm text-gray-600 truncate'>Total Aktivitas</p>
                <p className='text-xl font-bold'>{stats.total.toLocaleString()}</p>
              </div>
              <Activity className='w-6 h-6 text-blue-500 flex-shrink-0' />
            </div>
          </div>
          <div className='bg-white p-4 rounded-lg shadow border'>
            <div className='flex items-center justify-between'>
              <div className='min-w-0 flex-1'>
                <p className='text-sm text-gray-600 truncate'>Hari Ini</p>
                <p className='text-xl font-bold'>{stats.today}</p>
              </div>
              <TrendingUp className='w-6 h-6 text-green-500 flex-shrink-0' />
            </div>
          </div>
          <div className='bg-white p-4 rounded-lg shadow border'>
            <div className='flex items-center justify-between'>
              <div className='min-w-0 flex-1'>
                <p className='text-sm text-gray-600 truncate'>Tingkat Sukses</p>
                <p className='text-xl font-bold'>{stats.successRate.toFixed(1)}%</p>
              </div>
              <CheckCircle className='w-6 h-6 text-green-500 flex-shrink-0' />
            </div>
          </div>
          <div className='bg-white p-4 rounded-lg shadow border'>
            <div className='flex items-center justify-between'>
              <div className='min-w-0 flex-1'>
                <p className='text-sm text-gray-600 truncate'>Tingkat Gagal</p>
                <p className='text-xl font-bold'>{stats.failureRate.toFixed(1)}%</p>
              </div>
              <XCircle className='w-6 h-6 text-red-500 flex-shrink-0' />
            </div>
          </div>
        </div>
      )}

      {/* Filters - Mobile Responsive */}
      {showFilters && (
        <div className='bg-white p-4 rounded-lg shadow border'>
          <h3 className='text-md font-medium text-gray-900 mb-4'>Filter Activities</h3>
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
            <div>
              <label
                htmlFor='filter-status'
                className='block text-sm font-medium text-gray-700 mb-1'
              >
                Status
              </label>
              <select
                id='filter-status'
                value={filters.success}
                onChange={e => handleFilterChange('success', e.target.value)}
                className='w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
              >
                <option value=''>Semua</option>
                <option value='true'>Sukses</option>
                <option value='false'>Gagal</option>
              </select>
            </div>
            <div>
              <label htmlFor='filter-mode' className='block text-sm font-medium text-gray-700 mb-1'>
                Mode
              </label>
              <select
                id='filter-mode'
                value={filters.mode}
                onChange={e => handleFilterChange('mode', e.target.value)}
                className='w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
              >
                <option value=''>Semua</option>
                <option value='ocr'>OCR</option>
                <option value='archive'>Archive</option>
                <option value='location'>Location</option>
                <option value='geotags'>Geotags</option>
                <option value='kml'>KML</option>
                <option value='workbook'>Workbook</option>
              </select>
            </div>
            <div>
              <label
                htmlFor='filter-date-from'
                className='block text-sm font-medium text-gray-700 mb-1'
              >
                Dari Tanggal
              </label>
              <input
                id='filter-date-from'
                type='date'
                value={filters.dateFrom}
                onChange={e => handleFilterChange('dateFrom', e.target.value)}
                className='w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
              />
            </div>
            <div>
              <label
                htmlFor='filter-date-to'
                className='block text-sm font-medium text-gray-700 mb-1'
              >
                Sampai Tanggal
              </label>
              <input
                id='filter-date-to'
                type='date'
                value={filters.dateTo}
                onChange={e => handleFilterChange('dateTo', e.target.value)}
                className='w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
              />
            </div>
          </div>
          <div className='mt-4 flex justify-end'>
            <button
              onClick={resetFilters}
              className='px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300'
            >
              Reset Filter
            </button>
          </div>
        </div>
      )}

      {/* Activities List - Enhanced Mobile Design */}
      <div className='bg-white rounded-lg shadow border'>
        <div className='p-4 border-b'>
          <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2'>
            <div>
              <h2 className='text-lg font-semibold text-gray-900'>Recent Activities</h2>
              <p className='text-sm text-gray-600'>Monitor sistem dan user activities</p>
            </div>
            {pagination && (
              <div className='text-sm text-gray-500'>
                {activities.length} of {pagination.total} activities
              </div>
            )}
          </div>
        </div>

        <div className='divide-y'>
          {activities.length === 0 ? (
            <div className='p-8 text-center text-gray-500'>
              <Activity className='w-12 h-12 mx-auto mb-4 text-gray-300' />
              <p>Belum ada aktivitas tersedia</p>
            </div>
          ) : (
            activities.map(activity => (
              <div key={activity.id} className='p-4 hover:bg-gray-50 transition-colors'>
                <div className='flex flex-col sm:flex-row sm:items-start gap-3'>
                  <div
                    className={`flex-shrink-0 p-2 rounded-lg ${
                      activity.success ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                    }`}
                  >
                    {activity.success ? (
                      <CheckCircle className='w-4 h-4' />
                    ) : (
                      <XCircle className='w-4 h-4' />
                    )}
                  </div>

                  <div className='flex-1 min-w-0'>
                    <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2'>
                      <div className='flex flex-col sm:flex-row sm:items-center gap-2'>
                        <h3 className='text-sm font-medium text-gray-900 truncate'>
                          {activity.action}
                        </h3>
                        {activity.mode && (
                          <span className='inline-flex px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full'>
                            {activity.mode}
                          </span>
                        )}
                      </div>
                      <div className='flex items-center gap-1 text-xs text-gray-500 flex-shrink-0'>
                        <Clock className='w-3 h-3' />
                        {formatTimestamp(activity.createdAt)}
                      </div>
                    </div>

                    <p className='text-sm text-gray-600 mt-1'>
                      By: <span className='font-medium'>{activity.user.name}</span> (
                      {activity.user.telegramId})
                    </p>

                    {activity.errorMessage && (
                      <div className='mt-2 flex items-start gap-2 p-2 bg-red-50 rounded border border-red-200'>
                        <AlertCircle className='w-4 h-4 text-red-500 flex-shrink-0 mt-0.5' />
                        <p className='text-sm text-red-700'>{activity.errorMessage}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination - Mobile Responsive */}
        {pagination && pagination.totalPages > 1 && (
          <div className='px-4 py-3 border-t bg-gray-50'>
            <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
              <div className='text-sm text-gray-700 text-center sm:text-left'>
                Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} activities
              </div>
              <div className='flex items-center justify-center gap-2'>
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className='px-3 py-1 text-sm border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50'
                >
                  Previous
                </button>
                <span className='px-3 py-1 text-sm font-medium'>
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page === pagination.totalPages}
                  className='px-3 py-1 text-sm border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50'
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* By Mode Statistics - Mobile Responsive */}
      {stats && stats.byMode.length > 0 && (
        <div className='bg-white rounded-lg shadow border p-4'>
          <h3 className='text-lg font-semibold mb-4'>Aktivitas per Mode</h3>
          <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4'>
            {stats.byMode.map(item => (
              <div key={item.mode || 'unknown'} className='text-center p-3 bg-gray-50 rounded-lg'>
                <p className='text-xl font-bold text-blue-600'>{item.count}</p>
                <p className='text-sm text-gray-600 capitalize truncate'>
                  {item.mode || 'Unknown'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
