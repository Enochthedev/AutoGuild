import * as sdk from 'matrix-js-sdk';
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

export class MatrixAdapter extends BasePlatformAdapter {
  private client: any;
  private eventEmitter: EventEmitter;

  constructor(
    private homeserverUrl: string,
    private accessToken: string,
    private userId: string,
    eventEmitter: EventEmitter
  ) {
    super(Platform.MATRIX);
    this.eventEmitter = eventEmitter;
  }

  async initialize(): Promise<void> {
    try {
      this.client = sdk.createClient({
        baseUrl: this.homeserverUrl,
        accessToken: this.accessToken,
        userId: this.userId,
      });

      this.setupEventHandlers();

      await this.client.startClient({ initialSyncLimit: 10 });
      this.isReady = true;
      this.log('Matrix client initialized successfully');
      this.eventEmitter.emit('platform:ready', Platform.MATRIX);
    } catch (error) {
      this.log(`Failed to initialize Matrix client: ${error}`, 'error');
      throw error;
    }
  }

  private setupEventHandlers() {
    this.client.on('Room.timeline', async (event: any, room: any, toStartOfTimeline: boolean) => {
      if (toStartOfTimeline) return;
      if (event.getType() !== 'm.room.message') return;
      if (event.getSender() === this.userId) return; // Ignore own messages

      try {
        const universalMessage = await this.convertToUniversalMessage(event, room);
        this.eventEmitter.emit('message', universalMessage);
      } catch (error) {
        this.log(`Error processing Matrix message: ${error}`, 'error');
      }
    });

    this.client.on('sync', (state: string) => {
      if (state === 'PREPARED') {
        this.log('Matrix client synced and ready');
      }
    });
  }

  private async convertToUniversalMessage(event: any, room: any): Promise<UniversalMessage> {
    const content = event.getContent();
    const sender = event.getSender();

    const author: UniversalUser = {
      id: sender,
      username: sender.split(':')[0].substring(1), // Extract localpart from @user:server
      displayName: room.getMember(sender)?.name || sender,
      platform: Platform.MATRIX,
      platformSpecificId: sender,
      roles: [UserRole.MEMBER],
      isBot: false,
      avatarUrl: room.getMember(sender)?.getAvatarUrl(this.homeserverUrl, 48, 48, 'crop'),
    };

    let messageType = MessageType.TEXT;
    if (content.msgtype === 'm.image') messageType = MessageType.IMAGE;
    else if (content.msgtype === 'm.video') messageType = MessageType.VIDEO;
    else if (content.msgtype === 'm.audio') messageType = MessageType.AUDIO;
    else if (content.msgtype === 'm.file') messageType = MessageType.FILE;

    return {
      id: event.getId(),
      content: content.body || '',
      author,
      platform: Platform.MATRIX,
      channelId: room.roomId,
      timestamp: new Date(event.getTs()),
      type: messageType,
      metadata: {
        raw: event,
        roomName: room.name,
        formatted: content.formatted_body,
      },
    };
  }

  async sendMessage(channelId: string, content: string, options?: any): Promise<void> {
    try {
      await this.client.sendTextMessage(channelId, content);
    } catch (error) {
      this.log(`Failed to send message: ${error}`, 'error');
      throw error;
    }
  }

  async editMessage(channelId: string, messageId: string, content: string): Promise<void> {
    try {
      await this.client.sendEvent(channelId, 'm.room.message', {
        'm.new_content': {
          msgtype: 'm.text',
          body: content,
        },
        'm.relates_to': {
          rel_type: 'm.replace',
          event_id: messageId,
        },
        msgtype: 'm.text',
        body: `* ${content}`,
      });
    } catch (error) {
      this.log(`Failed to edit message: ${error}`, 'error');
      throw error;
    }
  }

  async deleteMessage(channelId: string, messageId: string): Promise<void> {
    try {
      await this.client.redactEvent(channelId, messageId);
    } catch (error) {
      this.log(`Failed to delete message: ${error}`, 'error');
      throw error;
    }
  }

  async getUser(userId: string): Promise<UniversalUser | null> {
    try {
      const profile = await this.client.getProfileInfo(userId);
      return {
        id: userId,
        username: userId.split(':')[0].substring(1),
        displayName: profile.displayname || userId,
        platform: Platform.MATRIX,
        platformSpecificId: userId,
        roles: [UserRole.MEMBER],
        isBot: false,
        avatarUrl: profile.avatar_url ? this.client.mxcUrlToHttp(profile.avatar_url) : undefined,
      };
    } catch (error) {
      this.log(`Failed to get user: ${error}`, 'error');
      return null;
    }
  }

  async getChannel(channelId: string): Promise<UniversalChannel | null> {
    try {
      const room = this.client.getRoom(channelId);
      if (!room) return null;

      return {
        id: channelId,
        name: room.name || channelId,
        platform: Platform.MATRIX,
        type: room.getMyMembership() === 'join' ? 'text' : 'dm',
      };
    } catch (error) {
      this.log(`Failed to get channel: ${error}`, 'error');
      return null;
    }
  }

  async getGuild(guildId: string): Promise<UniversalGuild | null> {
    // Matrix doesn't have guilds in the traditional sense
    // Spaces could be considered guilds, but that's complex
    return null;
  }

  async shutdown(): Promise<void> {
    this.log('Shutting down Matrix adapter');
    await this.client.stopClient();
    this.isReady = false;
  }
}
