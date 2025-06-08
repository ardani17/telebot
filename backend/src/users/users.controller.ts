import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Get('telegram/:telegramId')
  findByTelegramId(@Param('telegramId') telegramId: string) {
    return this.usersService.findByTelegramId(telegramId);
  }

  @Get('telegram/:telegramId/features')
  getUserFeatures(@Param('telegramId') telegramId: string) {
    return this.usersService.getUserFeatures(telegramId);
  }

  @Patch('telegram/:telegramId/activity')
  updateUserActivity(@Param('telegramId') telegramId: string) {
    return this.usersService.updateUserActivity(telegramId);
  }

  @Post()
  createUser(@Body() userData: {
    telegramId: string;
    name: string;
    username?: string;
    password?: string;
    role?: 'USER' | 'ADMIN';
  }) {
    return this.usersService.createUser(userData);
  }

  @Patch(':id')
  updateUser(@Param('id') id: string, @Body() userData: {
    name?: string;
    username?: string;
    password?: string;
    role?: 'USER' | 'ADMIN';
    isActive?: boolean;
  }) {
    return this.usersService.updateUser(id, userData);
  }

  @Delete(':id')
  deleteUser(@Param('id') id: string) {
    return this.usersService.deleteUser(id);
  }

  @Patch(':id/toggle-status')
  toggleUserStatus(@Param('id') id: string) {
    return this.usersService.toggleUserStatus(id);
  }
}
