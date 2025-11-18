import { EventEmitter } from 'events';
import { Logger } from './Logger';
import { DatabaseManager } from '../database/Database';
import { AIManager } from '../ai/AIProvider';
import { RateLimiter } from './RateLimiter';
import { RetryHandler } from './RetryHandler';
import {
  Platform,
  PlatformAdapter,
  UniversalMessage,
  BotCommand,
  CommandContext,
  Plugin,
  AIProviderConfig,
} from '../types';
import { DiscordAdapter } from '../adapters/DiscordAdapter';
import { WhatsAppAdapter } from '../adapters/WhatsAppAdapter';
import { TelegramAdapter } from '../adapters/TelegramAdapter';
import { SlackAdapter } from '../adapters/SlackAdapter';
import dotenv from 'dotenv';

dotenv.config();

export class BotCore extends EventEmitter {
  private logger: Logger;
  private adapters: Map<Platform, PlatformAdapter>;
  private commands: Map<string, BotCommand>;
  private plugins: Plugin[];
  private database: DatabaseManager;
  private aiManager?: AIManager;
  private commandPrefix: string;
  private rateLimiter: RateLimiter;
  private retryHandler: RetryHandler;

  constructor() {
    super();
    this.logger = new Logger('BotCore');
    this.adapters = new Map();
    this.commands = new Map();
    this.plugins = [];
    this.commandPrefix = process.env.COMMAND_PREFIX || '!';

    // Initialize rate limiter
    const rateLimitEnabled = process.env.RATE_LIMIT_ENABLED !== 'false';
    const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000');
    const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '10');
    this.rateLimiter = new RateLimiter(windowMs, maxRequests, rateLimitEnabled);

    // Initialize retry handler
    this.retryHandler = new RetryHandler();

    // Initialize database
    const dbPath = process.env.DATABASE_PATH || './data/autoguild.db';
    this.database = new DatabaseManager(dbPath);

    // Initialize AI if configured
    if (process.env.AI_PROVIDER && (process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY)) {
      this.initializeAI();
    }

    this.setupEventHandlers();
  }

  private initializeAI() {
    const provider = process.env.AI_PROVIDER as 'openai' | 'anthropic';
    const apiKey =
      provider === 'openai' ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY;
    const model =
      provider === 'openai'
        ? process.env.OPENAI_MODEL || 'gpt-4-turbo-preview'
        : process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';

    if (!apiKey) {
      this.logger.warn('AI provider configured but no API key found');
      return;
    }

    const config: AIProviderConfig = {
      provider,
      apiKey,
      model,
      temperature: 0.7,
      maxTokens: 1000,
    };

    this.aiManager = new AIManager(config);
    this.logger.info(`AI integration initialized with ${provider}`);
  }

  private setupEventHandlers() {
    this.on('message', async (message: UniversalMessage) => {
      try {
        // Track user activity
        this.database.trackUserActivity(message.author.id, message.platform);

        // Process commands
        if (message.content.startsWith(this.commandPrefix)) {
          await this.handleCommand(message);
        }

        // Notify plugins
        for (const plugin of this.plugins) {
          if (plugin.onMessage) {
            await plugin.onMessage(message);
          }
        }

        // Auto-response with AI (if enabled)
        if (
          this.aiManager &&
          process.env.ENABLE_AUTO_RESPONSES === 'true' &&
          message.content.toLowerCase().includes('autoguild')
        ) {
          await this.handleAIResponse(message);
        }
      } catch (error) {
        this.logger.error('Error handling message', error);
      }
    });

    this.on('platform:ready', (platform: Platform) => {
      this.logger.info(`Platform ${platform} is ready`);
    });
  }

  private async handleCommand(message: UniversalMessage) {
    const args = message.content.slice(this.commandPrefix.length).trim().split(/\s+/);
    const commandName = args.shift()?.toLowerCase();

    if (!commandName) return;

    const command = this.commands.get(commandName);
    if (!command) {
      // Check aliases
      for (const [, cmd] of this.commands) {
        if (cmd.aliases?.includes(commandName)) {
          await this.executeCommand(cmd, message, args);
          return;
        }
      }
      return;
    }

    await this.executeCommand(command, message, args);
  }

  private async executeCommand(command: BotCommand, message: UniversalMessage, args: string[]) {
    const startTime = Date.now();

    try {
      // Check platform compatibility
      if (command.platforms && !command.platforms.includes(message.platform)) {
        return;
      }

      // Check permissions
      if (command.permissions) {
        const hasPermission = command.permissions.some((role) =>
          message.author.roles.includes(role)
        );
        if (!hasPermission) {
          const adapter = this.adapters.get(message.platform);
          await adapter?.sendMessage(
            message.channelId,
            'You do not have permission to use this command.'
          );
          return;
        }
      }

      // Check rate limit
      const rateLimitKey = `${message.author.id}:${command.name}`;
      if (this.rateLimiter.isRateLimited(rateLimitKey)) {
        const resetTime = this.rateLimiter.getResetTime(rateLimitKey);
        const adapter = this.adapters.get(message.platform);
        await adapter?.sendMessage(
          message.channelId,
          `⏱️ Please wait ${resetTime} seconds before using this command again.`
        );
        return;
      }

      // Track command usage
      this.database.trackCommand(
        command.name,
        message.author.id,
        message.platform,
        message.guildId
      );

      const channel = await this.adapters.get(message.platform)?.getChannel(message.channelId);
      const guild = message.guildId
        ? await this.adapters.get(message.platform)?.getGuild(message.guildId)
        : undefined;

      const context: CommandContext = {
        message,
        args,
        channel: channel!,
        guild,
        platform: message.platform,
      };

      await command.execute(context);

      // Track metrics if available
      const duration = Date.now() - startTime;
      if ((this as any).metrics) {
        (this as any).metrics.trackCommand(command.name, duration, true);
      }
    } catch (error) {
      this.logger.error(`Error executing command ${command.name}`, error);

      // Track metrics if available
      const duration = Date.now() - startTime;
      if ((this as any).metrics) {
        (this as any).metrics.trackCommand(command.name, duration, false);
        (this as any).metrics.trackError('command_execution');
      }

      const adapter = this.adapters.get(message.platform);
      await adapter?.sendMessage(message.channelId, 'An error occurred while executing the command.');
    }
  }

  private async handleAIResponse(message: UniversalMessage) {
    if (!this.aiManager) return;

    try {
      const adapter = this.adapters.get(message.platform);
      const response = await this.aiManager.generateEngagementResponse(
        'You are in a community chat.',
        message.content
      );

      await adapter?.sendMessage(message.channelId, response);
    } catch (error) {
      this.logger.error('Error generating AI response', error);
    }
  }

  async addPlatform(platform: Platform, config?: any) {
    let adapter: PlatformAdapter;

    switch (platform) {
      case Platform.DISCORD:
        if (!process.env.DISCORD_TOKEN) {
          throw new Error('Discord token not found in environment variables');
        }
        adapter = new DiscordAdapter(process.env.DISCORD_TOKEN, this);
        break;

      case Platform.WHATSAPP:
        if (process.env.WHATSAPP_ENABLED !== 'true') {
          this.logger.warn('WhatsApp is not enabled in configuration');
          return;
        }
        adapter = new WhatsAppAdapter(this);
        break;

      case Platform.TELEGRAM:
        if (!process.env.TELEGRAM_TOKEN) {
          throw new Error('Telegram token not found in environment variables');
        }
        adapter = new TelegramAdapter(process.env.TELEGRAM_TOKEN, this);
        break;

      case Platform.SLACK:
        if (!process.env.SLACK_TOKEN) {
          throw new Error('Slack token not found in environment variables');
        }
        adapter = new SlackAdapter(process.env.SLACK_TOKEN, this);
        break;

      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }

    this.adapters.set(platform, adapter);

    // Use retry handler for platform initialization
    await this.retryHandler.executeWithRetry(
      () => adapter.initialize(),
      {},
      `${platform} initialization`
    );

    this.logger.info(`Platform ${platform} added successfully`);
  }

  registerCommand(command: BotCommand) {
    this.commands.set(command.name, command);
    this.logger.info(`Command registered: ${command.name}`);
  }

  async loadPlugin(plugin: Plugin) {
    try {
      await plugin.initialize({
        bot: this,
        logger: this.logger,
        config: process.env,
        database: this.database,
      });

      if (plugin.commands) {
        for (const command of plugin.commands) {
          this.registerCommand(command);
        }
      }

      this.plugins.push(plugin);
      this.logger.info(`Plugin loaded: ${plugin.name} v${plugin.version}`);
    } catch (error) {
      this.logger.error(`Failed to load plugin ${plugin.name}`, error);
    }
  }

  getAdapter(platform: Platform): PlatformAdapter | undefined {
    return this.adapters.get(platform);
  }

  getDatabase(): DatabaseManager {
    return this.database;
  }

  getAI(): AIManager | undefined {
    return this.aiManager;
  }

  async shutdown() {
    this.logger.info('Shutting down AutoGuild...');

    // Shutdown plugins
    for (const plugin of this.plugins) {
      if (plugin.shutdown) {
        await plugin.shutdown();
      }
    }

    // Shutdown adapters
    for (const [platform, adapter] of this.adapters) {
      this.logger.info(`Shutting down ${platform} adapter`);
      await adapter.shutdown();
    }

    // Close database
    this.database.close();

    this.logger.info('AutoGuild shut down successfully');
  }
}
