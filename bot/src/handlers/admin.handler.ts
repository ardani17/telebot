import { AuthContext } from '../types/auth';
import winston from 'winston';
import { ApiClient } from '../services/api-client';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

interface AdminContext extends AuthContext {
  // Admin-specific context
}

export class AdminHandler {
  private logger: winston.Logger;
  private apiClient: ApiClient;
  private backendUrl: string;

  constructor(apiClient: ApiClient, logger: winston.Logger) {
    this.apiClient = apiClient;
    this.logger = logger;
    this.backendUrl = process.env.BACKEND_URL || 'http://localhost:3001/api';
  }

  /**
   * Handle /admin command - show admin panel
   */
  async handleAdminCommand(ctx: AdminContext) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      // Verify admin access
      if (ctx.user.role !== 'ADMIN') {
        await ctx.reply('❌ Akses ditolak. Hanya admin yang dapat menggunakan fitur ini.');
        return;
      }

      this.logger.info('Admin panel accessed', {
        telegramId,
        userId: ctx.user.id,
        username: ctx.user.username,
      });

      const adminText = `
🔧 *Panel Administrator TeleWeb*

*🔑 Status:* Administrator verified ✅
*👤 Admin:* ${ctx.user.name}

*📋 Perintah Tersedia:*
👥 /users - Kelola pengguna sistem
⚙️ /features - Kelola fitur dan akses
📊 /stats - Statistik sistem dan penggunaan
📢 /broadcast - Kirim pesan ke semua pengguna
🗑️ /reset_data_bot - Reset data bot (documents, photos, temp)
🗑️ /reset_data_user - Reset data pengguna

*ℹ️ Info Tambahan:*
🏠 /menu - Kembali ke menu utama
❓ /help - Bantuan lengkap

*⚡ Quick Actions:*
• Ketik \`/users list\` untuk daftar pengguna
• Ketik \`/stats quick\` untuk statistik ringkas
• Ketik \`/features status\` untuk status fitur
      `;

      await ctx.reply(adminText, { parse_mode: 'Markdown' });
    } catch (error) {
      this.logger.error('Admin panel command failed', {
        error: (error as Error).message,
        telegramId: ctx.from!.id,
      });
      await ctx.reply('❌ Terjadi kesalahan saat mengakses panel admin.');
    }
  }

  /**
   * Handle /users command - user management
   */
  async handleUsersCommand(ctx: AdminContext, subCommand?: string, ...args: string[]) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      // Verify admin access
      if (ctx.user.role !== 'ADMIN') {
        await ctx.reply('❌ Akses ditolak. Hanya admin yang dapat mengelola pengguna.');
        return;
      }

      if (!subCommand) {
        // Show users menu
        const helpText = `
👥 *Manajemen Pengguna*

*📋 Perintah Tersedia:*
\`/users list\` - Daftar semua pengguna
\`/users add <telegram_id> <nama>\` - Tambah pengguna baru
\`/users remove <telegram_id>\` - Hapus pengguna
\`/users info <telegram_id>\` - Info detail pengguna
\`/users activate <telegram_id>\` - Aktifkan pengguna
\`/users deactivate <telegram_id>\` - Non-aktifkan pengguna
\`/users role <telegram_id> <ADMIN|USER>\` - Ubah role

*💡 Contoh:*
\`/users add 123456789 John Doe\`
\`/users role 123456789 ADMIN\`
        `;

        await ctx.reply(helpText, { parse_mode: 'Markdown' });
        return;
      }

      switch (subCommand.toLowerCase()) {
        case 'list':
          await this.handleUsersList(ctx);
          break;
        case 'add':
          if (args.length < 2) {
            await ctx.reply('❌ Format: `/users add <telegram_id> <nama>`');
            return;
          }
          await this.handleUsersAdd(ctx, args[0], args.slice(1).join(' '));
          break;
        case 'remove':
          if (args.length < 1) {
            await ctx.reply('❌ Format: `/users remove <telegram_id>`');
            return;
          }
          await this.handleUsersRemove(ctx, args[0]);
          break;
        case 'info':
          if (args.length < 1) {
            await ctx.reply('❌ Format: `/users info <telegram_id>`');
            return;
          }
          await this.handleUsersInfo(ctx, args[0]);
          break;
        case 'activate':
          if (args.length < 1) {
            await ctx.reply('❌ Format: `/users activate <telegram_id>`');
            return;
          }
          await this.handleUsersToggleActive(ctx, args[0], true);
          break;
        case 'deactivate':
          if (args.length < 1) {
            await ctx.reply('❌ Format: `/users deactivate <telegram_id>`');
            return;
          }
          await this.handleUsersToggleActive(ctx, args[0], false);
          break;
        case 'role':
          if (args.length < 2) {
            await ctx.reply('❌ Format: `/users role <telegram_id> <ADMIN|USER>`');
            return;
          }
          await this.handleUsersRole(ctx, args[0], args[1]);
          break;
        default:
          await ctx.reply('❌ Sub-command tidak dikenal. Ketik `/users` untuk bantuan.');
      }
    } catch (error) {
      this.logger.error('Users command failed', {
        error: (error as Error).message,
        telegramId: ctx.from!.id,
        subCommand,
        args,
      });
      await ctx.reply('❌ Terjadi kesalahan saat mengelola pengguna.');
    }
  }

  /**
   * Handle /features command - feature management
   */
  async handleFeaturesCommand(ctx: AdminContext, subCommand?: string, ...args: string[]) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      // Verify admin access
      if (ctx.user.role !== 'ADMIN') {
        await ctx.reply('❌ Akses ditolak. Hanya admin yang dapat mengelola fitur.');
        return;
      }

      if (!subCommand) {
        // Show features menu
        const helpText = `
⚙️ *Manajemen Fitur*

*📋 Perintah Tersedia:*
\`/features status\` - Status semua fitur
\`/features list\` - Daftar fitur tersedia
\`/features enable <nama_fitur>\` - Aktifkan fitur
\`/features disable <nama_fitur>\` - Non-aktifkan fitur
\`/features grant <telegram_id> <nama_fitur>\` - Berikan akses fitur
\`/features revoke <telegram_id> <nama_fitur>\` - Cabut akses fitur
\`/features user <telegram_id>\` - Lihat fitur pengguna

*💡 Contoh:*
\`/features enable ocr\`
\`/features grant 123456789 archive\`
        `;

        await ctx.reply(helpText, { parse_mode: 'Markdown' });
        return;
      }

      switch (subCommand.toLowerCase()) {
        case 'status':
        case 'list':
          await this.handleFeaturesList(ctx);
          break;
        case 'enable':
          if (args.length < 1) {
            await ctx.reply('❌ Format: `/features enable <nama_fitur>`');
            return;
          }
          await this.handleFeaturesToggle(ctx, args[0], true);
          break;
        case 'disable':
          if (args.length < 1) {
            await ctx.reply('❌ Format: `/features disable <nama_fitur>`');
            return;
          }
          await this.handleFeaturesToggle(ctx, args[0], false);
          break;
        case 'grant':
          if (args.length < 2) {
            await ctx.reply('❌ Format: `/features grant <telegram_id> <nama_fitur>`');
            return;
          }
          await this.handleFeaturesGrant(ctx, args[0], args[1], true);
          break;
        case 'revoke':
          if (args.length < 2) {
            await ctx.reply('❌ Format: `/features revoke <telegram_id> <nama_fitur>`');
            return;
          }
          await this.handleFeaturesGrant(ctx, args[0], args[1], false);
          break;
        case 'user':
          if (args.length < 1) {
            await ctx.reply('❌ Format: `/features user <telegram_id>`');
            return;
          }
          await this.handleFeaturesUser(ctx, args[0]);
          break;
        default:
          await ctx.reply('❌ Sub-command tidak dikenal. Ketik `/features` untuk bantuan.');
      }
    } catch (error) {
      this.logger.error('Features command failed', {
        error: (error as Error).message,
        telegramId: ctx.from!.id,
        subCommand,
        args,
      });
      await ctx.reply('❌ Terjadi kesalahan saat mengelola fitur.');
    }
  }

  /**
   * Handle /stats command - system statistics
   */
  async handleStatsCommand(ctx: AdminContext, subCommand?: string) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      // Verify admin access
      if (ctx.user.role !== 'ADMIN') {
        await ctx.reply('❌ Akses ditolak. Hanya admin yang dapat melihat statistik sistem.');
        return;
      }

      if (subCommand === 'quick') {
        await this.handleStatsQuick(ctx);
      } else if (subCommand === 'storage') {
        await this.handleStatsStorage(ctx);
      } else {
        await this.handleStatsDetailed(ctx);
      }
    } catch (error) {
      this.logger.error('Stats command failed', {
        error: (error as Error).message,
        telegramId: ctx.from!.id,
      });
      await ctx.reply('❌ Terjadi kesalahan saat mengambil statistik.');
    }
  }

  /**
   * Handle /broadcast command - broadcast messaging
   */
  async handleBroadcastCommand(ctx: AdminContext, ...messageParts: string[]) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      // Verify admin access
      if (ctx.user.role !== 'ADMIN') {
        await ctx.reply('❌ Akses ditolak. Hanya admin yang dapat mengirim broadcast.');
        return;
      }

      if (messageParts.length === 0) {
        const helpText = `
📢 *Broadcast Message*

*📋 Cara Penggunaan:*
\`/broadcast <pesan>\` - Kirim pesan ke semua pengguna aktif

*💡 Contoh:*
\`/broadcast Sistem akan maintenance jam 2 malam\`

*⚠️ Catatan:*
• Pesan akan dikirim ke semua pengguna yang terdaftar dan aktif
• Pastikan pesan sudah benar sebelum mengirim
• Proses pengiriman mungkin membutuhkan waktu
        `;

        await ctx.reply(helpText, { parse_mode: 'Markdown' });
        return;
      }

      const message = messageParts.join(' ');
      await this.handleBroadcastSend(ctx, message);
    } catch (error) {
      this.logger.error('Broadcast command failed', {
        error: (error as Error).message,
        telegramId: ctx.from!.id,
      });
      await ctx.reply('❌ Terjadi kesalahan saat mengirim broadcast.');
    }
  }

  /**
   * Handle /reset_data_bot command - reset bot data
   */
  async handleResetDataBot(ctx: AdminContext) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      // Verify admin access
      if (ctx.user.role !== 'ADMIN') {
        await ctx.reply('❌ Akses ditolak. Hanya admin yang dapat mereset data bot.');
        return;
      }

      const confirmText = `
🗑️ *Reset Data Bot*

⚠️ **PERINGATAN**: Operasi ini akan menghapus:
• Folder \`documents/\`
• Folder \`photos/\`
• Folder \`temp/\`

📂 Lokasi: \`BOT_API_DATA_PATH/<bot-token>/\`

❗ **Data yang dihapus tidak dapat dikembalikan!**

Ketik \`/reset_data_bot confirm\` untuk melanjutkan.
Ketik \`/admin\` untuk kembali ke menu.
      `;

      await ctx.reply(confirmText, { parse_mode: 'Markdown' });
    } catch (error) {
      this.logger.error('Reset data bot command failed', {
        error: (error as Error).message,
        telegramId: ctx.from!.id,
      });
      await ctx.reply('❌ Terjadi kesalahan saat memproses reset data bot.');
    }
  }

  /**
   * Handle /reset_data_user command - reset user data
   */
  async handleResetDataUser(ctx: AdminContext, targetUserId?: string) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      // Verify admin access
      if (ctx.user.role !== 'ADMIN') {
        await ctx.reply('❌ Akses ditolak. Hanya admin yang dapat mereset data pengguna.');
        return;
      }

      if (!targetUserId) {
        const helpText = `
🗑️ *Reset Data Pengguna*

*📋 Cara Penggunaan:*
\`/reset_data_user <telegram_id>\` - Reset data pengguna tertentu
\`/reset_data_user all\` - Reset data semua pengguna

*💡 Contoh:*
\`/reset_data_user 302791169\`
\`/reset_data_user all\`

*⚠️ Catatan:*
• Data yang dihapus tidak dapat dikembalikan
• Operasi akan menghapus seluruh folder pengguna
• File binlog dan sistem lainnya tetap aman
        `;

        await ctx.reply(helpText, { parse_mode: 'Markdown' });
        return;
      }

      const confirmText = `
🗑️ *Reset Data Pengguna*

⚠️ **PERINGATAN**: Operasi ini akan menghapus:
${
  targetUserId === 'all'
    ? '• **SEMUA** folder pengguna di BOT_API_DATA_PATH'
    : `• Folder pengguna: \`${targetUserId}/\``
}

📂 Lokasi: \`BOT_API_DATA_PATH/${targetUserId === 'all' ? '<telegram-id>' : targetUserId}/\`

❗ **Data yang dihapus tidak dapat dikembalikan!**

Ketik \`/reset_data_user ${targetUserId} confirm\` untuk melanjutkan.
Ketik \`/admin\` untuk kembali ke menu.
      `;

      await ctx.reply(confirmText, { parse_mode: 'Markdown' });
    } catch (error) {
      this.logger.error('Reset data user command failed', {
        error: (error as Error).message,
        telegramId: ctx.from!.id,
      });
      await ctx.reply('❌ Terjadi kesalahan saat memproses reset data pengguna.');
    }
  }

  // Helper methods implementation

  private async handleUsersList(ctx: AdminContext) {
    try {
      const response = await this.apiClient.request('GET', '/admin/bot/users');
      if (!response.success) {
        await ctx.reply('❌ Gagal mengambil daftar pengguna.');
        return;
      }

      const users = response.data || [];
      if (users.length === 0) {
        await ctx.reply('📝 Belum ada pengguna terdaftar.');
        return;
      }

      let userList = '👥 *Daftar Pengguna*\n\n';

      // Get features for each user
      for (let index = 0; index < users.length; index++) {
        const user = users[index];
        const status = user.isActive ? '✅' : '❌';
        const role = user.role === 'ADMIN' ? '👑' : '👤';

        userList += `${index + 1}. ${role} ${user.name}\n`;
        userList += `   ID: \`${user.telegramId}\`\n`;
        userList += `   Status: ${status} ${user.isActive ? 'Aktif' : 'Non-aktif'}\n`;
        userList += `   Role: ${user.role}\n`;

        // Get user features
        if (user.role === 'ADMIN') {
          userList += `   Features: Semua (Admin)\n\n`;
        } else {
          const featuresResponse = await this.apiClient.getUserFeatures(user.telegramId);
          const features = featuresResponse.success ? featuresResponse.data || [] : [];

          const activeFeatures = features
            .filter((access: any) => access.feature.isEnabled)
            .map((access: any) => access.feature.name.toLowerCase())
            .join(', ');

          userList += `   Features: ${activeFeatures || 'Tidak ada'}\n\n`;
        }
      }

      userList += `📊 Total: ${users.length} pengguna`;

      await ctx.reply(userList, { parse_mode: 'Markdown' });
    } catch (error) {
      this.logger.error('Failed to get users list', { error: (error as Error).message });
      await ctx.reply('❌ Terjadi kesalahan saat mengambil daftar pengguna.');
    }
  }

  private async handleUsersAdd(ctx: AdminContext, telegramId: string, name: string) {
    try {
      const response = await this.apiClient.request('POST', '/admin/bot/users', {
        telegramId,
        name,
        role: 'USER',
        isActive: true,
      });

      if (response.success) {
        await ctx.reply(`✅ Pengguna berhasil ditambahkan:\n👤 ${name}\n🆔 ${telegramId}`);
        this.logger.info('User added via bot', {
          adminId: ctx.user!.id,
          newUserTelegramId: telegramId,
          newUserName: name,
        });
      } else {
        await ctx.reply(`❌ Gagal menambahkan pengguna: ${response.error || 'Unknown error'}`);
      }
    } catch (error) {
      this.logger.error('Failed to add user', {
        error: (error as Error).message,
        telegramId,
        name,
      });
      await ctx.reply('❌ Terjadi kesalahan saat menambahkan pengguna.');
    }
  }

  private async handleUsersRemove(ctx: AdminContext, targetTelegramId: string) {
    try {
      // Prevent self-deletion
      if (targetTelegramId === ctx.from!.id.toString()) {
        await ctx.reply('❌ Anda tidak dapat menghapus akun sendiri.');
        return;
      }

      const response = await this.apiClient.request(
        'DELETE',
        `/admin/bot/users/${targetTelegramId}`
      );

      if (response.success) {
        await ctx.reply(`✅ Pengguna dengan ID ${targetTelegramId} berhasil dihapus.`);
        this.logger.info('User removed via bot', {
          adminId: ctx.user!.id,
          removedUserTelegramId: targetTelegramId,
        });
      } else {
        await ctx.reply(
          `❌ Gagal menghapus pengguna: ${response.error || 'Pengguna tidak ditemukan'}`
        );
      }
    } catch (error) {
      this.logger.error('Failed to remove user', {
        error: (error as Error).message,
        targetTelegramId,
      });
      await ctx.reply('❌ Terjadi kesalahan saat menghapus pengguna.');
    }
  }

  private async handleUsersInfo(ctx: AdminContext, targetTelegramId: string) {
    try {
      const response = await this.apiClient.request('GET', `/admin/bot/users/${targetTelegramId}`);

      if (!response.success) {
        await ctx.reply('❌ Pengguna tidak ditemukan.');
        return;
      }

      const user = response.data;
      const featuresResponse = await this.apiClient.getUserFeatures(targetTelegramId);
      const features = featuresResponse.success ? featuresResponse.data || [] : [];

      const activeFeatures =
        features
          .filter((access: any) => access.feature.isEnabled)
          .map((access: any) => access.feature.name)
          .join(', ') || 'Tidak ada';

      const userInfo = `
👤 *Info Pengguna Detail*

*Informasi Dasar:*
Nama: ${user.name}
Username: ${user.username || 'Tidak ada'}
Telegram ID: \`${user.telegramId}\`
Role: ${user.role === 'ADMIN' ? '👑 ADMIN' : '👤 USER'}
Status: ${user.isActive ? '✅ Aktif' : '❌ Non-aktif'}

*Fitur Tersedia:*
${activeFeatures}

*Detail Akun:*
Terdaftar: ${new Date(user.createdAt).toLocaleDateString('id-ID')}
Update Terakhir: ${new Date(user.updatedAt).toLocaleDateString('id-ID')}
      `;

      await ctx.reply(userInfo, { parse_mode: 'Markdown' });
    } catch (error) {
      this.logger.error('Failed to get user info', {
        error: (error as Error).message,
        targetTelegramId,
      });
      await ctx.reply('❌ Terjadi kesalahan saat mengambil info pengguna.');
    }
  }

  private async handleUsersToggleActive(
    ctx: AdminContext,
    targetTelegramId: string,
    isActive: boolean
  ) {
    try {
      // Prevent self-deactivation
      if (!isActive && targetTelegramId === ctx.from!.id.toString()) {
        await ctx.reply('❌ Anda tidak dapat menonaktifkan akun sendiri.');
        return;
      }

      const response = await this.apiClient.request(
        'PATCH',
        `/admin/bot/users/${targetTelegramId}`,
        {
          isActive,
        }
      );

      if (response.success) {
        const action = isActive ? 'diaktifkan' : 'dinonaktifkan';
        await ctx.reply(`✅ Pengguna dengan ID ${targetTelegramId} berhasil ${action}.`);
        this.logger.info('User status toggled via bot', {
          adminId: ctx.user!.id,
          targetTelegramId,
          isActive,
        });
      } else {
        await ctx.reply(`❌ Gagal mengubah status pengguna: ${response.error || 'Unknown error'}`);
      }
    } catch (error) {
      this.logger.error('Failed to toggle user status', {
        error: (error as Error).message,
        targetTelegramId,
        isActive,
      });
      await ctx.reply('❌ Terjadi kesalahan saat mengubah status pengguna.');
    }
  }

  private async handleUsersRole(ctx: AdminContext, targetTelegramId: string, newRole: string) {
    try {
      const role = newRole.toUpperCase();
      if (role !== 'ADMIN' && role !== 'USER') {
        await ctx.reply('❌ Role harus ADMIN atau USER.');
        return;
      }

      // Prevent self-demotion from admin
      if (role === 'USER' && targetTelegramId === ctx.from!.id.toString()) {
        await ctx.reply('❌ Anda tidak dapat mengubah role sendiri menjadi USER.');
        return;
      }

      const response = await this.apiClient.request(
        'PATCH',
        `/admin/bot/users/${targetTelegramId}`,
        {
          role,
        }
      );

      if (response.success) {
        const roleDisplay = role === 'ADMIN' ? '👑 ADMIN' : '👤 USER';
        await ctx.reply(
          `✅ Role pengguna dengan ID ${targetTelegramId} berhasil diubah menjadi ${roleDisplay}.`
        );
        this.logger.info('User role changed via bot', {
          adminId: ctx.user!.id,
          targetTelegramId,
          newRole: role,
        });
      } else {
        await ctx.reply(`❌ Gagal mengubah role pengguna: ${response.error || 'Unknown error'}`);
      }
    } catch (error) {
      this.logger.error('Failed to change user role', {
        error: (error as Error).message,
        targetTelegramId,
        newRole,
      });
      await ctx.reply('❌ Terjadi kesalahan saat mengubah role pengguna.');
    }
  }

  private async handleFeaturesList(ctx: AdminContext) {
    try {
      const response = await this.apiClient.request('GET', '/admin/bot/features');
      if (!response.success) {
        await ctx.reply('❌ Gagal mengambil daftar fitur.');
        return;
      }

      const features = response.data || [];
      if (features.length === 0) {
        await ctx.reply('📝 Belum ada fitur terdaftar.');
        return;
      }

      let featuresList = '⚙️ *Status Fitur Sistem*\n\n';

      features.forEach((feature: any, index: number) => {
        const status = feature.isEnabled ? '✅ Aktif' : '❌ Non-aktif';
        const icon = this.getFeatureIcon(feature.name);

        featuresList += `${index + 1}. ${icon} **${feature.name.toUpperCase()}**\n`;
        featuresList += `   Status: ${status}\n`;
        featuresList += `   Deskripsi: ${feature.description}\n`;
        if (feature.supportedFormats && feature.supportedFormats.length > 0) {
          featuresList += `   Format: ${feature.supportedFormats.join(', ')}\n`;
        }
        featuresList += '\n';
      });

      await ctx.reply(featuresList, { parse_mode: 'Markdown' });
    } catch (error) {
      this.logger.error('Failed to get features list', { error: (error as Error).message });
      await ctx.reply('❌ Terjadi kesalahan saat mengambil daftar fitur.');
    }
  }

  private async handleFeaturesToggle(ctx: AdminContext, featureName: string, isEnabled: boolean) {
    try {
      const response = await this.apiClient.request('PATCH', `/admin/bot/features/${featureName}`, {
        isEnabled,
      });

      if (response.success) {
        const action = isEnabled ? 'diaktifkan' : 'dinonaktifkan';
        const icon = this.getFeatureIcon(featureName);
        await ctx.reply(`✅ Fitur ${icon} **${featureName.toUpperCase()}** berhasil ${action}.`, {
          parse_mode: 'Markdown',
        });
        this.logger.info('Feature toggled via bot', {
          adminId: ctx.user!.id,
          featureName,
          isEnabled,
        });
      } else {
        await ctx.reply(
          `❌ Gagal mengubah status fitur: ${response.error || 'Fitur tidak ditemukan'}`
        );
      }
    } catch (error) {
      this.logger.error('Failed to toggle feature', {
        error: (error as Error).message,
        featureName,
        isEnabled,
      });
      await ctx.reply('❌ Terjadi kesalahan saat mengubah status fitur.');
    }
  }

  private async handleFeaturesGrant(
    ctx: AdminContext,
    telegramId: string,
    featureName: string,
    grant: boolean
  ) {
    try {
      const endpoint = grant ? 'grant' : 'revoke';
      const response = await this.apiClient.request('POST', `/admin/bot/features/${endpoint}`, {
        telegramId,
        featureName,
      });

      if (response.success) {
        const action = grant ? 'diberikan' : 'dicabut';
        const icon = this.getFeatureIcon(featureName);
        await ctx.reply(
          `✅ Akses fitur ${icon} **${featureName.toUpperCase()}** berhasil ${action} untuk pengguna ${telegramId}.`,
          { parse_mode: 'Markdown' }
        );
        this.logger.info('Feature access changed via bot', {
          adminId: ctx.user!.id,
          telegramId,
          featureName,
          grant,
        });
      } else {
        await ctx.reply(`❌ Gagal mengubah akses fitur: ${response.error || 'Unknown error'}`);
      }
    } catch (error) {
      this.logger.error('Failed to change feature access', {
        error: (error as Error).message,
        telegramId,
        featureName,
        grant,
      });
      await ctx.reply('❌ Terjadi kesalahan saat mengubah akses fitur.');
    }
  }

  private async handleFeaturesUser(ctx: AdminContext, telegramId: string) {
    try {
      const featuresResponse = await this.apiClient.getUserFeatures(telegramId);
      if (!featuresResponse.success) {
        await ctx.reply('❌ Pengguna tidak ditemukan.');
        return;
      }

      const features = featuresResponse.data || [];
      if (features.length === 0) {
        await ctx.reply(`📝 Pengguna ${telegramId} belum memiliki akses fitur apapun.`);
        return;
      }

      let userFeatures = `👤 *Fitur Pengguna ${telegramId}*\n\n`;

      features.forEach((access: any, index: number) => {
        const status = access.feature.isEnabled ? '✅' : '❌';
        const icon = this.getFeatureIcon(access.feature.name);

        userFeatures += `${index + 1}. ${icon} **${access.feature.name.toUpperCase()}**\n`;
        userFeatures += `   Status Fitur: ${status} ${access.feature.isEnabled ? 'Aktif' : 'Non-aktif'}\n`;
        userFeatures += `   Diberikan: ${new Date(access.grantedAt).toLocaleDateString('id-ID')}\n\n`;
      });

      await ctx.reply(userFeatures, { parse_mode: 'Markdown' });
    } catch (error) {
      this.logger.error('Failed to get user features', {
        error: (error as Error).message,
        telegramId,
      });
      await ctx.reply('❌ Terjadi kesalahan saat mengambil fitur pengguna.');
    }
  }

  private async handleStatsQuick(ctx: AdminContext) {
    try {
      const [usersResponse, featuresResponse, activitiesResponse] = await Promise.all([
        this.apiClient.request('GET', '/admin/bot/stats/users'),
        this.apiClient.request('GET', '/admin/bot/stats/features'),
        this.apiClient.request('GET', '/admin/bot/stats/activities'),
      ]);

      const userStats = usersResponse.data || {};
      const featureStats = featuresResponse.data || {};
      const activityStats = activitiesResponse.data || {};

      const quickStats = `
📊 *Statistik Sistem (Ringkas)*

*👥 Pengguna:*
Total: ${userStats.totalUsers || 0}
Aktif: ${userStats.activeUsers || 0}
Admin: ${userStats.adminUsers || 0}

*⚙️ Fitur:*
Total: ${featureStats.totalFeatures || 0}
Aktif: ${featureStats.activeFeatures || 0}

*📈 Aktivitas Hari Ini:*
Total: ${activityStats.todayActivities || 0}
Berhasil: ${activityStats.todaySuccess || 0}

🕐 Update: ${new Date().toLocaleString('id-ID')}
      `;

      await ctx.reply(quickStats, { parse_mode: 'Markdown' });
    } catch (error) {
      this.logger.error('Failed to get quick stats', { error: (error as Error).message });
      await ctx.reply('❌ Terjadi kesalahan saat mengambil statistik ringkas.');
    }
  }

  private async handleStatsDetailed(ctx: AdminContext) {
    try {
      const [usersResponse, featuresResponse, activitiesResponse, systemResponse] =
        await Promise.all([
          this.apiClient.request('GET', '/admin/bot/stats/users'),
          this.apiClient.request('GET', '/admin/bot/stats/features'),
          this.apiClient.request('GET', '/admin/bot/stats/activities'),
          this.apiClient.request('GET', '/admin/bot/stats/system'),
        ]);

      const userStats = usersResponse.data || {};
      const featureStats = featuresResponse.data || {};
      const activityStats = activitiesResponse.data || {};
      const systemStats = systemResponse.data || {};

      // Get storage information
      const storageInfo = this.getStorageInfo();

      const detailedStats = `
📊 *Statistik Sistem (Detail)*

*👥 Pengguna:*
• Total Terdaftar: ${userStats.totalUsers || 0}
• Pengguna Aktif: ${userStats.activeUsers || 0}
• Administrator: ${userStats.adminUsers || 0}
• Terdaftar Hari Ini: ${userStats.newUsersToday || 0}

*⚙️ Fitur:*
• Total Fitur: ${featureStats.totalFeatures || 0}
• Fitur Aktif: ${featureStats.activeFeatures || 0}
• Paling Populer: ${featureStats.mostUsedFeature || 'N/A'}

*📈 Aktivitas:*
• Hari Ini: ${activityStats.todayActivities || 0}
• Minggu Ini: ${activityStats.weekActivities || 0}
• Bulan Ini: ${activityStats.monthActivities || 0}
• Success Rate: ${activityStats.successRate || 0}%

*💾 Storage Data:*
• Bot API Data: ${storageInfo.botApiDataSize}
• Bot User Data: ${storageInfo.botUserDataSize}
• Total Bot Storage: ${storageInfo.totalStorageUsed}
• Disk Usage: ${storageInfo.diskUsage}

*🔧 Sistem:*
• Uptime: ${systemStats.uptime || 'N/A'}
• Memory Usage: ${systemStats.memoryUsage || 'N/A'}
• Database Size: ${systemStats.databaseSize || 'N/A'}

🕐 Update: ${new Date().toLocaleString('id-ID')}

Ketik \`/stats quick\` untuk statistik ringkas.
Ketik \`/stats storage\` untuk detail penyimpanan.
      `;

      await ctx.reply(detailedStats, { parse_mode: 'Markdown' });
    } catch (error) {
      this.logger.error('Failed to get detailed stats', { error: (error as Error).message });
      await ctx.reply('❌ Terjadi kesalahan saat mengambil statistik detail.');
    }
  }

  private async handleStatsStorage(ctx: AdminContext) {
    try {
      // Get storage information
      const storageInfo = this.getStorageInfo();

      const storageStats = `
💾 *Detail Penyimpanan Bot*

*📂 Lokasi Data:*
• Bot API Path: \`${storageInfo.botApiDataPath}\`
• Bot User Path: \`${storageInfo.botUserDataPath}\`

*📊 Ukuran Data:*
• Bot API Data: ${storageInfo.botApiDataSize}
• Bot User Data: ${storageInfo.botUserDataSize}
• **Total Storage:** ${storageInfo.totalStorageUsed}

*💽 Disk Space:*
• Disk Usage: ${storageInfo.diskUsage}

*⚠️ Monitoring Tips:*
• Pastikan storage tidak melebihi 80% kapasitas disk
• File lama akan dihapus otomatis setiap 24 jam
• Untuk cleanup manual, hubungi administrator server

🕐 Update: ${new Date().toLocaleString('id-ID')}

Gunakan \`/stats\` untuk statistik lengkap.
      `;

      await ctx.reply(storageStats, { parse_mode: 'Markdown' });
    } catch (error) {
      this.logger.error('Failed to get storage stats', { error: (error as Error).message });
      await ctx.reply('❌ Terjadi kesalahan saat mengambil statistik storage.');
    }
  }

  private async handleBroadcastSend(ctx: AdminContext, message: string) {
    try {
      // First, get all active users
      const usersResponse = await this.apiClient.request('GET', '/admin/bot/users?active=true');
      if (!usersResponse.success) {
        await ctx.reply('❌ Gagal mengambil daftar pengguna untuk broadcast.');
        return;
      }

      const activeUsers = usersResponse.data || [];
      if (activeUsers.length === 0) {
        await ctx.reply('📝 Tidak ada pengguna aktif untuk menerima broadcast.');
        return;
      }

      await ctx.reply('⏳ Mengirim broadcast...');

      let successCount = 0;
      let failCount = 0;

      const broadcastMessage = `
📢 *Pesan dari Administrator*

${message}

---
TeleWeb Bot System
      `;

      // Send to all users (in batches to avoid rate limiting)
      for (const user of activeUsers) {
        try {
          await ctx.telegram.sendMessage(parseInt(user.telegramId), broadcastMessage, {
            parse_mode: 'Markdown',
          });
          successCount++;

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (sendError) {
          failCount++;
          this.logger.warn('Failed to send broadcast to user', {
            userId: user.telegramId,
            error: (sendError as Error).message,
          });
        }
      }

      // Send result summary
      const resultText = `
✅ *Broadcast Selesai*

📊 **Hasil Pengiriman:**
• Berhasil: ${successCount}
• Gagal: ${failCount}
• Total Target: ${activeUsers.length}

${failCount > 0 ? '\n⚠️ Beberapa pengguna mungkin tidak menerima pesan (akun tidak aktif atau memblokir bot).' : ''}
      `;

      await ctx.reply(resultText, { parse_mode: 'Markdown' });

      this.logger.info('Broadcast completed', {
        adminId: ctx.user!.id,
        message,
        successCount,
        failCount,
        totalUsers: activeUsers.length,
      });
    } catch (error) {
      this.logger.error('Failed to send broadcast', { error: (error as Error).message, message });
      await ctx.reply('❌ Terjadi kesalahan saat mengirim broadcast.');
    }
  }

  private getFeatureIcon(featureName: string): string {
    const icons: { [key: string]: string } = {
      ocr: '📄',
      archive: '📦',
      location: '📍',
      geotags: '🏷️',
      kml: '🗺️',
      workbook: '📊',
    };
    return icons[featureName.toLowerCase()] || '⚙️';
  }

  /**
   * Get storage information for monitoring disk usage
   */
  private getStorageInfo(): {
    botApiDataPath: string;
    botApiDataSize: string;
    botUserDataPath: string;
    botUserDataSize: string;
    totalStorageUsed: string;
    diskUsage: string;
  } {
    try {
      // Get BOT_API_DATA_PATH from environment or use default
      const botApiDataPath =
        process.env.BOT_API_DATA_PATH || path.join(process.cwd(), 'data-bot-user');
      const botUserDataPath = path.join(process.cwd(), 'data-bot-user');

      // Get directory sizes
      let botApiDataSize = 'N/A';
      let botUserDataSize = 'N/A';
      let totalStorageUsed = 'N/A';
      let diskUsage = 'N/A';

      try {
        // Get BOT_API_DATA_PATH size
        const botApiSizeResult = execSync(`du -sh "${botApiDataPath}" 2>/dev/null | cut -f1`, {
          encoding: 'utf8',
        }).trim();
        botApiDataSize = botApiSizeResult || '0B';
      } catch (error) {
        this.logger.warn('Failed to get BOT_API_DATA_PATH size', {
          path: botApiDataPath,
          error: (error as Error).message,
        });
      }

      try {
        // Get bot user data size
        const botUserSizeResult = execSync(`du -sh "${botUserDataPath}" 2>/dev/null | cut -f1`, {
          encoding: 'utf8',
        }).trim();
        botUserDataSize = botUserSizeResult || '0B';
      } catch (error) {
        this.logger.warn('Failed to get bot user data size', {
          path: botUserDataPath,
          error: (error as Error).message,
        });
      }

      try {
        // Calculate total storage used by both directories
        const totalBytes = execSync(
          `du -sb "${botApiDataPath}" "${botUserDataPath}" 2>/dev/null | awk '{sum += $1} END {print sum}' | numfmt --to=iec-i --suffix=B --format="%.1f"`,
          { encoding: 'utf8' }
        ).trim();
        totalStorageUsed = totalBytes || 'N/A';
      } catch (error) {
        // Fallback calculation
        try {
          const total = execSync(
            `(du -sb "${botApiDataPath}" 2>/dev/null; du -sb "${botUserDataPath}" 2>/dev/null) | awk '{sum += $1} END {printf "%.1fMB", sum/1024/1024}'`,
            { encoding: 'utf8' }
          ).trim();
          totalStorageUsed = total || 'N/A';
        } catch (fallbackError) {
          this.logger.warn('Failed to calculate total storage', {
            error: (fallbackError as Error).message,
          });
        }
      }

      try {
        // Get disk usage for the current directory
        const diskResult = execSync(`df -h . | awk 'NR==2 {print $3 "/" $2 " (" $5 ")"}'`, {
          encoding: 'utf8',
        }).trim();
        diskUsage = diskResult || 'N/A';
      } catch (error) {
        this.logger.warn('Failed to get disk usage', { error: (error as Error).message });
      }

      return {
        botApiDataPath,
        botApiDataSize,
        botUserDataPath,
        botUserDataSize,
        totalStorageUsed,
        diskUsage,
      };
    } catch (error) {
      this.logger.error('Failed to get storage info', { error: (error as Error).message });
      return {
        botApiDataPath: 'N/A',
        botApiDataSize: 'N/A',
        botUserDataPath: 'N/A',
        botUserDataSize: 'N/A',
        totalStorageUsed: 'N/A',
        diskUsage: 'N/A',
      };
    }
  }

  /**
   * Execute bot data reset
   */
  async executeResetDataBot(ctx: AdminContext) {
    try {
      const botToken = process.env.BOT_TOKEN || '';
      const botApiDataPath =
        process.env.BOT_API_DATA_PATH || path.join(process.cwd(), 'data-bot-user');
      const botDataDir = path.join(botApiDataPath, botToken);

      if (!fs.existsSync(botDataDir)) {
        await ctx.reply('❌ Direktori data bot tidak ditemukan.');
        return;
      }

      let deletedCount = 0;
      let errorCount = 0;
      const foldersToDelete = ['documents', 'photos', 'temp'];

      await ctx.reply('⏳ Memulai reset data bot...');

      for (const folder of foldersToDelete) {
        const folderPath = path.join(botDataDir, folder);

        try {
          if (fs.existsSync(folderPath)) {
            // Use rm -rf for thorough deletion
            execSync(`rm -rf "${folderPath}"`, { encoding: 'utf8' });
            // Recreate empty directory
            fs.mkdirSync(folderPath, { recursive: true });
            deletedCount++;
            this.logger.info('Bot data folder reset', { folder: folderPath });
          }
        } catch (error) {
          errorCount++;
          this.logger.error('Failed to reset bot data folder', {
            folder: folderPath,
            error: (error as Error).message,
          });
        }
      }

      const resultText = `
✅ *Reset Data Bot Selesai*

📊 **Hasil:**
• Folder berhasil direset: ${deletedCount}
• Folder gagal direset: ${errorCount}

🗂️ **Folder yang direset:**
${foldersToDelete.map(f => `• ${f}/`).join('\n')}

${errorCount > 0 ? '\n⚠️ Beberapa folder gagal direset. Cek log untuk detail.' : ''}

🕐 Selesai: ${new Date().toLocaleString('id-ID')}
      `;

      await ctx.reply(resultText, { parse_mode: 'Markdown' });

      this.logger.info('Bot data reset completed', {
        adminId: ctx.user!.id,
        deletedCount,
        errorCount,
        botDataDir,
      });
    } catch (error) {
      this.logger.error('Failed to execute bot data reset', {
        error: (error as Error).message,
        adminId: ctx.user!.id,
      });
      await ctx.reply('❌ Terjadi kesalahan saat mereset data bot.');
    }
  }

  /**
   * Execute user data reset
   */
  async executeResetDataUser(ctx: AdminContext, targetUserId: string) {
    try {
      const botApiDataPath =
        process.env.BOT_API_DATA_PATH || path.join(process.cwd(), 'data-bot-user');

      if (targetUserId === 'all') {
        // Reset all user data
        await this.resetAllUserData(ctx, botApiDataPath);
      } else {
        // Reset specific user data
        await this.resetSpecificUserData(ctx, botApiDataPath, targetUserId);
      }
    } catch (error) {
      this.logger.error('Failed to execute user data reset', {
        error: (error as Error).message,
        adminId: ctx.user!.id,
        targetUserId,
      });
      await ctx.reply('❌ Terjadi kesalahan saat mereset data pengguna.');
    }
  }

  private async resetAllUserData(ctx: AdminContext, botApiDataPath: string) {
    try {
      const botToken = process.env.BOT_TOKEN || '';

      if (!fs.existsSync(botApiDataPath)) {
        await ctx.reply('❌ Direktori BOT_API_DATA_PATH tidak ditemukan.');
        return;
      }

      await ctx.reply('⏳ Memulai reset data semua pengguna...');

      const entries = fs.readdirSync(botApiDataPath, { withFileTypes: true });
      let deletedCount = 0;
      let errorCount = 0;

      for (const entry of entries) {
        if (entry.isDirectory() && entry.name !== botToken && /^\d+$/.test(entry.name)) {
          const userDir = path.join(botApiDataPath, entry.name);

          try {
            execSync(`rm -rf "${userDir}"`, { encoding: 'utf8' });
            deletedCount++;
            this.logger.info('User data folder deleted', { userId: entry.name, path: userDir });
          } catch (error) {
            errorCount++;
            this.logger.error('Failed to delete user data folder', {
              userId: entry.name,
              path: userDir,
              error: (error as Error).message,
            });
          }
        }
      }

      const resultText = `
✅ *Reset Data Semua Pengguna Selesai*

📊 **Hasil:**
• Folder pengguna dihapus: ${deletedCount}
• Folder gagal dihapus: ${errorCount}

${errorCount > 0 ? '\n⚠️ Beberapa folder gagal dihapus. Cek log untuk detail.' : ''}

🕐 Selesai: ${new Date().toLocaleString('id-ID')}
      `;

      await ctx.reply(resultText, { parse_mode: 'Markdown' });

      this.logger.info('All user data reset completed', {
        adminId: ctx.user!.id,
        deletedCount,
        errorCount,
      });
    } catch (error) {
      this.logger.error('Failed to reset all user data', { error: (error as Error).message });
      await ctx.reply('❌ Terjadi kesalahan saat mereset data semua pengguna.');
    }
  }

  private async resetSpecificUserData(ctx: AdminContext, botApiDataPath: string, userId: string) {
    try {
      const userDir = path.join(botApiDataPath, userId);

      if (!fs.existsSync(userDir)) {
        await ctx.reply(`❌ Direktori data pengguna ${userId} tidak ditemukan.`);
        return;
      }

      await ctx.reply(`⏳ Mereset data pengguna ${userId}...`);

      try {
        execSync(`rm -rf "${userDir}"`, { encoding: 'utf8' });

        const resultText = `
✅ *Reset Data Pengguna Selesai*

👤 **Pengguna:** ${userId}
📂 **Direktori:** \`${userDir}\`

🗑️ Semua data pengguna berhasil dihapus.

🕐 Selesai: ${new Date().toLocaleString('id-ID')}
        `;

        await ctx.reply(resultText, { parse_mode: 'Markdown' });

        this.logger.info('User data reset completed', {
          adminId: ctx.user!.id,
          targetUserId: userId,
          deletedPath: userDir,
        });
      } catch (error) {
        await ctx.reply(`❌ Gagal menghapus data pengguna ${userId}: ${(error as Error).message}`);
        this.logger.error('Failed to delete user data', {
          userId,
          path: userDir,
          error: (error as Error).message,
        });
      }
    } catch (error) {
      this.logger.error('Failed to reset specific user data', {
        error: (error as Error).message,
        userId,
      });
      await ctx.reply('❌ Terjadi kesalahan saat mereset data pengguna.');
    }
  }
}
