import { BotMode } from '@teleweb/shared';

export interface UserSession {
  userId: string;
  telegramId: string;
  mode?: BotMode;
  state: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export class ModeManager {
  private sessions = new Map<string, UserSession>();

  /**
   * Set user mode
   */
  setMode(telegramId: string, mode: BotMode, userId?: string): void {
    const session = this.getSession(telegramId);
    session.mode = mode;
    session.state = {}; // Reset state when changing mode
    session.updatedAt = new Date();
    if (userId) session.userId = userId;
    
    this.sessions.set(telegramId, session);
  }

  /**
   * Get user mode
   */
  getMode(telegramId: string): BotMode | undefined {
    const session = this.sessions.get(telegramId);
    return session?.mode;
  }

  /**
   * Clear user mode
   */
  clearMode(telegramId: string): void {
    const session = this.sessions.get(telegramId);
    if (session) {
      session.mode = undefined;
      session.state = {};
      session.updatedAt = new Date();
      this.sessions.set(telegramId, session);
    }
  }

  /**
   * Get user session
   */
  getSession(telegramId: string): UserSession {
    let session = this.sessions.get(telegramId);
    if (!session) {
      session = {
        userId: '',
        telegramId,
        state: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.sessions.set(telegramId, session);
    }
    return session;
  }

  /**
   * Update session state
   */
  updateState(telegramId: string, key: string, value: any): void {
    const session = this.getSession(telegramId);
    session.state[key] = value;
    session.updatedAt = new Date();
    this.sessions.set(telegramId, session);
  }

  /**
   * Get session state
   */
  getState(telegramId: string, key?: string): any {
    const session = this.sessions.get(telegramId);
    if (!session) return undefined;
    
    if (key) {
      return session.state[key];
    }
    return session.state;
  }

  /**
   * Clear session state
   */
  clearState(telegramId: string, key?: string): void {
    const session = this.sessions.get(telegramId);
    if (!session) return;

    if (key) {
      delete session.state[key];
    } else {
      session.state = {};
    }
    session.updatedAt = new Date();
    this.sessions.set(telegramId, session);
  }

  /**
   * Check if user has active mode
   */
  hasActiveMode(telegramId: string): boolean {
    const session = this.sessions.get(telegramId);
    return !!session?.mode;
  }

  /**
   * Get all sessions (for debugging)
   */
  getAllSessions(): Map<string, UserSession> {
    return new Map(this.sessions);
  }

  /**
   * Clean up old sessions
   */
  cleanup(maxAge: number = 24 * 60 * 60 * 1000): void {
    const now = new Date();
    for (const [telegramId, session] of this.sessions) {
      if (now.getTime() - session.updatedAt.getTime() > maxAge) {
        this.sessions.delete(telegramId);
      }
    }
  }

  /**
   * Get session count
   */
  getSessionCount(): number {
    return this.sessions.size;
  }
}
