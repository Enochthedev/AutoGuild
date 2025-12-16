/**
 * Core types for AutoGuild multi-platform bot
 */

export enum Platform {
  DISCORD = 'discord',
  WHATSAPP = 'whatsapp',
  TELEGRAM = 'telegram',
  SLACK = 'slack',
  TEAMS = 'teams',
  MATRIX = 'matrix',
  GUILDED = 'guilded',
}

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  FILE = 'file',
  STICKER = 'sticker',
}

export enum UserRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  MEMBER = 'member',
  GUEST = 'guest',
}

export interface UniversalUser {
  id: string;
  username: string;
  displayName?: string;
  platform: Platform;
  platformSpecificId: string;
  roles: UserRole[];
  isBot: boolean;
  avatarUrl?: string;
  joinedAt?: Date;
}

export interface UniversalMessage {
  id: string;
  content: string;
  author: UniversalUser;
  platform: Platform;
  channelId: string;
  guildId?: string;
  timestamp: Date;
  type: MessageType;
  attachments?: MessageAttachment[];
  mentions?: UniversalUser[];
  replyTo?: string;
  metadata?: Record<string, any>;
}

export interface MessageAttachment {
  id: string;
  name: string;
  url: string;
  type: MessageType;
  size: number;
}

export interface UniversalChannel {
  id: string;
  name: string;
  platform: Platform;
  guildId?: string;
  type: 'text' | 'voice' | 'dm' | 'group';
  metadata?: Record<string, any>;
}

export interface UniversalGuild {
  id: string;
  name: string;
  platform: Platform;
  ownerId: string;
  memberCount?: number;
  iconUrl?: string;
  metadata?: Record<string, any>;
}

export interface CommandContext {
  message: UniversalMessage;
  args: string[];
  channel: UniversalChannel;
  guild?: UniversalGuild;
  platform: Platform;
}

export interface BotCommand {
  name: string;
  description: string;
  aliases?: string[];
  usage?: string;
  cooldown?: number;
  permissions?: UserRole[];
  platforms?: Platform[];
  execute: (context: CommandContext) => Promise<void>;
}

export interface PlatformAdapter {
  platform: Platform;
  isReady: boolean;
  initialize: () => Promise<void>;
  sendMessage: (channelId: string, content: string, options?: any) => Promise<void>;
  editMessage: (channelId: string, messageId: string, content: string) => Promise<void>;
  deleteMessage: (channelId: string, messageId: string) => Promise<void>;
  getUser: (userId: string) => Promise<UniversalUser | null>;
  getChannel: (channelId: string) => Promise<UniversalChannel | null>;
  getGuild: (guildId: string) => Promise<UniversalGuild | null>;
  createChannel?: (guildId: string, name: string, type: 'text' | 'voice') => Promise<UniversalChannel | null>;
  deleteChannel?: (channelId: string) => Promise<void>;
  setPresence?: (status: string, activity?: string) => Promise<void>;
  shutdown: () => Promise<void>;
}

export interface PluginContext {
  bot: any; // BotCore instance
  logger: any;
  config: any;
  database: any;
}

export interface Plugin {
  name: string;
  version: string;
  description: string;
  platforms?: Platform[];
  initialize: (context: PluginContext) => Promise<void>;
  shutdown?: () => Promise<void>;
  onMessage?: (message: UniversalMessage) => Promise<void>;
  commands?: BotCommand[];
}

export interface AIProviderConfig {
  provider: 'openai' | 'anthropic' | 'openrouter';
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
}

export enum ActionType {
  CREATE_CHANNEL = 'create_channel',
  DELETE_CHANNEL = 'delete_channel',
  SEND_MESSAGE = 'send_message',
  SCHEDULE_EVENT = 'schedule_event',
  STORE_MEMORY = 'store_memory',
  READ_MEMORY = 'read_memory',
  TRACE_COST = 'trace_cost',
}

export interface AIAction {
  type: ActionType;
  params: Record<string, any>;
  reason?: string;
}

export interface AIActionResponse {
  response: string; // The conversational response to the user
  actions?: AIAction[]; // List of actions the AI wants to perform
}
