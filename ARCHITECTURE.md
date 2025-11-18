# AutoGuild Architecture

This document describes the technical architecture and design decisions behind AutoGuild.

## Overview

AutoGuild is built with a layered, modular architecture that enables:
- **Platform independence** through abstraction layers
- **Extensibility** via plugin system
- **Maintainability** through separation of concerns
- **Scalability** for multiple platforms and guilds

## Core Principles

1. **Platform Agnostic** - Core bot logic works independently of messaging platforms
2. **Plugin-Based** - Features are modular and can be enabled/disabled
3. **Type-Safe** - TypeScript throughout for reliability
4. **Event-Driven** - Asynchronous event handling for all platform interactions

## Architecture Layers

### 1. Platform Layer

**Location**: `src/adapters/`

This layer handles platform-specific integrations.

```typescript
┌─────────────────────────────────────┐
│    Platform-Specific SDKs           │
│  (discord.js, whatsapp-web.js)      │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│      Platform Adapters              │
│  - DiscordAdapter                   │
│  - WhatsAppAdapter                  │
│  - (Future: TelegramAdapter, etc.)  │
└──────────────┬──────────────────────┘
               │
         Implements
               │
┌──────────────▼──────────────────────┐
│   BasePlatformAdapter Interface     │
│  - initialize()                     │
│  - sendMessage()                    │
│  - getUser() / getChannel()         │
└─────────────────────────────────────┘
```

**Responsibilities**:
- Connect to platform APIs
- Convert platform events to universal format
- Handle platform-specific features
- Manage authentication and connection state

**Key Classes**:
- `BasePlatformAdapter` - Abstract base class for all adapters
- `DiscordAdapter` - Discord-specific implementation
- `WhatsAppAdapter` - WhatsApp-specific implementation

### 2. Abstraction Layer

**Location**: `src/types/`

Provides platform-independent data structures.

```typescript
Platform Message → Universal Message
Platform User    → Universal User
Platform Channel → Universal Channel
Platform Guild   → Universal Guild
```

**Key Interfaces**:

```typescript
interface UniversalMessage {
  id: string;
  content: string;
  author: UniversalUser;
  platform: Platform;
  channelId: string;
  timestamp: Date;
  // ...
}

interface UniversalUser {
  id: string;
  username: string;
  platform: Platform;
  roles: UserRole[];
  // ...
}
```

**Benefits**:
- Commands work across all platforms
- Plugins don't need platform-specific code
- Easy to add new platforms
- Consistent data model

### 3. Core Layer

**Location**: `src/core/`

The heart of the bot, managing commands, events, and plugins.

```typescript
┌─────────────────────────────────────┐
│          BotCore                    │
│                                     │
│  ┌──────────────────────────────┐  │
│  │   Command Handler            │  │
│  │  - Parse commands            │  │
│  │  - Permission checks         │  │
│  │  - Execute commands          │  │
│  └──────────────────────────────┘  │
│                                     │
│  ┌──────────────────────────────┐  │
│  │   Event Manager              │  │
│  │  - Message events            │  │
│  │  - Platform events           │  │
│  │  - Plugin notifications      │  │
│  └──────────────────────────────┘  │
│                                     │
│  ┌──────────────────────────────┐  │
│  │   Plugin Manager             │  │
│  │  - Load plugins              │  │
│  │  - Plugin lifecycle          │  │
│  │  - Plugin communication      │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
```

**BotCore Responsibilities**:
- Initialize platform adapters
- Route messages to plugins
- Manage command execution
- Handle errors globally
- Coordinate shutdowns

### 4. Plugin Layer

**Location**: `src/plugins/`

Modular features that extend bot functionality.

```typescript
interface Plugin {
  name: string;
  version: string;
  description: string;
  initialize(context: PluginContext): Promise<void>;
  onMessage?(message: UniversalMessage): Promise<void>;
  commands?: BotCommand[];
  shutdown?(): Promise<void>;
}
```

**Built-in Plugins**:

1. **CoreCommandsPlugin**
   - Basic commands (help, ping, about)
   - Configuration management
   - System utilities

2. **ModerationPlugin**
   - AI-powered content moderation
   - Warning system
   - Moderation logging
   - Admin commands

3. **AnalyticsPlugin**
   - User activity tracking
   - Leaderboards
   - Command statistics
   - Engagement metrics

4. **EngagementPlugin**
   - AI-powered chat
   - Polls and surveys
   - Welcome messages
   - Community interactions

**Plugin Lifecycle**:
```
Load → Initialize → Ready → Process Messages → Shutdown
```

### 5. Service Layer

**Location**: `src/ai/`, `src/database/`

Provides shared services to plugins and core.

#### AI Service (`src/ai/AIProvider.ts`)

```typescript
┌─────────────────────────────────────┐
│         AIManager                   │
└──────────────┬──────────────────────┘
               │
       ┌───────┴────────┐
       │                │
┌──────▼──────┐  ┌─────▼──────┐
│  OpenAI     │  │ Anthropic  │
│  Provider   │  │ Provider   │
└─────────────┘  └────────────┘
```

**Features**:
- Unified AI interface
- Multiple provider support
- Content moderation
- Conversational AI
- Token tracking

#### Database Service (`src/database/Database.ts`)

**Schema**:
```sql
user_stats
  - userId, platform, messageCount, lastActive

guild_config
  - guildId, platform, prefix, moderationEnabled

moderation_logs
  - userId, action, reason, moderatorId, timestamp

analytics
  - metricType, metricValue, timestamp

command_usage
  - commandName, userId, timestamp
```

**Benefits**:
- Persistent data storage
- Fast SQLite queries
- Automatic schema management
- Transaction support

### 6. Utility Layer

**Location**: `src/core/Logger.ts`

**Logger Features**:
- Multiple log levels
- File-based logging
- Console output in development
- Structured JSON logs
- Per-module loggers

## Data Flow

### Message Processing Flow

```
1. Platform SDK receives message
         │
         ▼
2. Platform Adapter converts to UniversalMessage
         │
         ▼
3. BotCore emits 'message' event
         │
         ├─────────────────┬──────────────┐
         ▼                 ▼              ▼
4a. Command Handler  4b. Plugins    4c. Database
    - Parse             - Process      - Track
    - Execute           - Respond      - Log
         │
         ▼
5. Send response via Platform Adapter
         │
         ▼
6. Platform SDK sends message
```

### Command Execution Flow

```
1. User sends: !command arg1 arg2
         │
         ▼
2. BotCore detects command prefix
         │
         ▼
3. Parse command name and arguments
         │
         ▼
4. Look up command in registry
         │
         ▼
5. Check permissions
         │
         ▼
6. Create CommandContext
         │
         ▼
7. Execute command handler
         │
         ▼
8. Send response
         │
         ▼
9. Log command usage
```

## Design Patterns

### 1. Adapter Pattern
- `BasePlatformAdapter` abstracts platform differences
- Each platform implements the same interface
- Core bot remains platform-agnostic

### 2. Plugin Pattern
- Features are self-contained modules
- Plugins register with core
- Communication via events and context

### 3. Factory Pattern
- `AIManager` creates appropriate AI provider
- Platform adapters created based on configuration
- Consistent creation interface

### 4. Observer Pattern
- Event-driven architecture
- Plugins observe message events
- Loose coupling between components

### 5. Strategy Pattern
- Different AI providers with same interface
- Swappable moderation strategies
- Configurable behavior

## Error Handling

### Error Hierarchy

```
1. Platform Errors
   - Connection failures
   - API errors
   - Rate limiting
   → Logged and retried

2. Command Errors
   - Invalid arguments
   - Permission denied
   - Execution errors
   → User feedback sent

3. Plugin Errors
   - Initialization failures
   - Runtime errors
   → Logged, plugin disabled

4. System Errors
   - Database errors
   - Configuration errors
   → Critical, may shutdown
```

### Error Recovery

- **Graceful degradation**: Continue with available features
- **Automatic retry**: Platform connection issues
- **Error logging**: All errors logged with context
- **User feedback**: Commands provide error messages

## Performance Considerations

### Optimization Strategies

1. **Database**
   - SQLite WAL mode for concurrent access
   - Prepared statements for common queries
   - Indexed columns for fast lookups

2. **Message Processing**
   - Asynchronous event handling
   - Non-blocking I/O
   - Parallel plugin execution

3. **Memory Management**
   - No message caching (rely on platform)
   - Bounded log file sizes
   - Database connection pooling

4. **Rate Limiting**
   - Command cooldowns
   - Per-user rate limits
   - Platform API respect

## Security

### Security Measures

1. **Credential Management**
   - Environment variables for secrets
   - No credentials in code
   - .env in .gitignore

2. **Input Validation**
   - Command argument validation
   - SQL injection prevention (prepared statements)
   - XSS prevention in responses

3. **Permission System**
   - Role-based access control
   - Per-command permissions
   - Platform permission mapping

4. **AI Safety**
   - Content moderation
   - Rate limiting AI requests
   - Token usage tracking

## Extensibility

### Adding New Platforms

1. Create adapter implementing `BasePlatformAdapter`
2. Add platform to `Platform` enum
3. Implement conversion to universal types
4. Add configuration options
5. Update BotCore to recognize platform

### Adding New Features

1. Create plugin implementing `Plugin` interface
2. Add commands if needed
3. Hook into message events
4. Use provided services (AI, database)
5. Load plugin in main

### Adding New AI Providers

1. Implement `AIProvider` interface
2. Add provider to `AIManager`
3. Add configuration options
4. Update documentation

## Future Enhancements

### Planned Improvements

1. **Horizontal Scaling**
   - Multiple bot instances
   - Shared database
   - Load balancing

2. **Web Dashboard**
   - Real-time analytics
   - Configuration UI
   - Log viewing

3. **Advanced AI**
   - Context memory
   - Custom training
   - Multi-modal support

4. **Enhanced Plugins**
   - Hot reload
   - Plugin marketplace
   - Dependency management

---

This architecture provides a solid foundation for a multi-platform bot while remaining flexible for future growth.
