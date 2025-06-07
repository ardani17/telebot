import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {
  async validateUser(telegramId: string) {
    // TODO: Implement user validation
    return { id: '1', telegramId, name: 'Test User' };
  }

  async login(user: any) {
    // TODO: Implement JWT token generation
    return { access_token: 'test-token' };
  }
}
