/**
 * Utility functions for type-safe error handling
 */

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error occurred';
}

export function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.stack;
  }
  return undefined;
}

export function isAxiosError(error: unknown): error is { response?: { status?: number; data?: any } } {
  return typeof error === 'object' && error !== null && 'response' in error;
}

export function getAxiosErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    return error.response?.data?.message || getErrorMessage(error);
  }
  return getErrorMessage(error);
} 