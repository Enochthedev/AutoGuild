import Database from 'better-sqlite3';
import { Logger } from '../core/Logger';
import path from 'path';
import fs from 'fs';

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
  id: number;
  userId: string;
  guildId: string;
  platform: string;
  action: string;
  reason: string;
  moderatorId: string;
  timestamp: Date;
}

export class DatabaseManager {
  private db: Database.Database;
  private logger: Logger;

  constructor(dbPath: string) {
    this.logger = new Logger('Database');

    // Ensure data directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initializeTables();
    this.logger.info(`Database initialized at ${dbPath}`);
  }

  private initializeTables() {
    // User stats table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_stats (
        userId TEXT NOT NULL,
        platform TEXT NOT NULL,
        messageCount INTEGER DEFAULT 0,
        lastActive INTEGER NOT NULL,
        joinedAt INTEGER NOT NULL,
        PRIMARY KEY (userId, platform)
      )
    `);

    // Guild/Server configuration
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS guild_config (
        guildId TEXT NOT NULL,
        platform TEXT NOT NULL,
        prefix TEXT DEFAULT '!',
        moderationEnabled INTEGER DEFAULT 1,
        welcomeMessage TEXT,
        logChannelId TEXT,
        PRIMARY KEY (guildId, platform)
      )
    `);

    // Moderation logs
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS moderation_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        guildId TEXT NOT NULL,
        platform TEXT NOT NULL,
        action TEXT NOT NULL,
        reason TEXT,
        moderatorId TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      )
    `);

    // Analytics/metrics
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guildId TEXT NOT NULL,
        platform TEXT NOT NULL,
        metricType TEXT NOT NULL,
        metricValue INTEGER NOT NULL,
        timestamp INTEGER NOT NULL
      )
    `);

    // Command usage tracking
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS command_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        commandName TEXT NOT NULL,
        userId TEXT NOT NULL,
        guildId TEXT,
        platform TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      )
    `);
  }

  // User Stats Methods
  trackUserActivity(userId: string, platform: string) {
    const stmt = this.db.prepare(`
      INSERT INTO user_stats (userId, platform, messageCount, lastActive, joinedAt)
      VALUES (?, ?, 1, ?, ?)
      ON CONFLICT(userId, platform) DO UPDATE SET
        messageCount = messageCount + 1,
        lastActive = excluded.lastActive
    `);

    const now = Date.now();
    stmt.run(userId, platform, now, now);
  }

  getUserStats(userId: string, platform: string): UserStats | null {
    const stmt = this.db.prepare(
      'SELECT * FROM user_stats WHERE userId = ? AND platform = ?'
    );
    const row: any = stmt.get(userId, platform);

    if (!row) return null;

    return {
      userId: row.userId,
      platform: row.platform,
      messageCount: row.messageCount,
      lastActive: new Date(row.lastActive),
      joinedAt: new Date(row.joinedAt),
    };
  }

  getTopActiveUsers(platform: string, limit: number = 10): UserStats[] {
    const stmt = this.db.prepare(`
      SELECT * FROM user_stats
      WHERE platform = ?
      ORDER BY messageCount DESC
      LIMIT ?
    `);

    const rows: any[] = stmt.all(platform, limit);
    return rows.map((row) => ({
      userId: row.userId,
      platform: row.platform,
      messageCount: row.messageCount,
      lastActive: new Date(row.lastActive),
      joinedAt: new Date(row.joinedAt),
    }));
  }

  // Guild Config Methods
  getGuildConfig(guildId: string, platform: string): GuildConfig | null {
    const stmt = this.db.prepare(
      'SELECT * FROM guild_config WHERE guildId = ? AND platform = ?'
    );
    const row: any = stmt.get(guildId, platform);

    if (!row) return null;

    return {
      guildId: row.guildId,
      platform: row.platform,
      prefix: row.prefix,
      moderationEnabled: row.moderationEnabled === 1,
      welcomeMessage: row.welcomeMessage,
      logChannelId: row.logChannelId,
    };
  }

  setGuildConfig(config: GuildConfig) {
    const stmt = this.db.prepare(`
      INSERT INTO guild_config (guildId, platform, prefix, moderationEnabled, welcomeMessage, logChannelId)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(guildId, platform) DO UPDATE SET
        prefix = excluded.prefix,
        moderationEnabled = excluded.moderationEnabled,
        welcomeMessage = excluded.welcomeMessage,
        logChannelId = excluded.logChannelId
    `);

    stmt.run(
      config.guildId,
      config.platform,
      config.prefix,
      config.moderationEnabled ? 1 : 0,
      config.welcomeMessage,
      config.logChannelId
    );
  }

  // Moderation Methods
  logModeration(log: Omit<ModerationLog, 'id'>) {
    const stmt = this.db.prepare(`
      INSERT INTO moderation_logs (userId, guildId, platform, action, reason, moderatorId, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      log.userId,
      log.guildId,
      log.platform,
      log.action,
      log.reason,
      log.moderatorId,
      log.timestamp.getTime()
    );
  }

  getModerationLogs(guildId: string, platform: string, limit: number = 50): ModerationLog[] {
    const stmt = this.db.prepare(`
      SELECT * FROM moderation_logs
      WHERE guildId = ? AND platform = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    const rows: any[] = stmt.all(guildId, platform, limit);
    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      guildId: row.guildId,
      platform: row.platform,
      action: row.action,
      reason: row.reason,
      moderatorId: row.moderatorId,
      timestamp: new Date(row.timestamp),
    }));
  }

  // Analytics Methods
  trackMetric(guildId: string, platform: string, metricType: string, value: number) {
    const stmt = this.db.prepare(`
      INSERT INTO analytics (guildId, platform, metricType, metricValue, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(guildId, platform, metricType, value, Date.now());
  }

  // Command Usage Methods
  trackCommand(commandName: string, userId: string, platform: string, guildId?: string) {
    const stmt = this.db.prepare(`
      INSERT INTO command_usage (commandName, userId, guildId, platform, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(commandName, userId, guildId, platform, Date.now());
  }

  getCommandStats(limit: number = 10) {
    const stmt = this.db.prepare(`
      SELECT commandName, COUNT(*) as count
      FROM command_usage
      GROUP BY commandName
      ORDER BY count DESC
      LIMIT ?
    `);

    return stmt.all(limit);
  }

  close() {
    this.db.close();
    this.logger.info('Database connection closed');
  }
}
