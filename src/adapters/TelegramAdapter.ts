import TelegramBot from 'node-telegram-bot-api';
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

export class TelegramAdapter extends BasePlatformAdapter {
  private bot: TelegramBot;
  private eventEmitter: EventEmitter;

  constructor(private token: string, eventEmitter: EventEmitter) {
    super(Platform.TELEGRAM);
    this.eventEmitter = eventEmitter;
    this.bot = new TelegramBot(token, { polling: false });
    this.setupEventHandlers();
  }

  async initialize(): Promise<void> {
    try {
      await this.bot.startPolling();
      const me = await this.bot.getMe();
      this.isReady = true;
      this.log(`Telegram bot initialized: @${me.username}`);
      this.eventEmitter.emit('platform:ready', Platform.TELEGRAM);
    } catch (error) {
      this.log(`Failed to initialize Telegram bot: ${error}`, 'error');
      throw error;
    }
  }

  private setupEventHandlers() {
    this.bot.on('message', async (msg) => {
      if (msg.from?.is_bot) return;

      try {
        const universalMessage = await this.convertToUniversalMessage(msg);
        this.eventEmitter.emit('message', universalMessage);
      } catch (error) {
        this.log(`Error processing Telegram message: ${error}`, 'error');
      }
    });

    this.bot.on('polling_error', (error) => {
      this.log(`Telegram polling error: ${error}`, 'error');
    });
  }

  private async convertToUniversalMessage(msg: TelegramBot.Message): Promise<UniversalMessage> {
    const author: UniversalUser = {
      id: msg.from!.id.toString(),
      username: msg.from!.username || msg.from!.first_name,
      displayName: `${msg.from!.first_name}${msg.from!.last_name ? ' ' + msg.from!.last_name : ''}`,
      platform: Platform.TELEGRAM,
      platformSpecificId: msg.from!.id.toString(),
      roles: [UserRole.MEMBER],
      isBot: msg.from!.is_bot || false,
    };

    let messageType = MessageType.TEXT;
    if (msg.photo) messageType = MessageType.IMAGE;
    else if (msg.video) messageType = MessageType.VIDEO;
    else if (msg.audio || msg.voice) messageType = MessageType.AUDIO;
    else if (msg.document) messageType = MessageType.FILE;
    else if (msg.sticker) messageType = MessageType.STICKER;

    return {
      id: msg.message_id.toString(),
      content: msg.text || msg.caption || '',
      author,
      platform: Platform.TELEGRAM,
      channelId: msg.chat.id.toString(),
      timestamp: new Date(msg.date * 1000),
      type: messageType,
      metadata: {
        raw: msg,
        chatType: msg.chat.type,
        chatTitle: msg.chat.title,
      },
    };
  }

  async sendMessage(channelId: string, content: string, options?: any): Promise<void> {
    try {
      await this.bot.sendMessage(channelId, content, {
        parse_mode: 'Markdown',
        ...options,
      });
    } catch (error) {
      this.log(`Failed to send message: ${error}`, 'error');
      throw error;
    }
  }

  async editMessage(channelId: string, messageId: string, content: string): Promise<void> {
    try {
      await this.bot.editMessageText(content, {
        chat_id: channelId,
        message_id: parseInt(messageId),
        parse_mode: 'Markdown',
      });
    } catch (error) {
      this.log(`Failed to edit message: ${error}`, 'error');
      throw error;
    }
  }

  async deleteMessage(channelId: string, messageId: string): Promise<void> {
    try {
      await this.bot.deleteMessage(channelId, messageId);
    } catch (error) {
      this.log(`Failed to delete message: ${error}`, 'error');
      throw error;
    }
  }

  async getUser(userId: string): Promise<UniversalUser | null> {
    try {
      const chatMember = await this.bot.getChatMember(userId, parseInt(userId));
      return {
        id: chatMember.user.id.toString(),
        username: chatMember.user.username || chatMember.user.first_name,
        displayName: `${chatMember.user.first_name}${chatMember.user.last_name ? ' ' + chatMember.user.last_name : ''}`,
        platform: Platform.TELEGRAM,
        platformSpecificId: chatMember.user.id.toString(),
        roles: [UserRole.MEMBER],
        isBot: chatMember.user.is_bot,
      };
    } catch (error) {
      this.log(`Failed to get user: ${error}`, 'error');
      return null;
    }
  }

  async getChannel(channelId: string): Promise<UniversalChannel | null> {
    try {
      const chat = await this.bot.getChat(channelId);
      return {
        id: chat.id.toString(),
        name: chat.title || chat.type,
        platform: Platform.TELEGRAM,
        type: chat.type === 'private' ? 'dm' : chat.type === 'group' || chat.type === 'supergroup' ? 'group' : 'text',
      };
    } catch (error) {
      this.log(`Failed to get channel: ${error}`, 'error');
      return null;
    }
  }

  async getGuild(guildId: string): Promise<UniversalGuild | null> {
    try {
      const chat = await this.bot.getChat(guildId);
      if (chat.type !== 'group' && chat.type !== 'supergroup') return null;

      const memberCount = await this.bot.getChatMemberCount(guildId);

      return {
        id: chat.id.toString(),
        name: chat.title || 'Unknown',
        platform: Platform.TELEGRAM,
        ownerId: '0', // Telegram doesn't expose owner ID easily
        memberCount,
      };
    } catch (error) {
      this.log(`Failed to get guild: ${error}`, 'error');
      return null;
    }
  }

  async shutdown(): Promise<void> {
    this.log('Shutting down Telegram adapter');
    await this.bot.stopPolling();
    this.isReady = false;
  }
}
