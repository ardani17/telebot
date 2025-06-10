import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BotAuthGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const botToken = request.headers['x-bot-token'];
    const expectedBotToken = this.configService.get('BOT_TOKEN');

    if (!botToken) {
      throw new UnauthorizedException('Bot token is required');
    }

    if (botToken !== expectedBotToken) {
      throw new UnauthorizedException('Invalid bot token');
    }

    // Set a bot user context for logging
    request.user = {
      id: 'bot',
      role: 'BOT',
      telegramId: 'bot',
      name: 'Telegram Bot',
    };

    return true;
  }
}
