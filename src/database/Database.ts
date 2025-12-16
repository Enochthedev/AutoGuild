
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { Logger } from '../core/Logger';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Define interfaces to match legacy usage
export interface UserStats {
  userId: string;
  platform: string;
  messageCount: number;
  lastActive: Date;
  joinedAt: Date;
}

export interface GuildConfig {
  guildId: string;
  platform: string;
  prefix: string;
  moderationEnabled: boolean;
  welcomeMessage?: string;
  logChannelId?: string;
}

export interface ModerationLog {
  id: number; // Keeping number for back-compat, though DB uses UUID string
  userId: string;
  guildId: string;
  platform: string;
  action: string;
  reason: string;
  moderatorId: string;
  timestamp: Date;
}

export class DatabaseManager {
  public prisma: PrismaClient;
  private logger: Logger;
  private dbPath: string; // Kept for interface compatibility

  constructor(dbPath: string) {
    this.logger = new Logger('Database');
    this.dbPath = dbPath;

    // Prisma 7 runtime connection via Adapter (Required when config file handles URL)
    const connectionString = process.env.DATABASE_URL;
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);

    this.prisma = new PrismaClient({ adapter });

    // Connect eagerly
    this.connect();
  }

  private async connect() {
    try {
      await this.prisma.$connect();
      this.logger.info('Connected to CockroachDB via Prisma');
    } catch (error) {
      this.logger.error('Failed to connect to database', error);
    }
  }

  // ==========================================
  // User Stats Methods
  // Mapped to: Identity model
  // ==========================================
  async trackUserActivity(userId: string, platform: string) {
    try {
      // Upsert Identity
      await this.prisma.identity.upsert({
        where: {
          platform_platformId: {
            platform,
            platformId: userId
          }
        },
        create: {
          platform,
          platformId: userId,
          username: 'Unknown', // Placeholder
          user: {
            create: {
              metadata: { messageCount: 1, lastActive: new Date() }
            }
          }
        },
        update: {
          // We strictly wouldn't store messageCount in Identity in a pure schema,
          // but for compatibility we'll just update the timestamp
          // Real message counting should go to TimescaleDB or similar
          user: {
            update: { updatedAt: new Date() }
          }
        }
      });
    } catch (error) {
      // Silent fail for stats
    }
  }

  async getUserStats(userId: string, platform: string): Promise<UserStats | null> {
    const identity = await this.prisma.identity.findUnique({
      where: {
        platform_platformId: {
          platform,
          platformId: userId
        }
      },
      include: { user: true }
    });

    if (!identity) return null;

    return {
      userId: identity.platformId,
      platform: identity.platform,
      messageCount: (identity.user.metadata as any)?.messageCount || 0,
      lastActive: identity.user.updatedAt,
      joinedAt: identity.createdAt
    };
  }

  // ==========================================
  // Guild Config Methods
  // Mapped to: Guild model
  // ==========================================
  async getGuildConfig(guildId: string, platform: string): Promise<GuildConfig | null> {
    const guild = await this.prisma.guild.findUnique({
      where: {
        platform_platformId: {
          platform,
          platformId: guildId
        }
      }
    });

    if (!guild) return null;

    const config = (guild.config as any) || {};

    return {
      guildId: guild.platformId,
      platform: guild.platform,
      prefix: config.prefix || '!',
      moderationEnabled: config.moderationEnabled !== false,
      welcomeMessage: config.welcomeMessage,
      logChannelId: config.logChannelId
    };
  }

  async setGuildConfig(config: GuildConfig) {
    const configJson = {
      prefix: config.prefix,
      moderationEnabled: config.moderationEnabled,
      welcomeMessage: config.welcomeMessage,
      logChannelId: config.logChannelId
    };

    await this.prisma.guild.upsert({
      where: {
        platform_platformId: {
          platform: config.platform,
          platformId: config.guildId
        }
      },
      create: {
        id: crypto.randomUUID(),
        platform: config.platform,
        platformId: config.guildId,
        config: configJson,
        name: 'Auto-Created Guild'
      },
      update: {
        config: configJson
      }
    });
  }

  // ==========================================
  // Moderation Methods
  // Mapped to: ModerationLog model
  // ==========================================
  async logModeration(log: Omit<ModerationLog, 'id'>) {
    // Ensure target user exists first (simple check)
    // In real prod, we'd want proper foreign keys, but this is a bridge

    // Create phantom user if missing for FK constraint
    // await this.ensurePhantomUser(log.userId);

    await this.prisma.moderationLog.create({
      data: {
        action: log.action,
        reason: log.reason,
        // targetUserId handled by relation
        timestamp: log.timestamp,
        moderatorId: log.moderatorId,
        targetUser: {
          connectOrCreate: {
            where: { id: log.userId },
            create: { id: log.userId }
          }
        }
      }
    });
  }

  // ==========================================
  // Key-Value Store Methods
  // Mapped to: KeyValue model
  // ==========================================
  async set(key: string, value: any, guildId?: string) {
    await this.prisma.keyValue.upsert({
      where: { key },
      create: {
        key,
        value: JSON.stringify(value),
        guildId
      },
      update: {
        value: JSON.stringify(value),
        guildId
      }
    });
  }

  async get(key: string, guildId?: string): Promise<any | null> {
    const row = await this.prisma.keyValue.findUnique({
      where: { key }
    });

    if (!row) return null;

    // Optional guildId check
    if (guildId && row.guildId && row.guildId !== guildId) {
      return null;
    }

    try {
      return JSON.parse(row.value);
    } catch {
      return null;
    }
  }

  async delete(key: string, guildId?: string) {
    try {
      // Check guildId match if provided
      if (guildId) {
        const item = await this.prisma.keyValue.findUnique({ where: { key } });
        if (item && item.guildId !== guildId) return;
      }

      await this.prisma.keyValue.delete({
        where: { key }
      });
    } catch (e) {
      // Ignore not found
    }
  }

  // ==========================================
  // Legacy / Stubbed Methods
  // ==========================================

  async createBackup(): Promise<string> {
    this.logger.warn('Backups are now managed by CockroachDB cloud/cluster, not locally.');
    return '';
  }

  async restoreBackup(): Promise<void> {
    this.logger.warn('Restore must be done via CockroachDB CLI.');
  }

  listBackups(): string[] {
    return [];
  }

  async vacuum(): Promise<void> {
    // No-op for Postgres/Cockroach
  }

  async getStats(): Promise<any> {
    // Quick approximation
    const users = await this.prisma.user.count();
    const guilds = await this.prisma.guild.count();
    return { users, guilds, dbType: 'CockroachDB/Prisma' };
  }

  async close() {
    await this.prisma.$disconnect();
  }
}
