import { Platform, PlatformAdapter, UniversalUser, UniversalChannel, UniversalGuild } from '../types';
import { Logger } from '../core/Logger';

export abstract class BasePlatformAdapter implements PlatformAdapter {
  protected logger: Logger;
  public isReady: boolean = false;

  constructor(public platform: Platform) {
    this.logger = new Logger(`${platform.toUpperCase()}Adapter`);
  }

  abstract initialize(): Promise<void>;
  abstract sendMessage(channelId: string, content: string, options?: any): Promise<void>;
  abstract editMessage(channelId: string, messageId: string, content: string): Promise<void>;
  abstract deleteMessage(channelId: string, messageId: string): Promise<void>;
  abstract getUser(userId: string): Promise<UniversalUser | null>;
  abstract getChannel(channelId: string): Promise<UniversalChannel | null>;
  abstract getGuild(guildId: string): Promise<UniversalGuild | null>;
  abstract shutdown(): Promise<void>;

  async setPresence(status: string, activity?: string): Promise<void> {
    this.logger.warn('setPresence not implemented for this platform');
  }

  protected log(message: string, level: 'info' | 'error' | 'warn' | 'debug' = 'info') {
    this.logger[level](message);
  }
}
