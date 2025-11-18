import {
  Client,
  GatewayIntentBits,
  Message,
  TextChannel,
  DMChannel,
  NewsChannel,
  Guild,
  User,
  PartialUser,
  GuildMember,
} from 'discord.js';
import { BasePlatformAdapter } from './BasePlatformAdapter';
import {
  Platform,
  UniversalMessage,
  UniversalUser,
  UniversalChannel,
  UniversalGuild,
  MessageType,
  UserRole,
  MessageAttachment,
} from '../types';
import { EventEmitter } from 'events';

export class DiscordAdapter extends BasePlatformAdapter {
  private client: Client;
  private eventEmitter: EventEmitter;

  constructor(private token: string, eventEmitter: EventEmitter) {
    super(Platform.DISCORD);
    this.eventEmitter = eventEmitter;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages,
      ],
    });

    this.setupEventHandlers();
  }

  async initialize(): Promise<void> {
    try {
      await this.client.login(this.token);
      this.isReady = true;
      this.log('Discord bot initialized successfully');
    } catch (error) {
      this.log(`Failed to initialize Discord bot: ${error}`, 'error');
      throw error;
    }
  }

  private setupEventHandlers() {
    this.client.on('ready', () => {
      this.log(`Logged in as ${this.client.user?.tag}`);
      this.eventEmitter.emit('platform:ready', Platform.DISCORD);
    });

    this.client.on('messageCreate', async (message: Message) => {
      if (message.author.bot) return;

      const universalMessage = await this.convertToUniversalMessage(message);
      this.eventEmitter.emit('message', universalMessage);
    });

    this.client.on('error', (error) => {
      this.log(`Discord client error: ${error}`, 'error');
    });
  }

  private async convertToUniversalMessage(message: Message): Promise<UniversalMessage> {
    const author = await this.convertToUniversalUser(message.author, message.member);

    const attachments: MessageAttachment[] = message.attachments.map((att) => ({
      id: att.id,
      name: att.name || 'unknown',
      url: att.url,
      type: this.detectAttachmentType(att.contentType),
      size: att.size,
    }));

    return {
      id: message.id,
      content: message.content,
      author,
      platform: Platform.DISCORD,
      channelId: message.channelId,
      guildId: message.guildId || undefined,
      timestamp: message.createdAt,
      type: MessageType.TEXT,
      attachments: attachments.length > 0 ? attachments : undefined,
      replyTo: message.reference?.messageId,
      metadata: {
        raw: message,
      },
    };
  }

  private async convertToUniversalUser(
    user: User | PartialUser,
    member?: GuildMember | null
  ): Promise<UniversalUser> {
    const roles: UserRole[] = [UserRole.MEMBER];

    if (member) {
      if (member.permissions.has('Administrator')) {
        roles.push(UserRole.ADMIN);
      }
      if (member.permissions.has('ModerateMembers')) {
        roles.push(UserRole.MODERATOR);
      }
      if (member.guild.ownerId === user.id) {
        roles.push(UserRole.OWNER);
      }
    }

    return {
      id: user.id,
      username: user.username || 'Unknown',
      displayName: member?.displayName || user.username,
      platform: Platform.DISCORD,
      platformSpecificId: user.id,
      roles,
      isBot: user.bot || false,
      avatarUrl: user.displayAvatarURL(),
      joinedAt: member?.joinedAt || undefined,
    };
  }

  private detectAttachmentType(contentType?: string | null): MessageType {
    if (!contentType) return MessageType.FILE;
    if (contentType.startsWith('image/')) return MessageType.IMAGE;
    if (contentType.startsWith('video/')) return MessageType.VIDEO;
    if (contentType.startsWith('audio/')) return MessageType.AUDIO;
    return MessageType.FILE;
  }

  async sendMessage(channelId: string, content: string, options?: any): Promise<void> {
    try {
      const channel = await this.client.channels.fetch(channelId);
      if (
        channel instanceof TextChannel ||
        channel instanceof DMChannel ||
        channel instanceof NewsChannel
      ) {
        await channel.send({ content, ...options });
      }
    } catch (error) {
      this.log(`Failed to send message: ${error}`, 'error');
      throw error;
    }
  }

  async editMessage(channelId: string, messageId: string, content: string): Promise<void> {
    try {
      const channel = await this.client.channels.fetch(channelId);
      if (
        channel instanceof TextChannel ||
        channel instanceof DMChannel ||
        channel instanceof NewsChannel
      ) {
        const message = await channel.messages.fetch(messageId);
        await message.edit(content);
      }
    } catch (error) {
      this.log(`Failed to edit message: ${error}`, 'error');
      throw error;
    }
  }

  async deleteMessage(channelId: string, messageId: string): Promise<void> {
    try {
      const channel = await this.client.channels.fetch(channelId);
      if (
        channel instanceof TextChannel ||
        channel instanceof DMChannel ||
        channel instanceof NewsChannel
      ) {
        const message = await channel.messages.fetch(messageId);
        await message.delete();
      }
    } catch (error) {
      this.log(`Failed to delete message: ${error}`, 'error');
      throw error;
    }
  }

  async getUser(userId: string): Promise<UniversalUser | null> {
    try {
      const user = await this.client.users.fetch(userId);
      return this.convertToUniversalUser(user);
    } catch (error) {
      this.log(`Failed to get user: ${error}`, 'error');
      return null;
    }
  }

  async getChannel(channelId: string): Promise<UniversalChannel | null> {
    try {
      const channel = await this.client.channels.fetch(channelId);
      if (!channel) return null;

      const baseChannel: UniversalChannel = {
        id: channel.id,
        name: 'name' in channel ? channel.name : 'DM',
        platform: Platform.DISCORD,
        type: channel.isDMBased() ? 'dm' : 'text',
        guildId: 'guildId' in channel ? channel.guildId : undefined,
      };

      return baseChannel;
    } catch (error) {
      this.log(`Failed to get channel: ${error}`, 'error');
      return null;
    }
  }

  async getGuild(guildId: string): Promise<UniversalGuild | null> {
    try {
      const guild: Guild = await this.client.guilds.fetch(guildId);
      return {
        id: guild.id,
        name: guild.name,
        platform: Platform.DISCORD,
        ownerId: guild.ownerId,
        memberCount: guild.memberCount,
        iconUrl: guild.iconURL() || undefined,
      };
    } catch (error) {
      this.log(`Failed to get guild: ${error}`, 'error');
      return null;
    }
  }

  async setPresence(status: string, activity?: string): Promise<void> {
    try {
      this.client.user?.setPresence({
        status: 'online',
        activities: activity ? [{ name: activity }] : [],
      });
    } catch (error) {
      this.log(`Failed to set presence: ${error}`, 'error');
    }
  }

  async shutdown(): Promise<void> {
    this.log('Shutting down Discord adapter');
    await this.client.destroy();
    this.isReady = false;
  }
}
