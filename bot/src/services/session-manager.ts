import winston from 'winston';

export type UserMode = 'idle' | 'ocr' | 'archive' | 'location' | 'geotags' | 'kml' | 'workbook';

export interface UserSession {
  telegramId: string;
  mode: UserMode;
  data?: any;
  startedAt: Date;
  lastActivity: Date;
}

export class SessionManager {
  private sessions: Map<string, UserSession> = new Map();
  private logger: winston.Logger;

  constructor(logger: winston.Logger) {
    this.logger = logger;

    // Clean up expired sessions every 30 minutes
    setInterval(
      () => {
        this.cleanupExpiredSessions();
      },
      30 * 60 * 1000
    );
  }

  /**
   * Set user mode
   */
  setUserMode(telegramId: string, mode: UserMode, data?: any): void {
    const session: UserSession = {
      telegramId,
      mode,
      data,
      startedAt: new Date(),
      lastActivity: new Date(),
    };

    this.sessions.set(telegramId, session);

    this.logger.info('User mode set', {
      telegramId,
      mode,
      hasData: !!data,
    });
  }

  /**
   * Get user mode
   */
  getUserMode(telegramId: string): UserMode {
    const session = this.sessions.get(telegramId);
    if (session) {
      // Update last activity
      session.lastActivity = new Date();
      return session.mode;
    }
    return 'idle';
  }

  /**
   * Get user session
   */
  getUserSession(telegramId: string): UserSession | null {
    const session = this.sessions.get(telegramId);
    if (session) {
      session.lastActivity = new Date();
      return session;
    }
    return null;
  }

  /**
   * Clear user mode (set to idle)
   */
  clearUserMode(telegramId: string): void {
    this.sessions.delete(telegramId);

    this.logger.info('User mode cleared', {
      telegramId,
    });
  }

  /**
   * Check if user is in specific mode
   */
  isUserInMode(telegramId: string, mode: UserMode): boolean {
    return this.getUserMode(telegramId) === mode;
  }

  /**
   * Update session data
   */
  updateSessionData(telegramId: string, data: any): void {
    const session = this.sessions.get(telegramId);
    if (session) {
      session.data = { ...session.data, ...data };
      session.lastActivity = new Date();
    }
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): UserSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Clean up sessions older than 24 hours
   */
  private cleanupExpiredSessions(): void {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    let cleanedCount = 0;

    for (const [telegramId, session] of this.sessions.entries()) {
      if (session.lastActivity < oneDayAgo) {
        this.sessions.delete(telegramId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.info('Cleaned up expired sessions', {
        cleanedCount,
        remainingSessions: this.sessions.size,
      });
    }
  }

  /**
   * Get session statistics
   */
  getStats(): { totalSessions: number; modeDistribution: Record<UserMode, number> } {
    const sessions = Array.from(this.sessions.values());
    const modeDistribution: Record<UserMode, number> = {
      idle: 0,
      ocr: 0,
      archive: 0,
      location: 0,
      geotags: 0,
      kml: 0,
      workbook: 0,
    };

    sessions.forEach(session => {
      modeDistribution[session.mode]++;
    });

    return {
      totalSessions: sessions.length,
      modeDistribution,
    };
  }
}
