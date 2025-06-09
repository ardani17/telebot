import { Controller, Get, Post, Body, UseGuards, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto, GetSettingsDto } from './dto/settings.dto';

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
} 