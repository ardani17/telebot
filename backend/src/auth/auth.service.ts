import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';

export interface JwtPayload {
  sub: string;
  telegramId: string;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService
  ) {}

  async validateUser(telegramId: string, password: string) {
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
      throw new UnauthorizedException('User not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }

    if (!user.password) {
      throw new UnauthorizedException('Password not set for this user');
    }

    // Support both bcrypt and legacy SHA256 (temporary backward compatibility)
    let isPasswordValid = false;

    // Support both bcrypt and legacy SHA256 (backward compatibility)
    // Try bcrypt first (new format)
    try {
      isPasswordValid = await bcrypt.compare(password, user.password);
    } catch (error) {
      isPasswordValid = false;
    }

    // If bcrypt failed, try legacy SHA256 format
    if (!isPasswordValid) {
      const legacyHash = createHash('sha256').update(password).digest('hex');
      isPasswordValid = legacyHash === user.password;

      // If legacy hash matches, migrate to bcrypt
      if (isPasswordValid) {
        const saltRounds = 12;
        const newBcryptHash = await bcrypt.hash(password, saltRounds);
        await this.prisma.user.update({
          where: { id: user.id },
          data: { password: newBcryptHash },
        });
        console.log(`🔄 Password migrated to bcrypt for user: ${user.telegramId}`);
      }
    }

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid password');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: userPassword, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async login(user: any) {
    const payload: JwtPayload = {
      sub: user.id,
      telegramId: user.telegramId,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '30d',
    });

    // Store refresh token in database
    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        telegramId: user.telegramId,
        name: user.name,
        username: user.username,
        role: user.role,
      },
    };
  }

  async refreshToken(refreshToken: string) {
    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: tokenRecord.userId },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Delete old refresh token
    await this.prisma.refreshToken.delete({
      where: { token: refreshToken },
    });

    // Generate new tokens
    return this.login(user);
  }

  async logout(refreshToken: string) {
    if (refreshToken) {
      await this.prisma.refreshToken.deleteMany({
        where: { token: refreshToken },
      });
    }
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        featureAccess: {
          include: {
            feature: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: userPassword2, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Hash password using bcrypt with salt rounds
   */
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12; // High security salt rounds
    return await bcrypt.hash(password, saltRounds);
  }

  /**
   * Verify password against hash using bcrypt
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }
}
