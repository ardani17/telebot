import { IsOptional, IsString, IsObject, IsBoolean, IsNumber, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SettingCategory } from '@prisma/client';

export class GetSettingsDto {
  @ApiProperty({ enum: SettingCategory, required: false })
  @IsOptional()
  category?: SettingCategory;
}

export class UpdateSettingsDto {
  @ApiProperty({ description: 'Settings to update as key-value pairs' })
  @IsObject()
  settings: Record<string, any>;

  @ApiProperty({ description: 'User who is updating the settings', required: false })
  @IsOptional()
  @IsString()
  updatedBy?: string;
}

export class DatabaseConfigDto {
  @ApiProperty({ description: 'Database host' })
  @IsString()
  host: string;

  @ApiProperty({ description: 'Database port' })
  @IsString()
  port: string;

  @ApiProperty({ description: 'Database name' })
  @IsString()
  database: string;

  @ApiProperty({ description: 'Database username' })
  @IsString()
  username: string;

  @ApiProperty({ description: 'Database password', required: false })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiProperty({ description: 'Enable SSL connection' })
  @IsBoolean()
  ssl: boolean;

  @ApiProperty({ description: 'Maximum number of connections' })
  @IsNumber()
  maxConnections: number;

  @ApiProperty({ description: 'Connection timeout in milliseconds' })
  @IsNumber()
  connectionTimeout: number;

  @ApiProperty({ description: 'User who is updating the config', required: false })
  @IsOptional()
  @IsString()
  updatedBy?: string;

  // Optional properties that might be sent from frontend but not required for validation
  @ApiProperty({ description: 'Connection status', required: false })
  @IsOptional()
  @IsBoolean()
  isConnected?: boolean;

  @ApiProperty({ description: 'Last connection test timestamp', required: false })
  @IsOptional()
  @IsString()
  lastConnectionTest?: string;
}

export class SecurityConfigDto {
  @ApiProperty({ description: 'JWT expiration time' })
  @IsString()
  jwtExpirationTime: string;

  @ApiProperty({ description: 'Refresh token expiration time' })
  @IsString()
  refreshTokenExpiration: string;

  @ApiProperty({ description: 'Enable rate limiting' })
  @IsBoolean()
  rateLimitEnabled: boolean;

  @ApiProperty({ description: 'Maximum requests per window' })
  @IsNumber()
  rateLimitRequests: number;

  @ApiProperty({ description: 'Rate limit window in minutes' })
  @IsNumber()
  rateLimitWindow: number;

  @ApiProperty({ description: 'Enable CORS' })
  @IsBoolean()
  corsEnabled: boolean;

  @ApiProperty({ description: 'Allowed CORS origins', type: [String] })
  @IsArray()
  @IsString({ each: true })
  corsOrigins: string[];

  @ApiProperty({ description: 'Minimum password length' })
  @IsNumber()
  passwordMinLength: number;

  @ApiProperty({ description: 'Session timeout in seconds' })
  @IsNumber()
  sessionTimeout: number;

  @ApiProperty({ description: 'Enable brute force protection' })
  @IsBoolean()
  bruteForceProtection: boolean;

  @ApiProperty({ description: 'Enable two-factor authentication' })
  @IsBoolean()
  twoFactorEnabled: boolean;

  @ApiProperty({ description: 'User who is updating the config', required: false })
  @IsOptional()
  @IsString()
  updatedBy?: string;
} 