import { useState, useEffect } from 'react';
import { Activity, Clock, User, FileText } from 'lucide-react';

interface ActivityItem {
  id: string;
  type: 'file_upload' | 'user_login' | 'settings_change' | 'file_delete';
  description: string;
  timestamp: string;
  user: string;
}

export default function Activities() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulated activities data - nanti ganti dengan API call
    const simulatedActivities: ActivityItem[] = [
      {
        id: '1',
        type: 'file_upload',
        description: 'File document.pdf uploaded',
        timestamp: new Date().toISOString(),
        user: 'Admin',
      },
      {
        id: '2',
        type: 'user_login',
        description: 'User logged in successfully',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        user: 'User123',
      },
    ];

    setTimeout(() => {
      setActivities(simulatedActivities);
      setLoading(false);
    }, 1000);
  }, []);

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'file_upload':
      case 'file_delete':
        return <FileText className='w-4 h-4' />;
      case 'user_login':
        return <User className='w-4 h-4' />;
      case 'settings_change':
        return <Activity className='w-4 h-4' />;
      default:
        return <Activity className='w-4 h-4' />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('id-ID');
  };

  if (loading) {
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
    <div className='p-6'>
      <div className='flex items-center gap-3 mb-6'>
        <Activity className='w-8 h-8 text-blue-600' />
        <h1 className='text-3xl font-bold text-gray-900'>Activities</h1>
      </div>

      <div className='bg-white rounded-lg shadow-sm border'>
        <div className='p-4 border-b'>
          <h2 className='text-lg font-semibold text-gray-900'>Recent Activities</h2>
          <p className='text-sm text-gray-600'>Monitor sistem dan user activities</p>
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
                <div className='flex items-start gap-3'>
                  <div className='flex-shrink-0 p-2 bg-blue-100 rounded-lg text-blue-600'>
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center justify-between'>
                      <h3 className='text-sm font-medium text-gray-900 truncate'>
                        {activity.description}
                      </h3>
                      <div className='flex items-center gap-1 text-xs text-gray-500'>
                        <Clock className='w-3 h-3' />
                        {formatTimestamp(activity.timestamp)}
                      </div>
                    </div>
                    <p className='text-xs text-gray-600 mt-1'>
                      By: <span className='font-medium'>{activity.user}</span>
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className='mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg'>
        <div className='flex items-center gap-2'>
          <Activity className='w-5 h-5 text-yellow-600' />
          <h3 className='text-sm font-medium text-yellow-800'>Coming Soon</h3>
        </div>
        <p className='text-xs text-yellow-700 mt-1'>
          Fitur Activities masih dalam pengembangan. Saat ini menampilkan data simulasi.
        </p>
      </div>
    </div>
  );
}
