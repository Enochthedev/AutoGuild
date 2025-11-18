import { Plugin, PluginContext, CommandContext, UserRole } from '../types';

export class CoreCommandsPlugin implements Plugin {
  name = 'CoreCommandsPlugin';
  version = '1.0.0';
  description = 'Essential bot commands and utilities';

  private context!: PluginContext;

  async initialize(context: PluginContext): Promise<void> {
    this.context = context;
    this.context.logger.info('Core commands plugin initialized');
  }

  commands = [
    {
      name: 'help',
      description: 'Display available commands',
      usage: '!help [command]',
      execute: async (ctx: CommandContext) => {
        const commandName = ctx.args[0];

        if (commandName) {
          // Show help for specific command
          const commands = Array.from((this.context.bot as any).commands.values());
          const command = commands.find((cmd: any) => cmd.name === commandName);

          if (!command) {
            const adapter = this.context.bot.getAdapter(ctx.platform);
            await adapter?.sendMessage(ctx.channel.id, `Command '${commandName}' not found.`);
            return;
          }

          const response = `**${command.name}**
${command.description}
${command.usage ? `**Usage:** ${command.usage}` : ''}
${command.aliases ? `**Aliases:** ${command.aliases.join(', ')}` : ''}`;

          const adapter = this.context.bot.getAdapter(ctx.platform);
          await adapter?.sendMessage(ctx.channel.id, response);
        } else {
          // Show all commands
          const commands = Array.from((this.context.bot as any).commands.values());
          let response = '📚 **Available Commands**\n\n';

          for (const command of commands) {
            response += `• **${command.name}** - ${command.description}\n`;
          }

          response += '\nUse `!help <command>` for more information about a specific command.';

          const adapter = this.context.bot.getAdapter(ctx.platform);
          await adapter?.sendMessage(ctx.channel.id, response);
        }
      },
    },
    {
      name: 'ping',
      description: 'Check bot responsiveness',
      execute: async (ctx: CommandContext) => {
        const start = Date.now();
        const adapter = this.context.bot.getAdapter(ctx.platform);
        await adapter?.sendMessage(ctx.channel.id, '🏓 Pong!');
        const latency = Date.now() - start;
        await adapter?.sendMessage(ctx.channel.id, `Latency: ${latency}ms`);
      },
    },
    {
      name: 'about',
      description: 'Information about AutoGuild',
      execute: async (ctx: CommandContext) => {
        const response = `🤖 **AutoGuild** v1.0.0

A universal AI-powered community management bot that works across multiple platforms.

**Features:**
• Multi-platform support (Discord, WhatsApp, and more)
• AI-powered moderation and engagement
• Analytics and activity tracking
• Customizable commands and plugins

**Platforms:** ${Array.from((this.context.bot as any).adapters.keys()).join(', ')}

Built with ❤️ for community managers everywhere.`;

        const adapter = this.context.bot.getAdapter(ctx.platform);
        await adapter?.sendMessage(ctx.channel.id, response);
      },
    },
    {
      name: 'config',
      description: 'View or update bot configuration',
      permissions: [UserRole.ADMIN],
      usage: '!config [prefix <new_prefix>]',
      execute: async (ctx: CommandContext) => {
        if (!ctx.guild) {
          const adapter = this.context.bot.getAdapter(ctx.platform);
          await adapter?.sendMessage(ctx.channel.id, 'This command can only be used in servers/groups.');
          return;
        }

        const adapter = this.context.bot.getAdapter(ctx.platform);

        if (ctx.args.length === 0) {
          // Show current config
          const config = this.context.database.getGuildConfig(ctx.guild.id, ctx.platform);
          const response = `⚙️ **Server Configuration**

**Prefix:** ${config?.prefix || '!'}
**Moderation:** ${config?.moderationEnabled ? 'Enabled' : 'Disabled'}
**Welcome Message:** ${config?.welcomeMessage || 'Not set'}`;

          await adapter?.sendMessage(ctx.channel.id, response);
        } else if (ctx.args[0] === 'prefix' && ctx.args[1]) {
          // Update prefix
          const newPrefix = ctx.args[1];
          const config = this.context.database.getGuildConfig(ctx.guild.id, ctx.platform) || {
            guildId: ctx.guild.id,
            platform: ctx.platform,
            prefix: newPrefix,
            moderationEnabled: true,
          };

          config.prefix = newPrefix;
          this.context.database.setGuildConfig(config);

          await adapter?.sendMessage(
            ctx.channel.id,
            `✅ Command prefix updated to: ${newPrefix}`
          );
        }
      },
    },
  ];
}
