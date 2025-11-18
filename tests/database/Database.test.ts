import { DatabaseManager } from '../../src/database/Database';
import { Platform, UserRole } from '../../src/types';
import fs from 'fs';
import path from 'path';

describe('DatabaseManager', () => {
  let db: DatabaseManager;
  const testDbPath = path.join(__dirname, '../test.db');

  beforeEach(() => {
    // Remove test database if it exists
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    db = new DatabaseManager(testDbPath);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('User Stats', () => {
    it('should track user activity', () => {
      db.trackUserActivity('user1', Platform.DISCORD);
      const stats = db.getUserStats('user1', Platform.DISCORD);

      expect(stats).toBeDefined();
      expect(stats?.userId).toBe('user1');
      expect(stats?.platform).toBe(Platform.DISCORD);
      expect(stats?.messageCount).toBe(1);
    });

    it('should increment message count on repeated activity', () => {
      db.trackUserActivity('user1', Platform.DISCORD);
      db.trackUserActivity('user1', Platform.DISCORD);
      db.trackUserActivity('user1', Platform.DISCORD);

      const stats = db.getUserStats('user1', Platform.DISCORD);
      expect(stats?.messageCount).toBe(3);
    });

    it('should return null for non-existent user', () => {
      const stats = db.getUserStats('nonexistent', Platform.DISCORD);
      expect(stats).toBeNull();
    });

    it('should get top active users', () => {
      db.trackUserActivity('user1', Platform.DISCORD);
      db.trackUserActivity('user1', Platform.DISCORD);
      db.trackUserActivity('user2', Platform.DISCORD);
      db.trackUserActivity('user2', Platform.DISCORD);
      db.trackUserActivity('user2', Platform.DISCORD);
      db.trackUserActivity('user3', Platform.DISCORD);

      const topUsers = db.getTopActiveUsers(Platform.DISCORD, 2);
      expect(topUsers).toHaveLength(2);
      expect(topUsers[0].userId).toBe('user2');
      expect(topUsers[0].messageCount).toBe(3);
      expect(topUsers[1].userId).toBe('user1');
      expect(topUsers[1].messageCount).toBe(2);
    });
  });

  describe('Guild Configuration', () => {
    it('should set and get guild config', () => {
      const config = {
        guildId: 'guild1',
        platform: Platform.DISCORD,
        prefix: '!',
        moderationEnabled: true,
        welcomeMessage: 'Welcome!',
        logChannelId: 'channel1',
      };

      db.setGuildConfig(config);
      const retrieved = db.getGuildConfig('guild1', Platform.DISCORD);

      expect(retrieved).toBeDefined();
      expect(retrieved?.prefix).toBe('!');
      expect(retrieved?.moderationEnabled).toBe(true);
      expect(retrieved?.welcomeMessage).toBe('Welcome!');
    });

    it('should update existing guild config', () => {
      const config = {
        guildId: 'guild1',
        platform: Platform.DISCORD,
        prefix: '!',
        moderationEnabled: true,
      };

      db.setGuildConfig(config);

      config.prefix = '$';
      db.setGuildConfig(config);

      const retrieved = db.getGuildConfig('guild1', Platform.DISCORD);
      expect(retrieved?.prefix).toBe('$');
    });

    it('should return null for non-existent guild', () => {
      const config = db.getGuildConfig('nonexistent', Platform.DISCORD);
      expect(config).toBeNull();
    });
  });

  describe('Moderation Logs', () => {
    it('should log moderation actions', () => {
      const log = {
        userId: 'user1',
        guildId: 'guild1',
        platform: Platform.DISCORD,
        action: 'warned',
        reason: 'Spam',
        moderatorId: 'mod1',
        timestamp: new Date(),
      };

      db.logModeration(log);
      const logs = db.getModerationLogs('guild1', Platform.DISCORD);

      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe('warned');
      expect(logs[0].reason).toBe('Spam');
    });

    it('should retrieve limited number of logs', () => {
      for (let i = 0; i < 10; i++) {
        db.logModeration({
          userId: `user${i}`,
          guildId: 'guild1',
          platform: Platform.DISCORD,
          action: 'warned',
          reason: 'Test',
          moderatorId: 'mod1',
          timestamp: new Date(),
        });
      }

      const logs = db.getModerationLogs('guild1', Platform.DISCORD, 5);
      expect(logs).toHaveLength(5);
    });
  });

  describe('Command Tracking', () => {
    it('should track command usage', () => {
      db.trackCommand('help', 'user1', Platform.DISCORD, 'guild1');
      db.trackCommand('ping', 'user1', Platform.DISCORD, 'guild1');
      db.trackCommand('help', 'user2', Platform.DISCORD, 'guild1');

      const stats = db.getCommandStats(10);
      expect(stats.length).toBeGreaterThan(0);

      const helpCommand = stats.find((s: any) => s.commandName === 'help');
      expect(helpCommand.count).toBe(2);
    });
  });

  describe('Analytics', () => {
    it('should track metrics', () => {
      db.trackMetric('guild1', Platform.DISCORD, 'message_count', 1);
      db.trackMetric('guild1', Platform.DISCORD, 'message_count', 1);
      db.trackMetric('guild1', Platform.DISCORD, 'user_join', 1);

      // Metrics are tracked, no direct getter but we can verify no errors
      expect(true).toBe(true);
    });
  });
});
