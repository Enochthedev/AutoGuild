import { Plugin, PluginContext, UniversalMessage, CommandContext } from '../types';

export class EngagementPlugin implements Plugin {
  name = 'EngagementPlugin';
  version = '1.0.0';
  description = 'Enhance community engagement with AI-powered interactions';

  private context!: PluginContext;

  async initialize(context: PluginContext): Promise<void> {
    this.context = context;
    this.context.logger.info('Engagement plugin initialized');
  }

  commands = [

    {
      name: 'poll',
      description: 'Create a quick poll',
      usage: '!poll <question> | <option1> | <option2> | ...',
      execute: async (ctx: CommandContext) => {
        const input = ctx.args.join(' ');
        const parts = input.split('|').map((s) => s.trim());

        if (parts.length < 3) {
          const adapter = this.context.bot.getAdapter(ctx.platform);
          await adapter?.sendMessage(
            ctx.channel.id,
            'Usage: !poll <question> | <option1> | <option2> | ...'
          );
          return;
        }

        const question = parts[0];
        const options = parts.slice(1);

        let pollMessage = `📊 **Poll: ${question}**\n\n`;
        const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

        options.forEach((option, index) => {
          if (index < emojis.length) {
            pollMessage += `${emojis[index]} ${option}\n`;
          }
        });

        const adapter = this.context.bot.getAdapter(ctx.platform);
        await adapter?.sendMessage(ctx.channel.id, pollMessage);
      },
    },
    {
      name: 'welcome',
      description: 'Send a welcome message',
      usage: '!welcome [@user]',
      execute: async (ctx: CommandContext) => {
        const username = ctx.args[0] || ctx.message.author.username;
        const welcomeMessage = `👋 Welcome to the community, ${username}! We're glad to have you here. Feel free to introduce yourself and join the conversation!`;

        const adapter = this.context.bot.getAdapter(ctx.platform);
        await adapter?.sendMessage(ctx.channel.id, welcomeMessage);
      },
    },
  ];
}
