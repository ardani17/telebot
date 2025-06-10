import { Controller, Get, Post, Body, UseGuards, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import {
  UpdateSettingsDto,
  GetSettingsDto,
  DatabaseConfigDto,
  SecurityConfigDto,
} from './dto/settings.dto';

@ApiTags('settings')
@Controller('settings')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all app settings' })
  @ApiResponse({ status: 200, description: 'Settings retrieved successfully' })
  async getSettings(@Query() query: GetSettingsDto) {
    return this.settingsService.getSettings(query.category);
  }

  @Post()
  @ApiOperation({ summary: 'Update app settings' })
  @ApiResponse({ status: 200, description: 'Settings updated successfully' })
  async updateSettings(@Body() updateDto: UpdateSettingsDto) {
    return this.settingsService.updateSettings(updateDto);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get all setting categories' })
  @ApiResponse({ status: 200, description: 'Categories retrieved successfully' })
  async getCategories() {
    return this.settingsService.getCategories();
  }

  @Post('reset')
  @ApiOperation({ summary: 'Reset settings to default values' })
  @ApiResponse({ status: 200, description: 'Settings reset successfully' })
  async resetSettings() {
    return this.settingsService.resetToDefaults();
  }

  @Get('database')
  @ApiOperation({ summary: 'Get database configuration' })
  @ApiResponse({ status: 200, description: 'Database config retrieved successfully' })
  async getDatabaseConfig() {
    return this.settingsService.getDatabaseConfig();
  }

  @Post('database')
  @ApiOperation({ summary: 'Update database configuration' })
  @ApiResponse({ status: 200, description: 'Database config updated successfully' })
  async updateDatabaseConfig(@Body() configDto: DatabaseConfigDto) {
    return this.settingsService.updateDatabaseConfig(configDto);
  }

  @Post('database/test')
  @ApiOperation({ summary: 'Test database connection' })
  @ApiResponse({ status: 200, description: 'Database connection tested' })
  async testDatabaseConnection(@Body() configDto: DatabaseConfigDto) {
    return this.settingsService.testDatabaseConnection(configDto);
  }

  @Get('security')
  @ApiOperation({ summary: 'Get security configuration' })
  @ApiResponse({ status: 200, description: 'Security config retrieved successfully' })
  async getSecurityConfig() {
    return this.settingsService.getSecurityConfig();
  }

  @Post('security')
  @ApiOperation({ summary: 'Update security configuration' })
  @ApiResponse({ status: 200, description: 'Security config updated successfully' })
  async updateSecurityConfig(@Body() configDto: SecurityConfigDto) {
    return this.settingsService.updateSecurityConfig(configDto);
  }
}
