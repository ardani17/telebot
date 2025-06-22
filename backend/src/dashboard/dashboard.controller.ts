import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}
  @Get('test')
  test() {
    return { message: 'Dashboard endpoint is working!' };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get dashboard statistics from database' })
  async getStats() {
    return this.dashboardService.getStats();
  }

  @Get('activities')
  @ApiOperation({ summary: 'Get recent activities from database' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getActivities(@Query('limit') limit?: number) {
    return this.dashboardService.getRecentActivities(limit || 10);
  }

  @Get('logs')
  @ApiOperation({ summary: 'Get system logs' })
  @ApiQuery({ name: 'service', required: false, enum: ['backend', 'frontend', 'bot', 'all'] })
  @ApiQuery({ name: 'lines', required: false, type: Number })
  async getLogs(@Query('service') service: string = 'all', @Query('lines') lines: number = 50) {
    return this.dashboardService.getSystemLogs(service, lines);
  }

  @Get('system-status')
  @ApiOperation({ summary: 'Get real-time system status' })
  async getSystemStatus() {
    return this.dashboardService.getSystemStatus();
  }

  @Get('system-metrics')
  @ApiOperation({ summary: 'Get real-time system metrics (RAM, CPU)' })
  async getSystemMetrics() {
    return this.dashboardService.getSystemMetrics();
  }
}
