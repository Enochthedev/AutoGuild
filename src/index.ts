import { BotCore } from './core/BotCore';
import { Platform } from './types';
import { ModerationPlugin } from './plugins/ModerationPlugin';
import { AnalyticsPlugin } from './plugins/AnalyticsPlugin';
import { EngagementPlugin } from './plugins/EngagementPlugin';
import { CoreCommandsPlugin } from './plugins/CoreCommandsPlugin';
import { Logger } from './core/Logger';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const logger = new Logger('Main');

async function main() {
  logger.info('Starting AutoGuild...');

  // Ensure logs and data directories exist
  ['logs', 'data'].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  try {
    // Initialize bot core
    const bot = new BotCore();

    // Load plugins
    logger.info('Loading plugins...');
    await bot.loadPlugin(new CoreCommandsPlugin());
    await bot.loadPlugin(new ModerationPlugin());
    await bot.loadPlugin(new AnalyticsPlugin());
    await bot.loadPlugin(new EngagementPlugin());

    // Initialize platforms
    logger.info('Initializing platforms...');

    if (process.env.DISCORD_TOKEN) {
      await bot.addPlatform(Platform.DISCORD);
      logger.info('Discord platform initialized');
    } else {
      logger.warn('Discord token not found, skipping Discord initialization');
    }

    if (process.env.WHATSAPP_ENABLED === 'true') {
      await bot.addPlatform(Platform.WHATSAPP);
      logger.info('WhatsApp platform initialized');
    }

    // Check if at least one platform is enabled
    if (bot['adapters'].size === 0) {
      logger.error('No platforms enabled! Please configure at least one platform.');
      process.exit(1);
    }

    logger.info(`AutoGuild is now running with ${bot['adapters'].size} platform(s)!`);
    logger.info('Press Ctrl+C to stop the bot.');

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      await bot.shutdown();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      await bot.shutdown();
      process.exit(0);
    });

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', error);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection at:', { promise, reason });
    });
  } catch (error) {
    logger.error('Failed to start AutoGuild', error);
    process.exit(1);
  }
}

// Start the bot
main();
