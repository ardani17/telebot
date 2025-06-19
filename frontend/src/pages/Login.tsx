import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const loginSchema = z.object({
  telegramId: z.string().min(1, 'Telegram ID is required'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function Login() {
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await login(data.telegramId, data.password);

      if (!result.success && result.error) {
        setError(result.error);
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8'>
      <div className='max-w-md w-full space-y-8'>
        <div>
          <div className='mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-blue-100'>
            <LogIn className='h-6 w-6 text-blue-600' />
          </div>
          <h2 className='mt-6 text-center text-3xl font-extrabold text-gray-900'>TeleWeb Admin</h2>
          <p className='mt-2 text-center text-sm text-gray-600'>
            Login menggunakan Telegram ID dan password
          </p>
        </div>

        <form className='mt-8 space-y-6' onSubmit={handleSubmit(onSubmit)}>
          {error && (
            <div className='rounded-md bg-red-50 p-4'>
              <div className='flex'>
                <div className='ml-3'>
                  <h3 className='text-sm font-medium text-red-800'>Login Error</h3>
                  <div className='mt-2 text-sm text-red-700'>
                    <p>{error}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className='rounded-md shadow-sm -space-y-px'>
            <div>
              <label htmlFor='telegramId' className='sr-only'>
                Telegram ID
              </label>
              <input
                {...register('telegramId')}
                id='telegramId'
                name='telegramId'
                type='text'
                autoComplete='username'
                className='appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm'
                placeholder='Telegram ID'
              />
              {errors.telegramId && (
                <p className='mt-1 text-sm text-red-600'>{errors.telegramId.message}</p>
              )}
            </div>

            <div className='relative'>
              <label htmlFor='password' className='sr-only'>
                Password
              </label>
              <input
                {...register('password')}
                id='password'
                name='password'
                type={showPassword ? 'text' : 'password'}
                autoComplete='current-password'
                className='appearance-none rounded-none relative block w-full px-3 py-2 pr-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm'
                placeholder='Password'
              />
              <button
                type='button'
                className='absolute inset-y-0 right-0 pr-3 flex items-center'
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className='h-4 w-4 text-gray-400' />
                ) : (
                  <Eye className='h-4 w-4 text-gray-400' />
                )}
              </button>
              {errors.password && (
                <p className='mt-1 text-sm text-red-600'>{errors.password.message}</p>
              )}
            </div>
          </div>

          <div>
            <button
              type='submit'
              disabled={isLoading}
              className='group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {isLoading ? (
                <div className='flex items-center'>
                  <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2'></div>
                  Logging in...
                </div>
              ) : (
                <>
                  <LogIn className='h-4 w-4 mr-2' />
                  Login
                </>
              )}
            </button>
          </div>

          <div className='text-center'>
            <p className='text-sm text-gray-600'>
              Belum memiliki akses? Hubungi administrator untuk mendapatkan akun.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
