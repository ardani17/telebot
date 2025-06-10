import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Users, Files, Activity, Settings, LogOut, Menu, X, Sliders } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface LayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Users', href: '/users', icon: Users },
  { name: 'Features', href: '/features', icon: Sliders },
  { name: 'Files', href: '/files', icon: Files },
  { name: 'Activities', href: '/activities', icon: Activity },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { logout, user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  return (
    <div className='min-h-screen bg-gray-50'>
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div
          className='fixed inset-0 bg-gray-600 bg-opacity-75'
          onClick={() => setSidebarOpen(false)}
        />
        <div className='fixed inset-y-0 left-0 flex w-64 flex-col bg-white'>
          <div className='flex h-16 items-center justify-between px-4'>
            <h1 className='text-xl font-bold text-gray-900'>TeleWeb Admin</h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className='text-gray-400 hover:text-gray-600'
            >
              <X className='h-6 w-6' />
            </button>
          </div>
          <nav className='flex-1 space-y-1 p-4'>
            {navigation.map(item => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                    isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <item.icon className='mr-3 h-5 w-5' />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className='hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col'>
        <div className='flex grow flex-col gap-y-5 overflow-y-auto bg-white px-6 pb-4'>
          <div className='flex h-16 shrink-0 items-center'>
            <h1 className='text-xl font-bold text-gray-900'>TeleWeb Admin</h1>
          </div>
          <nav className='flex flex-1 flex-col'>
            <ul className='flex flex-1 flex-col gap-y-7'>
              <li>
                <ul className='-mx-2 space-y-1'>
                  {navigation.map(item => {
                    const isActive = location.pathname === item.href;
                    return (
                      <li key={item.name}>
                        <Link
                          to={item.href}
                          className={`group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold ${
                            isActive
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-gray-700 hover:text-blue-700 hover:bg-blue-50'
                          }`}
                        >
                          <item.icon className='h-6 w-6 shrink-0' />
                          {item.name}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>
              <li className='mt-auto'>
                <div className='border-t border-gray-200 pt-4'>
                  <div className='flex items-center gap-x-4 px-2 py-3 text-sm font-semibold text-gray-900'>
                    <div className='h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white'>
                      {user?.name?.charAt(0).toUpperCase() || 'A'}
                    </div>
                    <span className='sr-only'>Your profile</span>
                    <span aria-hidden='true'>{user?.name || 'Admin'}</span>
                  </div>
                  <button
                    onClick={logout}
                    className='group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold text-gray-700 hover:text-red-600 hover:bg-red-50 w-full'
                  >
                    <LogOut className='h-6 w-6 shrink-0' />
                    Logout
                  </button>
                </div>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className='lg:pl-64'>
        {/* Top bar */}
        <div className='sticky top-0 z-40 lg:mx-auto lg:max-w-7xl lg:px-8'>
          <div className='flex h-16 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-0 lg:shadow-none'>
            <button
              type='button'
              className='-m-2.5 p-2.5 text-gray-700 lg:hidden'
              onClick={() => setSidebarOpen(true)}
            >
              <span className='sr-only'>Open sidebar</span>
              <Menu className='h-6 w-6' />
            </button>

            <div className='flex flex-1 gap-x-4 self-stretch lg:gap-x-6'>
              <div className='flex items-center gap-x-4 lg:gap-x-6'>
                <div className='hidden lg:block lg:h-6 lg:w-px lg:bg-gray-200' />
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className='py-10'>
          <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>{children}</div>
        </main>
      </div>
    </div>
  );
}
