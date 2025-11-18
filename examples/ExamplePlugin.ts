/**
 * Example Custom Plugin Template
 *
 * This is a template for creating custom plugins for AutoGuild.
 * Copy this file and modify it to create your own plugin.
 *
 * Features demonstrated:
 * - Basic plugin structure
 * - Message handling
 * - Commands with permissions
 * - Using AI services
 * - Database operations
 * - Logging
 */

import { Plugin, PluginContext, UniversalMessage, CommandContext, UserRole } from '../src/types';

export class ExamplePlugin implements Plugin {
  // Plugin metadata (required)
  name = 'ExamplePlugin';
  version = '1.0.0';
  description = 'An example plugin demonstrating AutoGuild plugin development';

  // Plugin context (provided by AutoGuild)
  private context!: PluginContext;

  /**
   * Initialize the plugin
   * This is called when the plugin is loaded
   */
  async initialize(context: PluginContext): Promise<void> {
    this.context = context;
    this.context.logger.info('Example plugin initialized!');

    // You can initialize your plugin's state here
    // For example: load configuration, connect to external APIs, etc.
  }

  /**
   * Clean up when plugin is unloaded (optional)
   */
  async shutdown(): Promise<void> {
    this.context.logger.info('Example plugin shutting down...');
    // Clean up resources here
  }

  /**
   * Handle incoming messages (optional)
   * This is called for every message the bot receives
   */
  async onMessage(message: UniversalMessage): Promise<void> {
    // Ignore bot messages
    if (message.author.isBot) return;

    // Example: Log messages containing a specific keyword
    if (message.content.toLowerCase().includes('hello')) {
      this.context.logger.info(`User ${message.author.username} said hello!`);
    }

    // Example: Use AI to analyze message sentiment (if AI is enabled)
    const ai = this.context.bot.getAI();
    if (ai && message.content.includes('?')) {
      // Only respond to questions
      try {
        const response = await ai.generateEngagementResponse(
          'You are a helpful assistant.',
          message.content
        );

        // Send response (optional - be careful not to spam!)
        const adapter = this.context.bot.getAdapter(message.platform);
        if (adapter) {
          // await adapter.sendMessage(message.channelId, response);
        }
      } catch (error) {
        this.context.logger.error('Error generating AI response', error);
      }
    }

    // Example: Track custom metrics in database
    if (message.guildId) {
      this.context.database.trackMetric(
        message.guildId,
        message.platform,
        'example_metric',
        1
      );
    }
  }

  /**
   * Define bot commands
   * These will be automatically registered with the bot
   */
  commands = [
    {
      name: 'example',
      description: 'An example command',
      usage: '!example [arg]',
      aliases: ['ex', 'test'],
      cooldown: 5000, // 5 seconds cooldown
      execute: async (ctx: CommandContext) => {
        const adapter = this.context.bot.getAdapter(ctx.platform);

        if (ctx.args.length === 0) {
          await adapter?.sendMessage(
            ctx.channel.id,
            'Hello! This is an example command. Try: !example <your text>'
          );
          return;
        }

        const userText = ctx.args.join(' ');
        await adapter?.sendMessage(
          ctx.channel.id,
          `You said: ${userText}`
        );

        // Log command usage
        this.context.logger.info(`User ${ctx.message.author.username} used example command`);
      },
    },

    {
      name: 'greet',
      description: 'Greet a user with AI',
      usage: '!greet <username>',
      execute: async (ctx: CommandContext) => {
        const adapter = this.context.bot.getAdapter(ctx.platform);
        const ai = this.context.bot.getAI();

        if (!ai) {
          await adapter?.sendMessage(
            ctx.channel.id,
            'AI features are not enabled.'
          );
          return;
        }

        const username = ctx.args[0] || ctx.message.author.displayName || ctx.message.author.username;

        try {
          const greeting = await ai.complete(
            `Generate a friendly, creative greeting for a user named ${username}. Keep it short (1-2 sentences).`
          );

          await adapter?.sendMessage(ctx.channel.id, greeting);
        } catch (error) {
          this.context.logger.error('Error generating greeting', error);
          await adapter?.sendMessage(
            ctx.channel.id,
            'Sorry, I couldn\'t generate a greeting right now.'
          );
        }
      },
    },

    {
      name: 'pluginstats',
      description: 'View plugin statistics',
      permissions: [UserRole.ADMIN],
      execute: async (ctx: CommandContext) => {
        const adapter = this.context.bot.getAdapter(ctx.platform);

        // Get database stats
        const db = this.context.database;
        const stats = db.getStats();

        const response = `📊 **Plugin Statistics**

**Database:**
- User stats: ${stats.user_stats || 0}
- Guilds: ${stats.guild_config || 0}
- Mod logs: ${stats.moderation_logs || 0}
- Commands tracked: ${stats.command_usage || 0}
- Database size: ${stats.fileSizeMB || 'N/A'} MB

**Bot:**
- Uptime: ${Math.floor(process.uptime())} seconds
- Memory: ${Math.floor(process.memoryUsage().heapUsed / 1024 / 1024)} MB`;

        await adapter?.sendMessage(ctx.channel.id, response);
      },
    },
  ];
}

/**
 * Usage:
 *
 * 1. Copy this file to your plugins directory
 * 2. Modify the class name, metadata, and functionality
 * 3. Load the plugin in src/index.ts:
 *
 *    import { ExamplePlugin } from './plugins/ExamplePlugin';
 *    await bot.loadPlugin(new ExamplePlugin());
 *
 * 4. Test your plugin commands in Discord/WhatsApp/etc.
 */
