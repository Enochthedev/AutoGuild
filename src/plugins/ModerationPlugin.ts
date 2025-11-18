import { Plugin, PluginContext, UniversalMessage, CommandContext, UserRole } from '../types';

export class ModerationPlugin implements Plugin {
  name = 'ModerationPlugin';
  version = '1.0.0';
  description = 'Automated content moderation and management';

  private context!: PluginContext;

  async initialize(context: PluginContext): Promise<void> {
    this.context = context;
    this.context.logger.info('Moderation plugin initialized');
  }

  async onMessage(message: UniversalMessage): Promise<void> {
    if (process.env.ENABLE_MODERATION !== 'true') return;
    if (message.author.isBot) return;

    const ai = this.context.bot.getAI();
    if (!ai) return;

    try {
      const moderation = await ai.moderateContent(message.content);

      if (moderation.flagged) {
        const adapter = this.context.bot.getAdapter(message.platform);

        // Delete the message
        await adapter?.deleteMessage(message.channelId, message.id);

        // Log the moderation action
        if (message.guildId) {
          this.context.database.logModeration({
            userId: message.author.id,
            guildId: message.guildId,
            platform: message.platform,
            action: 'message_deleted',
            reason: moderation.reason || 'Inappropriate content',
            moderatorId: 'system',
            timestamp: new Date(),
          });
        }

        // Send warning to user
        await adapter?.sendMessage(
          message.channelId,
          `⚠️ Message removed: ${moderation.reason || 'Inappropriate content'}`
        );

        this.context.logger.info(`Moderated message from ${message.author.username}: ${moderation.reason}`);
      }
    } catch (error) {
      this.context.logger.error('Error in moderation', error);
    }
  }

  commands = [
    {
      name: 'warn',
      description: 'Warn a user',
      usage: '!warn @user <reason>',
      permissions: [UserRole.MODERATOR, UserRole.ADMIN],
      execute: async (ctx: CommandContext) => {
        if (ctx.args.length < 2) {
          const adapter = this.context.bot.getAdapter(ctx.platform);
          await adapter?.sendMessage(ctx.channel.id, 'Usage: !warn @user <reason>');
          return;
        }

        const userId = ctx.args[0];
        const reason = ctx.args.slice(1).join(' ');

        if (ctx.guild) {
          this.context.database.logModeration({
            userId,
            guildId: ctx.guild.id,
            platform: ctx.platform,
            action: 'warned',
            reason,
            moderatorId: ctx.message.author.id,
            timestamp: new Date(),
          });

          const adapter = this.context.bot.getAdapter(ctx.platform);
          await adapter?.sendMessage(
            ctx.channel.id,
            `✅ User warned for: ${reason}`
          );
        }
      },
    },
    {
      name: 'modlogs',
      description: 'View moderation logs',
      usage: '!modlogs [limit]',
      permissions: [UserRole.MODERATOR, UserRole.ADMIN],
      execute: async (ctx: CommandContext) => {
        if (!ctx.guild) return;

        const limit = parseInt(ctx.args[0]) || 10;
        const logs = this.context.database.getModerationLogs(
          ctx.guild.id,
          ctx.platform,
          limit
        );

        let response = `📋 **Moderation Logs** (Last ${limit})\n\n`;
        for (const log of logs) {
          response += `• ${log.action} - User: ${log.userId}\n  Reason: ${log.reason}\n  By: ${log.moderatorId}\n  Time: ${log.timestamp.toLocaleString()}\n\n`;
        }

        const adapter = this.context.bot.getAdapter(ctx.platform);
        await adapter?.sendMessage(ctx.channel.id, response.trim() || 'No moderation logs found.');
      },
    },
  ];
}
