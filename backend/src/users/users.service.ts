import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      include: {
        featureAccess: {
          include: {
            feature: true
          }
        }
      }
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        featureAccess: {
          include: {
            feature: true
          }
        }
      }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findByTelegramId(telegramId: string) {
    const user = await this.prisma.user.findUnique({
      where: { telegramId },
      include: {
        featureAccess: {
          include: {
            feature: true
          }
        }
      }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async getUserFeatures(telegramId: string) {
    const user = await this.prisma.user.findUnique({
      where: { telegramId },
      include: {
        featureAccess: {
          include: {
            feature: true
          }
        }
      }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user.featureAccess;
  }

  async updateUserActivity(telegramId: string) {
    const user = await this.prisma.user.findUnique({
      where: { telegramId }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { telegramId },
      data: {
        updatedAt: new Date()
      }
    });
  }

  async createUser(userData: {
    telegramId: string;
    name: string;
    username?: string;
    role?: 'USER' | 'ADMIN';
  }) {
    const existingUser = await this.prisma.user.findUnique({
      where: { telegramId: userData.telegramId }
    });

    if (existingUser) {
      throw new Error('User already exists');
    }

    return this.prisma.user.create({
      data: {
        telegramId: userData.telegramId,
        name: userData.name,
        username: userData.username,
        role: userData.role || 'USER',
        isActive: true,
      }
    });
  }
}
