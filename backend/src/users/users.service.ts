import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createHash } from 'crypto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const users = await this.prisma.user.findMany({
      include: {
        featureAccess: {
          include: {
            feature: true,
          },
        },
      },
    });

    // Remove password from response for security
    return users.map(user => ({
      ...user,
      password: user.password ? true : false, // Only indicate if password is set
    }));
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        featureAccess: {
          include: {
            feature: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Remove password from response for security
    return {
      ...user,
      password: user.password ? true : false, // Only indicate if password is set
    };
  }

  async findByTelegramId(telegramId: string) {
    const user = await this.prisma.user.findUnique({
      where: { telegramId },
      include: {
        featureAccess: {
          include: {
            feature: true,
          },
        },
      },
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
            feature: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user.featureAccess;
  }

  async updateUserActivity(telegramId: string) {
    const user = await this.prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { telegramId },
      data: {
        updatedAt: new Date(),
      },
    });
  }

  async createUser(userData: {
    telegramId: string;
    name: string;
    username?: string;
    password?: string;
    role?: 'USER' | 'ADMIN';
  }) {
    const existingUser = await this.prisma.user.findUnique({
      where: { telegramId: userData.telegramId },
    });

    if (existingUser) {
      throw new Error('User already exists');
    }

    // Hash password if provided
    let hashedPassword: string | undefined;
    if (userData.password) {
      hashedPassword = createHash('sha256').update(userData.password).digest('hex');
    }

    const user = await this.prisma.user.create({
      data: {
        telegramId: userData.telegramId,
        name: userData.name,
        username: userData.username,
        password: hashedPassword,
        role: userData.role || 'USER',
        isActive: true,
      },
      include: {
        featureAccess: {
          include: {
            feature: true,
          },
        },
      },
    });

    // Remove password from response for security
    return {
      ...user,
      password: user.password ? true : false, // Only indicate if password is set
    };
  }

  async updateUser(
    id: string,
    userData: {
      name?: string;
      username?: string;
      password?: string;
      role?: 'USER' | 'ADMIN';
      isActive?: boolean;
    }
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Hash password if provided
    const updateData: any = { ...userData };
    if (userData.password) {
      updateData.password = createHash('sha256').update(userData.password).digest('hex');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        featureAccess: {
          include: {
            feature: true,
          },
        },
      },
    });

    // Remove password from response for security
    return {
      ...updatedUser,
      password: updatedUser.password ? true : false, // Only indicate if password is set
    };
  }

  async deleteUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Delete related records first
    await this.prisma.userFeatureAccess.deleteMany({
      where: { userId: id },
    });

    await this.prisma.botActivity.deleteMany({
      where: { userId: id },
    });

    await this.prisma.fileMetadata.deleteMany({
      where: { userId: id },
    });

    // Delete the user
    return this.prisma.user.delete({
      where: { id },
    });
  }

  async toggleUserStatus(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        isActive: !user.isActive,
      },
      include: {
        featureAccess: {
          include: {
            feature: true,
          },
        },
      },
    });

    // Remove password from response for security
    return {
      ...updatedUser,
      password: updatedUser.password ? true : false, // Only indicate if password is set
    };
  }
}
