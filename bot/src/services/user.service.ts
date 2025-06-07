import axios from 'axios';

export interface User {
  id: string;
  telegramId: string;
  name: string;
  username?: string;
  role: 'ADMIN' | 'USER';
  isActive: boolean;
  features: string[];
}

export class UserService {
  private backendUrl: string;
  private apiKey: string;

  constructor() {
    this.backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    this.apiKey = process.env.BACKEND_API_KEY || '';
  }

  /**
   * Get user by Telegram ID
   */
  async getUserByTelegramId(telegramId: string): Promise<User | null> {
    try {
      const response = await axios.get(
        `${this.backendUrl}/api/users/telegram/${telegramId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Check if user has feature access
   */
  async hasFeatureAccess(telegramId: string, feature: string): Promise<boolean> {
    try {
      const user = await this.getUserByTelegramId(telegramId);
      if (!user || !user.isActive) {
        return false;
      }
      return user.features.includes(feature);
    } catch (error) {
      console.error('Error checking feature access:', error);
      return false;
    }
  }

  /**
   * Log bot activity
   */
  async logActivity(data: {
    telegramId: string;
    action: string;
    mode?: string;
    details?: any;
    success: boolean;
    errorMessage?: string;
  }): Promise<void> {
    try {
      await axios.post(
        `${this.backendUrl}/api/bot/activities`,
        data,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  }

  /**
   * Save file metadata
   */
  async saveFileMetadata(data: {
    telegramId: string;
    fileName: string;
    filePath: string;
    fileType: string;
    fileSize: number;
    mimeType?: string;
    mode: string;
  }): Promise<void> {
    try {
      await axios.post(
        `${this.backendUrl}/api/files`,
        data,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (error) {
      console.error('Error saving file metadata:', error);
    }
  }

  /**
   * Update bot session
   */
  async updateSession(data: {
    telegramId: string;
    mode?: string;
    state: any;
  }): Promise<void> {
    try {
      await axios.post(
        `${this.backendUrl}/api/bot/sessions`,
        data,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (error) {
      console.error('Error updating session:', error);
    }
  }

  /**
   * Check if user is registered
   */
  async isUserRegistered(telegramId: string): Promise<boolean> {
    const user = await this.getUserByTelegramId(telegramId);
    return user !== null && user.isActive;
  }

  /**
   * Get user features
   */
  async getUserFeatures(telegramId: string): Promise<string[]> {
    const user = await this.getUserByTelegramId(telegramId);
    return user?.features || [];
  }
}
