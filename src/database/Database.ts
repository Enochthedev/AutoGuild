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

  // Backup and Restore Methods
  async createBackup(backupPath?: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultBackupPath = path.join(
      path.dirname(this.db.name),
      'backups',
      `backup-${timestamp}.db`
    );
    const finalBackupPath = backupPath || defaultBackupPath;

    // Ensure backup directory exists
    const backupDir = path.dirname(finalBackupPath);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    try {
      // Use SQLite backup API
      await this.db.backup(finalBackupPath);
      this.logger.info(`Database backup created at ${finalBackupPath}`);
      return finalBackupPath;
    } catch (error) {
      this.logger.error('Failed to create database backup', error);
      throw error;
    }
  }

  async restoreBackup(backupPath: string): Promise<void> {
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }

    try {
      // Close current database
      this.db.close();

      // Copy backup to current database location
      const dbPath = this.db.name;
      fs.copyFileSync(backupPath, dbPath);

      // Reopen database
      this.db = new Database(dbPath);
      this.db.pragma('journal_mode = WAL');

      this.logger.info(`Database restored from ${backupPath}`);
    } catch (error) {
      this.logger.error('Failed to restore database backup', error);
      throw error;
    }
  }

  listBackups(): string[] {
    const backupDir = path.join(path.dirname(this.db.name), 'backups');
    if (!fs.existsSync(backupDir)) {
      return [];
    }

    return fs
      .readdirSync(backupDir)
      .filter((file) => file.endsWith('.db'))
      .map((file) => path.join(backupDir, file))
      .sort()
      .reverse();
  }

  async vacuum(): Promise<void> {
    try {
      this.db.exec('VACUUM');
      this.logger.info('Database vacuumed successfully');
    } catch (error) {
      this.logger.error('Failed to vacuum database', error);
      throw error;
    }
  }

  getStats(): any {
    const stats: any = {};

    // Get table sizes
    const tables = ['user_stats', 'guild_config', 'moderation_logs', 'analytics', 'command_usage'];
    for (const table of tables) {
      const result: any = this.db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
      stats[table] = result.count;
    }

    // Get database file size
    const dbPath = this.db.name;
    if (fs.existsSync(dbPath)) {
      stats.fileSize = fs.statSync(dbPath).size;
      stats.fileSizeMB = (stats.fileSize / (1024 * 1024)).toFixed(2);
    }

    return stats;
  }

  close() {
    this.db.close();
    this.logger.info('Database connection closed');
  }
}
