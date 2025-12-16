import { Plugin, PluginContext, UniversalMessage, CommandContext, UserRole } from '../types';

export class AnalyticsPlugin implements Plugin {
  name = 'AnalyticsPlugin';
  version = '1.0.0';
  description = 'Track and analyze community engagement and activity';

  private context!: PluginContext;

  async initialize(context: PluginContext): Promise<void> {
    this.context = context;
    this.context.logger.info('Analytics plugin initialized');
  }

  async onMessage(message: UniversalMessage): Promise<void> {
    if (process.env.ENABLE_ANALYTICS !== 'true') return;
    if (!message.guildId) return;

    // Track message count metric
    this.context.database.trackMetric(
      message.guildId,
      message.platform,
      'message_count',
      1
    );

    // Track engagement by hour
    const hour = new Date().getHours();
    this.context.database.trackMetric(
      message.guildId,
      message.platform,
      `engagement_hour_${hour}`,
      1
    );
  }

  commands = [
    {
      name: 'stats',
      description: 'View user statistics',
      usage: '!stats [@user]',
      execute: async (ctx: CommandContext) => {
        const targetUserId = ctx.args[0] || ctx.message.author.id;
        const stats = this.context.database.getUserStats(targetUserId, ctx.platform);

        if (!stats) {
          const adapter = this.context.bot.getAdapter(ctx.platform);
          await adapter?.sendMessage(ctx.channel.id, 'No statistics found for this user.');
          return;
        }

        const response = `📊 **User Statistics**

**User**: ${targetUserId}
**Messages**: ${stats.messageCount}
**Last Active**: ${stats.lastActive.toLocaleString()}
**Member Since**: ${stats.joinedAt.toLocaleString()}`;

        const adapter = this.context.bot.getAdapter(ctx.platform);
        await adapter?.sendMessage(ctx.channel.id, response);
      },
    },
    {
      name: 'leaderboard',
      description: 'View top active users',
      usage: '!leaderboard [limit]',
      execute: async (ctx: CommandContext) => {
        const limit = parseInt(ctx.args[0]) || 10;
        const topUsers = this.context.database.getTopActiveUsers(ctx.platform, limit);

        let response = `🏆 **Top Active Users**\n\n`;
        topUsers.forEach((user: any, index: number) => {
          response += `${index + 1}. User ${user.userId} - ${user.messageCount} messages\n`;
        });

        const adapter = this.context.bot.getAdapter(ctx.platform);
        await adapter?.sendMessage(
          ctx.channel.id,
          response.trim() || 'No user data available.'
        );
      },
    },
    {
      name: 'commands',
      description: 'View command usage statistics',
      permissions: [UserRole.ADMIN],
      execute: async (ctx: CommandContext) => {
        const stats = this.context.database.getCommandStats(10);

        let response = `📈 **Command Usage Statistics**\n\n`;
        stats.forEach((stat: any, index: number) => {
          response += `${index + 1}. ${stat.commandName} - ${stat.count} uses\n`;
        });

        const adapter = this.context.bot.getAdapter(ctx.platform);
        await adapter?.sendMessage(
          ctx.channel.id,
          response.trim() || 'No command usage data available.'
        );
      },
    },
  ];
}
