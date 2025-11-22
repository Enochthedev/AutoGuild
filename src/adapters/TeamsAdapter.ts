import { BotFrameworkAdapter, ConversationState, MemoryStorage, TurnContext } from 'botbuilder';
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
import express, { Express } from 'express';

export class TeamsAdapter extends BasePlatformAdapter {
  private adapter: BotFrameworkAdapter;
  private conversationState: ConversationState;
  private eventEmitter: EventEmitter;
  private app: Express;
  private server: any;

  constructor(private appId: string, private appPassword: string, eventEmitter: EventEmitter) {
    super(Platform.TEAMS);
    this.eventEmitter = eventEmitter;

    // Create adapter
    this.adapter = new BotFrameworkAdapter({
      appId: this.appId,
      appPassword: this.appPassword,
    });

    // Create conversation state
    const memoryStorage = new MemoryStorage();
    this.conversationState = new ConversationState(memoryStorage);

    // Setup Express app for Teams webhooks
    this.app = express();
    this.app.use(express.json());

    this.setupErrorHandler();
    this.setupMessageHandler();
  }

  async initialize(): Promise<void> {
    try {
      const port = parseInt(process.env.TEAMS_PORT || '3003');

      this.server = this.app.listen(port, () => {
        this.isReady = true;
        this.log(`Teams adapter initialized on port ${port}`);
        this.eventEmitter.emit('platform:ready', Platform.TEAMS);
      });
    } catch (error) {
      this.log(`Failed to initialize Teams adapter: ${error}`, 'error');
      throw error;
    }
  }

  private setupErrorHandler() {
    this.adapter.onTurnError = async (context, error) => {
      this.log(`Teams adapter error: ${error}`, 'error');
      await context.sendActivity('Sorry, an error occurred.');
    };
  }

  private setupMessageHandler() {
    this.app.post('/api/messages', (req, res) => {
      this.adapter.processActivity(req, res, async (context) => {
        if (context.activity.type === 'message') {
          try {
            const universalMessage = await this.convertToUniversalMessage(context);
            this.eventEmitter.emit('message', universalMessage);

            // Save conversation state
            await this.conversationState.saveChanges(context);
          } catch (error) {
            this.log(`Error processing Teams message: ${error}`, 'error');
          }
        }
      });
    });
  }

  private async convertToUniversalMessage(context: TurnContext): Promise<UniversalMessage> {
    const activity = context.activity;

    const author: UniversalUser = {
      id: activity.from.id,
      username: activity.from.name || activity.from.id,
      displayName: activity.from.name,
      platform: Platform.TEAMS,
      platformSpecificId: activity.from.id,
      roles: [UserRole.MEMBER],
      isBot: false,
      avatarUrl: activity.from.aadObjectId ? `https://graph.microsoft.com/v1.0/users/${activity.from.aadObjectId}/photo/$value` : undefined,
    };

    let messageType = MessageType.TEXT;
    if (activity.attachments && activity.attachments.length > 0) {
      const attachment = activity.attachments[0];
      if (attachment.contentType?.startsWith('image/')) messageType = MessageType.IMAGE;
      else if (attachment.contentType?.startsWith('video/')) messageType = MessageType.VIDEO;
      else if (attachment.contentType?.startsWith('audio/')) messageType = MessageType.AUDIO;
      else messageType = MessageType.FILE;
    }

    return {
      id: activity.id || Date.now().toString(),
      content: activity.text || '',
      author,
      platform: Platform.TEAMS,
      channelId: activity.conversation.id,
      guildId: activity.conversation.tenantId,
      timestamp: new Date(activity.timestamp || Date.now()),
      type: messageType,
      metadata: {
        raw: activity,
        conversationType: activity.conversation.conversationType,
        channelData: activity.channelData,
      },
    };
  }

  async sendMessage(channelId: string, content: string, options?: any): Promise<void> {
    try {
      // Teams requires a conversation reference to send proactive messages
      // This is a simplified version - in production, you'd store conversation references
      this.log('Sending proactive messages in Teams requires conversation references', 'warn');
      // Implementation would require storing conversation references from incoming messages
    } catch (error) {
      this.log(`Failed to send message: ${error}`, 'error');
      throw error;
    }
  }

  async editMessage(channelId: string, messageId: string, content: string): Promise<void> {
    try {
      // Teams supports message updates but requires activity ID and conversation reference
      this.log('Message editing in Teams requires specific implementation', 'warn');
    } catch (error) {
      this.log(`Failed to edit message: ${error}`, 'error');
      throw error;
    }
  }

  async deleteMessage(channelId: string, messageId: string): Promise<void> {
    try {
      // Teams supports message deletion but requires activity ID and conversation reference
      this.log('Message deletion in Teams requires specific implementation', 'warn');
    } catch (error) {
      this.log(`Failed to delete message: ${error}`, 'error');
      throw error;
    }
  }

  async getUser(userId: string): Promise<UniversalUser | null> {
    // Would require Microsoft Graph API integration
    return null;
  }

  async getChannel(channelId: string): Promise<UniversalChannel | null> {
    return {
      id: channelId,
      name: 'Teams Channel',
      platform: Platform.TEAMS,
      type: 'text',
    };
  }

  async getGuild(guildId: string): Promise<UniversalGuild | null> {
    return {
      id: guildId,
      name: 'Teams Organization',
      platform: Platform.TEAMS,
      ownerId: '0',
    };
  }

  async shutdown(): Promise<void> {
    this.log('Shutting down Teams adapter');
    if (this.server) {
      this.server.close();
    }
    this.isReady = false;
  }
}
