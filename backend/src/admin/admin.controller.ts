import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { BotAuthGuard } from '../auth/bot-auth.guard';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // Bot-specific endpoints (no JWT required, use bot token)
  @Get('bot/users')
  @ApiTags('admin-bot')
  @ApiHeader({ name: 'x-bot-token', description: 'Bot authentication token' })
  @ApiOperation({ summary: 'Get all users (Bot access)' })
  @ApiResponse({ status: 200, description: 'List of users' })
  @UseGuards(BotAuthGuard)
  async getBotUsers(@Query('active') active?: string) {
    const isActiveFilter = active === 'true' ? true : active === 'false' ? false : undefined;
    return this.adminService.getUsers(isActiveFilter);
  }

  @Get('bot/users/:telegramId')
  @ApiTags('admin-bot')
  @ApiHeader({ name: 'x-bot-token', description: 'Bot authentication token' })
  @ApiOperation({ summary: 'Get user by telegram ID (Bot access)' })
  @ApiResponse({ status: 200, description: 'User details' })
  @UseGuards(BotAuthGuard)
  async getBotUserByTelegramId(@Param('telegramId') telegramId: string) {
    return this.adminService.getUserByTelegramId(telegramId);
  }

  @Post('bot/users')
  @ApiTags('admin-bot')
  @ApiHeader({ name: 'x-bot-token', description: 'Bot authentication token' })
  @ApiOperation({ summary: 'Create new user (Bot access)' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @UseGuards(BotAuthGuard)
  async createBotUser(
    @Body()
    userData: {
      telegramId: string;
      name: string;
      username?: string;
      role?: 'ADMIN' | 'USER';
      isActive?: boolean;
    }
  ) {
    return this.adminService.createUser(userData);
  }

  @Patch('bot/users/:telegramId')
  @ApiTags('admin-bot')
  @ApiHeader({ name: 'x-bot-token', description: 'Bot authentication token' })
  @ApiOperation({ summary: 'Update user (Bot access)' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @UseGuards(BotAuthGuard)
  async updateBotUser(
    @Param('telegramId') telegramId: string,
    @Body()
    updateData: {
      name?: string;
      username?: string;
      role?: 'ADMIN' | 'USER';
      isActive?: boolean;
    }
  ) {
    return this.adminService.updateUser(telegramId, updateData);
  }

  @Delete('bot/users/:telegramId')
  @ApiTags('admin-bot')
  @ApiHeader({ name: 'x-bot-token', description: 'Bot authentication token' })
  @ApiOperation({ summary: 'Delete user (Bot access)' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @UseGuards(BotAuthGuard)
  async deleteBotUser(@Param('telegramId') telegramId: string) {
    return this.adminService.deleteUser(telegramId);
  }

  @Get('bot/features')
  @ApiTags('admin-bot')
  @ApiHeader({ name: 'x-bot-token', description: 'Bot authentication token' })
  @ApiOperation({ summary: 'Get all features (Bot access)' })
  @ApiResponse({ status: 200, description: 'List of features' })
  @UseGuards(BotAuthGuard)
  async getBotFeatures() {
    return this.adminService.getFeatures();
  }

  @Patch('bot/features/:featureName')
  @ApiTags('admin-bot')
  @ApiHeader({ name: 'x-bot-token', description: 'Bot authentication token' })
  @ApiOperation({ summary: 'Update feature status (Bot access)' })
  @ApiResponse({ status: 200, description: 'Feature updated successfully' })
  @UseGuards(BotAuthGuard)
  async updateBotFeature(
    @Param('featureName') featureName: string,
    @Body() updateData: { isEnabled: boolean }
  ) {
    return this.adminService.updateFeature(featureName, updateData.isEnabled);
  }

  @Post('bot/features/grant')
  @ApiTags('admin-bot')
  @ApiHeader({ name: 'x-bot-token', description: 'Bot authentication token' })
  @ApiOperation({ summary: 'Grant feature access to user (Bot access)' })
  @ApiResponse({ status: 200, description: 'Feature access granted' })
  @UseGuards(BotAuthGuard)
  async grantBotFeatureAccess(@Body() grantData: { telegramId: string; featureName: string }) {
    return this.adminService.grantFeatureAccess(grantData.telegramId, grantData.featureName);
  }

  @Post('bot/features/revoke')
  @ApiTags('admin-bot')
  @ApiHeader({ name: 'x-bot-token', description: 'Bot authentication token' })
  @ApiOperation({ summary: 'Revoke feature access from user (Bot access)' })
  @ApiResponse({ status: 200, description: 'Feature access revoked' })
  @UseGuards(BotAuthGuard)
  async revokeBotFeatureAccess(@Body() revokeData: { telegramId: string; featureName: string }) {
    return this.adminService.revokeFeatureAccess(revokeData.telegramId, revokeData.featureName);
  }

  @Get('bot/stats/users')
  @ApiTags('admin-bot')
  @ApiHeader({ name: 'x-bot-token', description: 'Bot authentication token' })
  @ApiOperation({ summary: 'Get user statistics (Bot access)' })
  @ApiResponse({ status: 200, description: 'User statistics' })
  @UseGuards(BotAuthGuard)
  async getBotUserStats() {
    return this.adminService.getUserStats();
  }

  @Get('bot/stats/features')
  @ApiTags('admin-bot')
  @ApiHeader({ name: 'x-bot-token', description: 'Bot authentication token' })
  @ApiOperation({ summary: 'Get feature statistics (Bot access)' })
  @ApiResponse({ status: 200, description: 'Feature statistics' })
  @UseGuards(BotAuthGuard)
  async getBotFeatureStats() {
    return this.adminService.getFeatureStats();
  }

  @Get('bot/stats/activities')
  @ApiTags('admin-bot')
  @ApiHeader({ name: 'x-bot-token', description: 'Bot authentication token' })
  @ApiOperation({ summary: 'Get activity statistics (Bot access)' })
  @ApiResponse({ status: 200, description: 'Activity statistics' })
  @UseGuards(BotAuthGuard)
  async getBotActivityStats() {
    return this.adminService.getActivityStats();
  }

  @Get('bot/stats/system')
  @ApiTags('admin-bot')
  @ApiHeader({ name: 'x-bot-token', description: 'Bot authentication token' })
  @ApiOperation({ summary: 'Get system statistics (Bot access)' })
  @ApiResponse({ status: 200, description: 'System statistics' })
  @UseGuards(BotAuthGuard)
  async getBotSystemStats() {
    return this.adminService.getSystemStats();
  }

  // Web-specific endpoints (JWT required)
  @Get('users')
  @ApiTags('admin')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({ status: 200, description: 'List of users' })
  async getUsers(@Query('active') active?: string) {
    const isActiveFilter = active === 'true' ? true : active === 'false' ? false : undefined;
    return this.adminService.getUsers(isActiveFilter);
  }

  @Get('users/check-telegram/:telegramId')
  @ApiTags('admin')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Check Telegram user info by ID' })
  @ApiResponse({ status: 200, description: 'Telegram user info' })
  async checkTelegramUser(@Param('telegramId') telegramId: string) {
    return this.adminService.checkTelegramUser(telegramId);
  }

  @Get('users/:telegramId')
  @ApiTags('admin')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Get user by telegram ID' })
  @ApiResponse({ status: 200, description: 'User details' })
  async getUserByTelegramId(@Param('telegramId') telegramId: string) {
    return this.adminService.getUserByTelegramId(telegramId);
  }

  @Post('users')
  @ApiTags('admin')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Create new user' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  async createUser(
    @Body()
    userData: {
      telegramId: string;
      name: string;
      username?: string;
      role?: 'ADMIN' | 'USER';
      isActive?: boolean;
    }
  ) {
    return this.adminService.createUser(userData);
  }

  @Patch('users/:telegramId')
  @ApiTags('admin')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Update user' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  async updateUser(
    @Param('telegramId') telegramId: string,
    @Body()
    updateData: {
      name?: string;
      username?: string;
      role?: 'ADMIN' | 'USER';
      isActive?: boolean;
    }
  ) {
    return this.adminService.updateUser(telegramId, updateData);
  }

  @Delete('users/:telegramId')
  @ApiTags('admin')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Delete user' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  async deleteUser(@Param('telegramId') telegramId: string) {
    return this.adminService.deleteUser(telegramId);
  }

  // Feature management endpoints
  @Get('features')
  @ApiTags('admin')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Get all features' })
  @ApiResponse({ status: 200, description: 'List of features' })
  async getFeatures() {
    return this.adminService.getFeatures();
  }

  @Patch('features/:featureName')
  @ApiTags('admin')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Update feature status' })
  @ApiResponse({ status: 200, description: 'Feature updated successfully' })
  async updateFeature(
    @Param('featureName') featureName: string,
    @Body() updateData: { isEnabled: boolean }
  ) {
    return this.adminService.updateFeature(featureName, updateData.isEnabled);
  }

  @Post('features/grant')
  @ApiTags('admin')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Grant feature access to user' })
  @ApiResponse({ status: 200, description: 'Feature access granted' })
  async grantFeatureAccess(@Body() grantData: { telegramId: string; featureName: string }) {
    return this.adminService.grantFeatureAccess(grantData.telegramId, grantData.featureName);
  }

  @Post('features/revoke')
  @ApiTags('admin')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Revoke feature access from user' })
  @ApiResponse({ status: 200, description: 'Feature access revoked' })
  async revokeFeatureAccess(@Body() revokeData: { telegramId: string; featureName: string }) {
    return this.adminService.revokeFeatureAccess(revokeData.telegramId, revokeData.featureName);
  }

  // Statistics endpoints
  @Get('stats/users')
  @ApiTags('admin')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Get user statistics' })
  @ApiResponse({ status: 200, description: 'User statistics' })
  async getUserStats() {
    return this.adminService.getUserStats();
  }

  @Get('stats/features')
  @ApiTags('admin')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Get feature statistics' })
  @ApiResponse({ status: 200, description: 'Feature statistics' })
  async getFeatureStats() {
    return this.adminService.getFeatureStats();
  }

  @Get('stats/activities')
  @ApiTags('admin')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Get activity statistics' })
  @ApiResponse({ status: 200, description: 'Activity statistics' })
  async getActivityStats() {
    return this.adminService.getActivityStats();
  }

  @Get('stats/system')
  @ApiTags('admin')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Get system statistics' })
  @ApiResponse({ status: 200, description: 'System statistics' })
  async getSystemStats() {
    return this.adminService.getSystemStats();
  }
}
