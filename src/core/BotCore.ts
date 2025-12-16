import { EventEmitter } from 'events';
import { Logger } from './Logger';
import { DatabaseManager } from '../database/Database';
import { AIManager } from '../ai/AIProvider';
import { RateLimiter } from './RateLimiter';
import { RetryHandler } from './RetryHandler';
import { MemoryManager } from '../memory/MemoryManager';
import { QueueManager } from './QueueManager';
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
import { TeamsAdapter } from '../adapters/TeamsAdapter';
import { MatrixAdapter } from '../adapters/MatrixAdapter';
import { GuildedAdapter } from '../adapters/GuildedAdapter';
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
  private memory: MemoryManager;
  private queueManager: QueueManager;

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
    const dbPath = process.env.DATABASE_PATH || './data/guildly.db';
    this.database = new DatabaseManager(dbPath);

    // Initialize memory system (short-term + long-term)
    // Now powered by the main DatabaseManager (Prisma/CockroachDB)
    this.memory = new MemoryManager(this.database);

    // Initialize Queue System
    this.queueManager = new QueueManager(this);

    // Initialize AI if configured
    if (
      process.env.AI_PROVIDER &&
      (process.env.ANTHROPIC_API_KEY ||
        process.env.OPENAI_API_KEY ||
        process.env.OPENROUTER_API_KEY)
    ) {
      this.initializeAI();
    }

    this.setupEventHandlers();
  }

  private initializeAI() {
    const provider = process.env.AI_PROVIDER as 'openai' | 'anthropic' | 'openrouter';
    let apiKey: string | undefined;
    let model: string;

    switch (provider) {
      case 'openai':
        apiKey = process.env.OPENAI_API_KEY;
        model = process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';
        break;
      case 'anthropic':
        apiKey = process.env.ANTHROPIC_API_KEY;
        model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
        break;
      case 'openrouter':
        apiKey = process.env.OPENROUTER_API_KEY;
        model = process.env.OPENROUTER_MODEL || 'openai/gpt-3.5-turbo';
        break;
      default:
        this.logger.warn(`Unknown AI provider: ${provider}`);
        return;
    }

    if (!apiKey) {
      this.logger.warn(`AI provider ${provider} configured but no API key found`);
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
      // Push to queue instead of processing immediately
      await this.queueManager.addMessage({
        platform: message.platform,
        channelId: message.channelId,
        userId: message.author.id,
        username: message.author.username,
        content: message.content,
        guildId: message.guildId,
        timestamp: message.timestamp.getTime()
      });
    });

    this.on('platform:ready', (platform: Platform) => {
      this.logger.info(`Platform ${platform} is ready`);
    });
  }



  /**
   * Process a message (called by Queue Worker)
   */
  public async processMessage(input: any) {
    // Reconstruct UniversalMessage
    const message: UniversalMessage = {
      id: input.id || 'job-id',
      content: input.content,
      platform: input.platform,
      channelId: input.channelId,
      guildId: input.guildId,
      timestamp: new Date(input.timestamp),
      type: 'text' as any,
      author: {
        id: input.userId,
        username: input.username,
        platform: input.platform,
        platformSpecificId: input.userId,
        isBot: false,
        roles: []
      }
    };

    try {
      // Track user activity
      this.database.trackUserActivity(message.author.id, message.platform);

      // Process commands
      if (message.content.startsWith(this.commandPrefix)) {
        await this.handleCommand(message);
        return;
      }

      // Notify plugins
      for (const plugin of this.plugins) {
        if (plugin.onMessage) {
          await plugin.onMessage(message);
        }
      }

      // Check if bot is mentioned or if it's a DM/reply to bot
      const isMentioned = message.mentions?.some(user => user.isBot && user.id === (this.adapters.get(message.platform) as any)?.client?.user?.id) || message.content.toLowerCase().includes('sox');
      const isDM = message.guildId === undefined;

      // Auto-response with AI
      if (
        this.aiManager &&
        process.env.ENABLE_AUTO_RESPONSES === 'true' &&
        (isMentioned || isDM)
      ) {
        await this.handleAIResponse(message);
      }
    } catch (error) {
      this.logger.error('Error handling message', error);
    }
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
        ? (await this.adapters.get(message.platform)?.getGuild(message.guildId)) || undefined
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

  /**
   * Execute an abstract action generated by AI (Called by Queue Worker)
   */
  public async executeAction(action: { type: string; platform: Platform; params: any }) {
    this.logger.info(`Executing action: ${action.type} on ${action.platform}`, action.params);

    const adapter = this.adapters.get(action.platform);
    if (!adapter) {
      this.logger.error(`No adapter found for platform: ${action.platform}`);
      return;
    }

    // Common params
    const { channelId, guildId } = action.params;

    try {
      switch (action.type) {
        case 'send_message':
          if (channelId && action.params.content) {
            await adapter.sendMessage(channelId, action.params.content);
          }
          break;

        case 'create_channel': {
          if (adapter.createChannel && guildId) {
            const { name, type } = action.params;
            const newChannel = await adapter.createChannel(guildId, name, type || 'text');
            if (newChannel && channelId) {
              await adapter.sendMessage(channelId, `✅ I've created the channel #${newChannel.name} for you!`);
            } else if (channelId) {
              await adapter.sendMessage(channelId, `❌ I tried to create the channel but hit a snag. Check my permissions?`);
            }
          } else if (channelId) {
            await adapter.sendMessage(channelId, "I can't create channels here, sorry!");
          }
          break;
        }

        case 'delete_channel': {
          if (adapter.deleteChannel) {
            const { channel_id } = action.params;
            const targetId = channel_id === 'current_channel' ? channelId : channel_id;

            if (targetId) {
              if (channelId) await adapter.sendMessage(channelId, `🗑️ Deleting channel...`);
              // Slight delay handled by queue delay optionally, or here
              await adapter.deleteChannel(targetId);
            }
          }
          break;
        }

        case 'store_memory': {
          const { key, value } = action.params;
          if (key && value) {
            this.database.set(key, value, guildId);
          }
          break;
        }

        case 'trace_cost': {
          // ... handled by AI Manager internally or here if needed
          break;
        }

        default:
          this.logger.warn(`Unknown action type: ${action.type}`);
      }
    } catch (error) {
      this.logger.error(`Failed to execute action ${action.type}`, error);
      throw error; // Rethrow to let QueueManager handle retry
    }
  }

  private async handleAIResponse(message: UniversalMessage) {
    if (!this.aiManager) return;

    try {
      const adapter = this.adapters.get(message.platform);

      // Add user message to short-term memory
      this.memory.addMessage({
        role: 'user',
        content: message.content,
        author: message.author.username,
        timestamp: Date.now(),
        channelId: message.channelId,
        platform: message.platform,
        guildId: message.guildId,
      });

      // Build context
      const contextString = await this.memory.buildContext(
        message.channelId,
        message.content,
        {
          platform: message.platform,
          guildId: message.guildId,
          channelId: message.channelId,
          userId: message.author.id,
        }
      );

      const result = await this.aiManager.generateAutonomousResponse(
        contextString,
        message.content
      );

      // 1. Send the verbal response (Immediate or Queued? Immediate usually feels better for chat)
      // We'll keep chat response immediate for responsiveness, but actions queued.
      if (result.response) {
        await adapter?.sendMessage(message.channelId, result.response);

        // Add bot's response to short-term memory
        this.memory.addMessage({
          role: 'assistant',
          content: result.response,
          author: 'Sox',
          timestamp: Date.now(),
          channelId: message.channelId,
          platform: message.platform,
          guildId: message.guildId // Fix: Add guildId
        });
      }

      // 2. Queue actions if any
      if (result.actions && result.actions.length > 0) {
        for (const action of result.actions) {
          await this.queueManager.addAction({
            type: action.type,
            platform: message.platform,
            guildId: message.guildId,
            channelId: message.channelId,
            params: {
              ...action.params,
              channelId: message.channelId, // Inject context
              guildId: message.guildId
            }
          });
        }
      }

    } catch (error) {
      this.logger.error('Error generating AI response', error);
      const adapter = this.adapters.get(message.platform);
      await adapter?.sendMessage(message.channelId, "My brain glitched for a second there.");
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

      case Platform.TEAMS:
        if (!process.env.TEAMS_APP_ID || !process.env.TEAMS_APP_PASSWORD) {
          throw new Error('Teams credentials not found in environment variables');
        }
        adapter = new TeamsAdapter(process.env.TEAMS_APP_ID, process.env.TEAMS_APP_PASSWORD, this);
        break;

      case Platform.MATRIX:
        if (!process.env.MATRIX_HOMESERVER || !process.env.MATRIX_ACCESS_TOKEN || !process.env.MATRIX_USER_ID) {
          throw new Error('Matrix credentials not found in environment variables');
        }
        adapter = new MatrixAdapter(
          process.env.MATRIX_HOMESERVER,
          process.env.MATRIX_ACCESS_TOKEN,
          process.env.MATRIX_USER_ID,
          this
        );
        break;

      case Platform.GUILDED:
        if (!process.env.GUILDED_TOKEN) {
          throw new Error('Guilded token not found in environment variables');
        }
        adapter = new GuildedAdapter(process.env.GUILDED_TOKEN, this);
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
    this.logger.info('Shutting down Guildly...');

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

    this.logger.info('Guildly shut down successfully');
  }
}
