import WebSocket from 'ws';
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

interface GuildedMessage {
  id: string;
  type: string;
  serverId: string;
  channelId: string;
  content: string;
  createdAt: string;
  createdBy: string;
  createdByWebhookId?: string;
}

export class GuildedAdapter extends BasePlatformAdapter {
  private ws: WebSocket | null = null;
  private eventEmitter: EventEmitter;
  private token: string;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(token: string, eventEmitter: EventEmitter) {
    super(Platform.GUILDED);
    this.eventEmitter = eventEmitter;
    this.token = token;
  }

  async initialize(): Promise<void> {
    try {
      await this.connect();
      this.isReady = true;
      this.log('Guilded bot initialized successfully');
      this.eventEmitter.emit('platform:ready', Platform.GUILDED);
    } catch (error) {
      this.log(`Failed to initialize Guilded bot: ${error}`, 'error');
      throw error;
    }
  }

  private async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket('wss://www.guilded.gg/websocket/v1', {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      this.ws.on('open', () => {
        this.log('Connected to Guilded WebSocket');
        this.startHeartbeat();
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const payload = JSON.parse(data.toString());
          this.handleMessage(payload);
        } catch (error) {
          this.log(`Error parsing Guilded message: ${error}`, 'error');
        }
      });

      this.ws.on('error', (error) => {
        this.log(`Guilded WebSocket error: ${error}`, 'error');
        reject(error);
      });

      this.ws.on('close', () => {
        this.log('Guilded WebSocket closed', 'warn');
        this.stopHeartbeat();
        this.isReady = false;
        // Attempt reconnection after 5 seconds
        setTimeout(() => this.connect(), 5000);
      });
    });
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ op: 1 }));
      }
    }, 30000); // Send heartbeat every 30 seconds
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private async handleMessage(payload: any) {
    const { t: eventType, d: data } = payload;

    if (eventType === 'ChatMessageCreated') {
      try {
        const universalMessage = await this.convertToUniversalMessage(data.message);
        this.eventEmitter.emit('message', universalMessage);
      } catch (error) {
        this.log(`Error processing Guilded message: ${error}`, 'error');
      }
    }
  }

  private async convertToUniversalMessage(message: GuildedMessage): Promise<UniversalMessage> {
    const author: UniversalUser = {
      id: message.createdBy,
      username: message.createdBy,
      platform: Platform.GUILDED,
      platformSpecificId: message.createdBy,
      roles: [UserRole.MEMBER],
      isBot: !!message.createdByWebhookId,
    };

    return {
      id: message.id,
      content: message.content,
      author,
      platform: Platform.GUILDED,
      channelId: message.channelId,
      guildId: message.serverId,
      timestamp: new Date(message.createdAt),
      type: MessageType.TEXT,
      metadata: {
        raw: message,
      },
    };
  }

  async sendMessage(channelId: string, content: string, options?: any): Promise<void> {
    try {
      const response = await fetch(`https://www.guilded.gg/api/v1/channels/${channelId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
    } catch (error) {
      this.log(`Failed to send message: ${error}`, 'error');
      throw error;
    }
  }

  async editMessage(channelId: string, messageId: string, content: string): Promise<void> {
    try {
      const response = await fetch(
        `https://www.guilded.gg/api/v1/channels/${channelId}/messages/${messageId}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
    } catch (error) {
      this.log(`Failed to edit message: ${error}`, 'error');
      throw error;
    }
  }

  async deleteMessage(channelId: string, messageId: string): Promise<void> {
    try {
      const response = await fetch(
        `https://www.guilded.gg/api/v1/channels/${channelId}/messages/${messageId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${this.token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
    } catch (error) {
      this.log(`Failed to delete message: ${error}`, 'error');
      throw error;
    }
  }

  async getUser(userId: string): Promise<UniversalUser | null> {
    try {
      const response = await fetch(`https://www.guilded.gg/api/v1/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
      });

      if (!response.ok) return null;

      const data: any = await response.json();
      return {
        id: data.user.id,
        username: data.user.name,
        platform: Platform.GUILDED,
        platformSpecificId: data.user.id,
        roles: [UserRole.MEMBER],
        isBot: data.user.type === 'bot',
        avatarUrl: data.user.avatar,
      };
    } catch (error) {
      this.log(`Failed to get user: ${error}`, 'error');
      return null;
    }
  }

  async getChannel(channelId: string): Promise<UniversalChannel | null> {
    try {
      const response = await fetch(`https://www.guilded.gg/api/v1/channels/${channelId}`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
      });

      if (!response.ok) return null;

      const data: any = await response.json();
      return {
        id: data.channel.id,
        name: data.channel.name,
        platform: Platform.GUILDED,
        type: 'text',
        guildId: data.channel.serverId,
      };
    } catch (error) {
      this.log(`Failed to get channel: ${error}`, 'error');
      return null;
    }
  }

  async getGuild(guildId: string): Promise<UniversalGuild | null> {
    try {
      const response = await fetch(`https://www.guilded.gg/api/v1/servers/${guildId}`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
      });

      if (!response.ok) return null;

      const data: any = await response.json();
      return {
        id: data.server.id,
        name: data.server.name,
        platform: Platform.GUILDED,
        ownerId: data.server.ownerId,
        iconUrl: data.server.avatar,
      };
    } catch (error) {
      this.log(`Failed to get guild: ${error}`, 'error');
      return null;
    }
  }

  async shutdown(): Promise<void> {
    this.log('Shutting down Guilded adapter');
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isReady = false;
  }
}
