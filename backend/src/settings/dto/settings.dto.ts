import { IsOptional, IsString, IsObject } from 'class-validator';
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