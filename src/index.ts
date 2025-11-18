import { BotCore } from './core/BotCore';
import { Platform } from './types';
import { ModerationPlugin } from './plugins/ModerationPlugin';
import { AnalyticsPlugin } from './plugins/AnalyticsPlugin';
import { EngagementPlugin } from './plugins/EngagementPlugin';
import { CoreCommandsPlugin } from './plugins/CoreCommandsPlugin';
import { Logger } from './core/Logger';
import { ConfigValidator } from './core/ConfigValidator';
import { APIServer } from './core/APIServer';
import { WebhookService } from './core/WebhookService';
import { SchedulerService } from './core/SchedulerService';
import { MetricsService } from './core/MetricsService';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const logger = new Logger('Main');
const startTime = new Date();

async function main() {
  logger.info('🚀 Starting AutoGuild...');
  logger.info('='.repeat(50));

  // Ensure required directories exist
  ['logs', 'data', 'data/backups'].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  try {
    // Validate configuration
    logger.info('📋 Validating configuration...');
    const configValidator = new ConfigValidator();
    configValidator.printConfigSummary();

    // Initialize bot core
    logger.info('🤖 Initializing bot core...');
    const bot = new BotCore();

    // Initialize metrics service
    let metricsService: MetricsService | undefined;
    if (process.env.METRICS_ENABLED === 'true') {
      logger.info('📊 Initializing metrics service...');
      metricsService = new MetricsService();
      (bot as any).metrics = metricsService;

      // Update uptime metric periodically
      setInterval(() => {
        metricsService!.updateUptime(startTime);
      }, 10000); // Every 10 seconds
    }

    // Initialize scheduler service
    logger.info('⏰ Initializing scheduler service...');
    const scheduler = new SchedulerService();
    scheduler.registerDefaultTasks(bot);
    (bot as any).scheduler = scheduler;

    // Load plugins
    logger.info('🔌 Loading plugins...');
    await bot.loadPlugin(new CoreCommandsPlugin());
    await bot.loadPlugin(new ModerationPlugin());
    await bot.loadPlugin(new AnalyticsPlugin());
    await bot.loadPlugin(new EngagementPlugin());
    logger.info(`✅ Loaded ${(bot as any).plugins.length} plugins`);

    // Initialize platforms
    logger.info('🌐 Initializing platforms...');
    const config = configValidator.getConfig();

    if (config.DISCORD_TOKEN) {
      try {
        await bot.addPlatform(Platform.DISCORD);
        logger.info('✅ Discord platform initialized');
      } catch (error) {
        logger.error('Failed to initialize Discord', error);
      }
    }

    if (config.WHATSAPP_ENABLED === 'true') {
      try {
        await bot.addPlatform(Platform.WHATSAPP);
        logger.info('✅ WhatsApp platform initialized');
      } catch (error) {
        logger.error('Failed to initialize WhatsApp', error);
      }
    }

    if (config.TELEGRAM_ENABLED === 'true' && config.TELEGRAM_TOKEN) {
      try {
        await bot.addPlatform(Platform.TELEGRAM);
        logger.info('✅ Telegram platform initialized');
      } catch (error) {
        logger.error('Failed to initialize Telegram', error);
      }
    }

    if (config.SLACK_ENABLED === 'true' && config.SLACK_TOKEN) {
      try {
        await bot.addPlatform(Platform.SLACK);
        logger.info('✅ Slack platform initialized');
      } catch (error) {
        logger.error('Failed to initialize Slack', error);
      }
    }

    // Check if at least one platform is enabled
    const platformCount = (bot as any).adapters.size;
    if (platformCount === 0) {
      logger.error('❌ No platforms enabled! Please configure at least one platform.');
      process.exit(1);
    }

    logger.info(`✅ ${platformCount} platform(s) initialized`);

    // Initialize API Server & Dashboard
    let apiServer: APIServer | undefined;
    if (config.DASHBOARD_ENABLED === 'true') {
      logger.info('🌐 Starting API server and dashboard...');
      apiServer = new APIServer(bot);

      // Register metrics endpoint if metrics are enabled
      if (metricsService) {
        metricsService.registerEndpoint(apiServer.getApp());
      }

      const port = parseInt(config.DASHBOARD_PORT);
      await apiServer.start(port);
      logger.info(`✅ Dashboard available at http://localhost:${port}`);
    }

    // Initialize Webhook Service
    let webhookService: WebhookService | undefined;
    if (process.env.WEBHOOK_PORT) {
      logger.info('🔗 Starting webhook service...');
      webhookService = new WebhookService();
      webhookService.registerDefaultWebhooks(bot);
      await webhookService.start(parseInt(process.env.WEBHOOK_PORT));
      logger.info(`✅ Webhooks listening on port ${process.env.WEBHOOK_PORT}`);
    }

    // All systems ready
    logger.info('='.repeat(50));
    logger.info('✅ AutoGuild is now running!');
    logger.info('');
    logger.info('📊 Status:');
    logger.info(`   Platforms: ${platformCount}`);
    logger.info(`   Plugins: ${(bot as any).plugins.length}`);
    logger.info(`   Commands: ${(bot as any).commands.size}`);
    logger.info(`   Dashboard: ${config.DASHBOARD_ENABLED === 'true' ? `http://localhost:${config.DASHBOARD_PORT}` : 'Disabled'}`);
    logger.info(`   Metrics: ${config.METRICS_ENABLED === 'true' ? 'Enabled' : 'Disabled'}`);
    logger.info('');
    logger.info('Press Ctrl+C to stop the bot.');
    logger.info('='.repeat(50));

    // Handle graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info('');
      logger.info(`Received ${signal}, shutting down gracefully...`);

      // Stop scheduler
      if (scheduler) {
        scheduler.stopAll();
      }

      // Stop webhook service
      if (webhookService) {
        await webhookService.stop();
      }

      // Stop API server
      if (apiServer) {
        await apiServer.stop();
      }

      // Shutdown bot
      await bot.shutdown();

      logger.info('✅ AutoGuild shut down successfully');
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', error);
      if (metricsService) {
        metricsService.trackError('uncaught_exception');
      }
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection at:', { promise, reason });
      if (metricsService) {
        metricsService.trackError('unhandled_rejection');
      }
    });

  } catch (error) {
    logger.error('❌ Failed to start AutoGuild', error);
    process.exit(1);
  }
}

// Start the bot
main();
