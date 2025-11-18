import { App, LogLevel } from '@slack/bolt';
import { BasePlatformAdapter } from './BasePlatformAdapter';
import {
  Platform,
  UniversalMessage,
  UniversalUser,
  UniversalChannel,
  UniversalGuild,
  MessageType,
  UserRole,
} from '../types';
import { EventEmitter } from 'events';

export class SlackAdapter extends BasePlatformAdapter {
  private app: App;
  private eventEmitter: EventEmitter;

  constructor(private token: string, eventEmitter: EventEmitter) {
    super(Platform.SLACK);
    this.eventEmitter = eventEmitter;
    this.app = new App({
      token: token,
      signingSecret: process.env.SLACK_SIGNING_SECRET || '',
      logLevel: LogLevel.INFO,
    });

    this.setupEventHandlers();
  }

  async initialize(): Promise<void> {
    try {
      const port = parseInt(process.env.SLACK_PORT || '3000');
      await this.app.start(port);
      this.isReady = true;
      this.log(`Slack bot initialized on port ${port}`);
      this.eventEmitter.emit('platform:ready', Platform.SLACK);
    } catch (error) {
      this.log(`Failed to initialize Slack bot: ${error}`, 'error');
      throw error;
    }
  }

  private setupEventHandlers() {
    this.app.message(async ({ message, say }) => {
      if ('subtype' in message && message.subtype === 'bot_message') return;
      if ('user' in message) {
        try {
          const universalMessage = await this.convertToUniversalMessage(message as any);
          this.eventEmitter.emit('message', universalMessage);
        } catch (error) {
          this.log(`Error processing Slack message: ${error}`, 'error');
        }
      }
    });

    this.app.error(async (error) => {
      this.log(`Slack app error: ${error}`, 'error');
    });
  }

  private async convertToUniversalMessage(message: any): Promise<UniversalMessage> {
    const author: UniversalUser = {
      id: message.user,
      username: message.user,
      platform: Platform.SLACK,
      platformSpecificId: message.user,
      roles: [UserRole.MEMBER],
      isBot: false,
    };

    // Try to get user details
    try {
      const userInfo = await this.app.client.users.info({ user: message.user });
      if (userInfo.user) {
        author.username = userInfo.user.name || message.user;
        author.displayName = userInfo.user.real_name;
        author.avatarUrl = userInfo.user.profile?.image_192;
      }
    } catch (error) {
      this.log(`Failed to fetch user info: ${error}`, 'debug');
    }

    let messageType = MessageType.TEXT;
    if (message.files && message.files.length > 0) {
      const file = message.files[0];
      if (file.mimetype?.startsWith('image/')) messageType = MessageType.IMAGE;
      else if (file.mimetype?.startsWith('video/')) messageType = MessageType.VIDEO;
      else if (file.mimetype?.startsWith('audio/')) messageType = MessageType.AUDIO;
      else messageType = MessageType.FILE;
    }

    return {
      id: message.ts,
      content: message.text || '',
      author,
      platform: Platform.SLACK,
      channelId: message.channel,
      timestamp: new Date(parseFloat(message.ts) * 1000),
      type: messageType,
      metadata: {
        raw: message,
        threadTs: message.thread_ts,
      },
    };
  }

  async sendMessage(channelId: string, content: string, options?: any): Promise<void> {
    try {
      await this.app.client.chat.postMessage({
        channel: channelId,
        text: content,
        ...options,
      });
    } catch (error) {
      this.log(`Failed to send message: ${error}`, 'error');
      throw error;
    }
  }

  async editMessage(channelId: string, messageId: string, content: string): Promise<void> {
    try {
      await this.app.client.chat.update({
        channel: channelId,
        ts: messageId,
        text: content,
      });
    } catch (error) {
      this.log(`Failed to edit message: ${error}`, 'error');
      throw error;
    }
  }

  async deleteMessage(channelId: string, messageId: string): Promise<void> {
    try {
      await this.app.client.chat.delete({
        channel: channelId,
        ts: messageId,
      });
    } catch (error) {
      this.log(`Failed to delete message: ${error}`, 'error');
      throw error;
    }
  }

  async getUser(userId: string): Promise<UniversalUser | null> {
    try {
      const result = await this.app.client.users.info({ user: userId });
      if (!result.user) return null;

      return {
        id: result.user.id!,
        username: result.user.name || result.user.id!,
        displayName: result.user.real_name,
        platform: Platform.SLACK,
        platformSpecificId: result.user.id!,
        roles: [UserRole.MEMBER],
        isBot: result.user.is_bot || false,
        avatarUrl: result.user.profile?.image_192,
      };
    } catch (error) {
      this.log(`Failed to get user: ${error}`, 'error');
      return null;
    }
  }

  async getChannel(channelId: string): Promise<UniversalChannel | null> {
    try {
      const result = await this.app.client.conversations.info({ channel: channelId });
      if (!result.channel) return null;

      return {
        id: result.channel.id!,
        name: result.channel.name || 'Unknown',
        platform: Platform.SLACK,
        type: result.channel.is_im ? 'dm' : result.channel.is_group ? 'group' : 'text',
      };
    } catch (error) {
      this.log(`Failed to get channel: ${error}`, 'error');
      return null;
    }
  }

  async getGuild(guildId: string): Promise<UniversalGuild | null> {
    try {
      const result = await this.app.client.team.info();
      if (!result.team) return null;

      return {
        id: result.team.id!,
        name: result.team.name || 'Unknown',
        platform: Platform.SLACK,
        ownerId: '0',
        iconUrl: result.team.icon?.image_132,
      };
    } catch (error) {
      this.log(`Failed to get guild: ${error}`, 'error');
      return null;
    }
  }

  async shutdown(): Promise<void> {
    this.log('Shutting down Slack adapter');
    await this.app.stop();
    this.isReady = false;
  }
}
