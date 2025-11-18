import WAWebJS, { Client, LocalAuth, Message as WAMessage } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
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

export class WhatsAppAdapter extends BasePlatformAdapter {
  private client: Client;
  private eventEmitter: EventEmitter;

  constructor(eventEmitter: EventEmitter) {
    super(Platform.WHATSAPP);
    this.eventEmitter = eventEmitter;
    this.client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
    });

    this.setupEventHandlers();
  }

  async initialize(): Promise<void> {
    try {
      this.log('Initializing WhatsApp adapter...');
      await this.client.initialize();
    } catch (error) {
      this.log(`Failed to initialize WhatsApp bot: ${error}`, 'error');
      throw error;
    }
  }

  private setupEventHandlers() {
    this.client.on('qr', (qr) => {
      this.log('QR Code received, scan with your phone:');
      qrcode.generate(qr, { small: true });
    });

    this.client.on('ready', () => {
      this.isReady = true;
      this.log('WhatsApp client is ready!');
      this.eventEmitter.emit('platform:ready', Platform.WHATSAPP);
    });

    this.client.on('authenticated', () => {
      this.log('WhatsApp authenticated successfully');
    });

    this.client.on('message', async (message: WAMessage) => {
      const universalMessage = await this.convertToUniversalMessage(message);
      this.eventEmitter.emit('message', universalMessage);
    });

    this.client.on('disconnected', (reason) => {
      this.log(`WhatsApp disconnected: ${reason}`, 'warn');
      this.isReady = false;
    });
  }

  private async convertToUniversalMessage(message: WAMessage): Promise<UniversalMessage> {
    const contact = await message.getContact();
    const chat = await message.getChat();

    const author: UniversalUser = {
      id: contact.id._serialized,
      username: contact.number,
      displayName: contact.pushname || contact.name || contact.number,
      platform: Platform.WHATSAPP,
      platformSpecificId: contact.id._serialized,
      roles: [UserRole.MEMBER],
      isBot: contact.isMe,
      avatarUrl: await contact.getProfilePicUrl().catch(() => undefined),
    };

    let messageType = MessageType.TEXT;
    if (message.hasMedia) {
      const media = await message.downloadMedia();
      if (media.mimetype.startsWith('image/')) messageType = MessageType.IMAGE;
      else if (media.mimetype.startsWith('video/')) messageType = MessageType.VIDEO;
      else if (media.mimetype.startsWith('audio/')) messageType = MessageType.AUDIO;
      else messageType = MessageType.FILE;
    }

    return {
      id: message.id._serialized,
      content: message.body,
      author,
      platform: Platform.WHATSAPP,
      channelId: chat.id._serialized,
      timestamp: new Date(message.timestamp * 1000),
      type: messageType,
      metadata: {
        raw: message,
        isGroup: chat.isGroup,
        chatName: chat.name,
      },
    };
  }

  async sendMessage(channelId: string, content: string, options?: any): Promise<void> {
    try {
      await this.client.sendMessage(channelId, content, options);
    } catch (error) {
      this.log(`Failed to send message: ${error}`, 'error');
      throw error;
    }
  }

  async editMessage(channelId: string, messageId: string, content: string): Promise<void> {
    this.log('WhatsApp does not support message editing', 'warn');
    throw new Error('Message editing not supported on WhatsApp');
  }

  async deleteMessage(channelId: string, messageId: string): Promise<void> {
    try {
      const chat = await this.client.getChatById(channelId);
      const messages = await chat.fetchMessages({ limit: 100 });
      const message = messages.find((msg) => msg.id._serialized === messageId);
      if (message) {
        await message.delete(true);
      }
    } catch (error) {
      this.log(`Failed to delete message: ${error}`, 'error');
      throw error;
    }
  }

  async getUser(userId: string): Promise<UniversalUser | null> {
    try {
      const contact = await this.client.getContactById(userId);
      return {
        id: contact.id._serialized,
        username: contact.number,
        displayName: contact.pushname || contact.name || contact.number,
        platform: Platform.WHATSAPP,
        platformSpecificId: contact.id._serialized,
        roles: [UserRole.MEMBER],
        isBot: contact.isMe,
        avatarUrl: await contact.getProfilePicUrl().catch(() => undefined),
      };
    } catch (error) {
      this.log(`Failed to get user: ${error}`, 'error');
      return null;
    }
  }

  async getChannel(channelId: string): Promise<UniversalChannel | null> {
    try {
      const chat = await this.client.getChatById(channelId);
      return {
        id: chat.id._serialized,
        name: chat.name,
        platform: Platform.WHATSAPP,
        type: chat.isGroup ? 'group' : 'dm',
      };
    } catch (error) {
      this.log(`Failed to get channel: ${error}`, 'error');
      return null;
    }
  }

  async getGuild(guildId: string): Promise<UniversalGuild | null> {
    // WhatsApp doesn't have guilds/servers, return null
    return null;
  }

  async shutdown(): Promise<void> {
    this.log('Shutting down WhatsApp adapter');
    await this.client.destroy();
    this.isReady = false;
  }
}
