import axios, { AxiosInstance } from 'axios';
import winston from 'winston';

export interface User {
  id: string;
  telegramId: string;
  name: string;
  username?: string;
  role: 'USER' | 'ADMIN';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Feature {
  id: string;
  name: string;
  description: string;
  isEnabled: boolean;
}

export interface UserFeatureAccess {
  id: string;
  userId: string;
  featureId: string;
  feature: Feature;
  grantedAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export class ApiClient {
  private client: AxiosInstance;
  private logger: winston.Logger;

  constructor(baseURL: string, logger: winston.Logger) {
    this.logger = logger;
    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        this.logger.debug('API Request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          data: config.data,
        });
        return config;
      },
      (error) => {
        this.logger.error('API Request Error', { error: error.message });
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        this.logger.debug('API Response', {
          status: response.status,
          url: response.config.url,
          data: response.data,
        });
        return response;
      },
      (error) => {
        this.logger.error('API Response Error', {
          status: error.response?.status,
          url: error.config?.url,
          message: error.message,
          data: error.response?.data,
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Check if user exists and is active
   */
  async validateUser(telegramId: string): Promise<ApiResponse<User>> {
    try {
      const response = await this.client.get(`/users/telegram/${telegramId}`);
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      if (error.response?.status === 404) {
        return {
          success: false,
          message: 'User not found',
        };
      }
      
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get user's feature access
   */
  async getUserFeatures(telegramId: string): Promise<ApiResponse<UserFeatureAccess[]>> {
    try {
      const response = await this.client.get(`/users/telegram/${telegramId}/features`);
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Check if user has access to a specific feature
   */
  async checkFeatureAccess(telegramId: string, featureName: string): Promise<boolean> {
    try {
      const featuresResponse = await this.getUserFeatures(telegramId);
      if (!featuresResponse.success || !featuresResponse.data) {
        this.logger.warn('No features found for user', { telegramId });
        return false;
      }

      const hasAccess = featuresResponse.data.some(
        (access) => access.feature.name === featureName && access.feature.isEnabled
      );

      this.logger.debug('Feature access check', {
        telegramId,
        featureName,
        hasAccess,
        totalFeatures: featuresResponse.data.length
      });

      return hasAccess;
    } catch (error) {
      this.logger.error('Error checking feature access', {
        telegramId,
        featureName,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Register a new user (admin only)
   */
  async registerUser(userData: {
    telegramId: string;
    name: string;
    username?: string;
    role?: 'USER' | 'ADMIN';
  }): Promise<ApiResponse<User>> {
    try {
      const response = await this.client.post('/users', userData);
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  /**
   * Update user activity (last seen, etc.)
   */
  async updateUserActivity(telegramId: string): Promise<void> {
    try {
      await this.client.patch(`/users/telegram/${telegramId}/activity`);
    } catch (error) {
      this.logger.warn('Failed to update user activity', {
        telegramId,
        error: error.message,
      });
    }
  }

  /**
   * Get all available features
   */
  async getFeatures(): Promise<ApiResponse<Feature[]>> {
    try {
      const response = await this.client.get('/features');
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch (error) {
      this.logger.error('Backend health check failed', { error: error.message });
      return false;
    }
  }

  /**
   * Generic request method for admin operations
   */
  async request<T = any>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, data?: any): Promise<ApiResponse<T>> {
    try {
      let response;
      
      // Add bot token header for bot admin endpoints
      const headers: any = {};
      if (url.startsWith('/admin/bot/')) {
        const botToken = process.env.BOT_TOKEN;
        if (botToken) {
          headers['x-bot-token'] = botToken;
        }
      }
      
      switch (method.toUpperCase()) {
        case 'GET':
          response = await this.client.get(url, { headers });
          break;
        case 'POST':
          response = await this.client.post(url, data, { headers });
          break;
        case 'PATCH':
          response = await this.client.patch(url, data, { headers });
          break;
        case 'DELETE':
          response = await this.client.delete(url, { headers });
          break;
        default:
          throw new Error(`Unsupported HTTP method: ${method}`);
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      this.logger.error('API request failed', {
        method,
        url,
        error: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });

      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }
} 