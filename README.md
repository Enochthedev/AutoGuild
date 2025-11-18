# 🤖 AutoGuild

**Universal AI-Powered Community Management Bot**

AutoGuild is a comprehensive, multi-platform community management bot designed to work seamlessly across Discord, WhatsApp, and other messaging platforms. With built-in AI capabilities, advanced analytics, and automated moderation, AutoGuild eliminates the need for multiple separate bots.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

## ✨ Features

### 🌐 Multi-Platform Support
- **Discord** - Full integration with Discord servers
- **WhatsApp** - WhatsApp groups and DMs support
- **Extensible** - Easy to add new platforms (Telegram, Slack, etc.)

### 🤖 AI-Powered
- **OpenAI Integration** - GPT-4 and GPT-3.5 support
- **Anthropic Claude** - Claude 3.5 Sonnet and other models
- **Smart Moderation** - AI-powered content filtering
- **Intelligent Responses** - Natural conversation capabilities

### 🛡️ Moderation Tools
- Automated content moderation
- Warning and logging system
- Customizable moderation rules
- Detailed moderation logs

### 📊 Analytics & Insights
- User activity tracking
- Engagement metrics
- Command usage statistics
- Leaderboards and rankings

### 🔌 Plugin System
- Modular architecture
- Easy plugin development
- Hot-reload support
- Community plugins

## 🚀 Quick Start

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- A Discord bot token (for Discord)
- OpenAI or Anthropic API key (for AI features)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/autoguild.git
cd autoguild
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
```bash
cp .env.example .env
```

Edit `.env` and add your credentials:
```env
# Discord Configuration
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_discord_client_id_here

# AI Provider (choose one or both)
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=your_anthropic_api_key_here
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# Or use OpenAI
# AI_PROVIDER=openai
# OPENAI_API_KEY=your_openai_api_key_here
# OPENAI_MODEL=gpt-4-turbo-preview

# Features
ENABLE_MODERATION=true
ENABLE_ANALYTICS=true
ENABLE_AUTO_RESPONSES=true
```

4. **Build and run**
```bash
# Development mode
npm run dev

# Production build
npm run build
npm start
```

## 📖 Usage

### Basic Commands

- `!help` - Display all available commands
- `!ping` - Check bot responsiveness
- `!about` - Information about AutoGuild

### Moderation Commands

- `!warn @user <reason>` - Warn a user
- `!modlogs [limit]` - View moderation logs

### Analytics Commands

- `!stats [@user]` - View user statistics
- `!leaderboard [limit]` - Top active users
- `!commands` - Command usage statistics (admin only)

### Engagement Commands

- `!ask <question>` - Ask the AI assistant
- `!poll <question> | <option1> | <option2>` - Create a poll
- `!welcome [@user]` - Send a welcome message

### Configuration Commands

- `!config` - View server configuration (admin only)
- `!config prefix <new_prefix>` - Change command prefix (admin only)

## 🏗️ Architecture

AutoGuild uses a modular, platform-agnostic architecture:

```
┌─────────────────────────────────────┐
│         Bot Core                    │
│  - Command Handler                  │
│  - Event Management                 │
│  - Plugin System                    │
└──────────────┬──────────────────────┘
               │
       ┌───────┴───────┐
       │               │
┌──────▼──────┐ ┌─────▼──────┐
│  Platform   │ │  Platform  │
│  Adapters   │ │  Adapters  │
│  (Discord)  │ │ (WhatsApp) │
└─────────────┘ └────────────┘
       │               │
┌──────▼───────────────▼──────┐
│    Universal Message         │
│    Abstraction Layer         │
└──────────────────────────────┘
       │
┌──────▼──────────────────────┐
│      Plugins                 │
│  - Moderation               │
│  - Analytics                │
│  - Engagement               │
│  - Custom Plugins           │
└─────────────────────────────┘
       │
┌──────▼──────────────────────┐
│   Services                   │
│  - AI Provider              │
│  - Database                 │
│  - Logger                   │
└─────────────────────────────┘
```

### Key Components

- **Platform Adapters** - Convert platform-specific events to universal format
- **Bot Core** - Central command handling and event routing
- **Plugins** - Modular features that extend bot functionality
- **AI Manager** - Unified interface for AI providers
- **Database** - SQLite-based persistent storage

## 🔧 Configuration

### Discord Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to "Bot" section and create a bot
4. Enable "Message Content Intent"
5. Copy the bot token to your `.env` file
6. Invite the bot using the OAuth2 URL generator

### WhatsApp Setup

1. Set `WHATSAPP_ENABLED=true` in `.env`
2. Run the bot
3. Scan the QR code with WhatsApp on your phone
4. The bot will authenticate and start working

### AI Provider Setup

#### Anthropic Claude
```env
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

#### OpenAI
```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo-preview
```

## 🔌 Plugin Development

Create custom plugins by implementing the `Plugin` interface:

```typescript
import { Plugin, PluginContext, UniversalMessage } from './types';

export class MyPlugin implements Plugin {
  name = 'MyPlugin';
  version = '1.0.0';
  description = 'My custom plugin';

  async initialize(context: PluginContext): Promise<void> {
    // Initialize your plugin
  }

  async onMessage(message: UniversalMessage): Promise<void> {
    // Handle incoming messages
  }

  commands = [
    {
      name: 'mycommand',
      description: 'My custom command',
      execute: async (ctx) => {
        // Command logic
      },
    },
  ];
}
```

Then load your plugin in `src/index.ts`:

```typescript
await bot.loadPlugin(new MyPlugin());
```

## 🗄️ Database

AutoGuild uses SQLite with better-sqlite3 for data persistence:

- **User Statistics** - Message counts, activity tracking
- **Guild Configuration** - Per-server settings
- **Moderation Logs** - Complete audit trail
- **Analytics** - Metrics and engagement data
- **Command Usage** - Track command popularity

Database location: `./data/autoguild.db`

## 📝 Logging

Logs are stored in the `logs/` directory:
- `combined.log` - All logs
- `error.log` - Error logs only

Console output is enabled in development mode.

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [discord.js](https://discord.js.org/) - Discord API wrapper
- [whatsapp-web.js](https://wwebjs.dev/) - WhatsApp API wrapper
- [OpenAI](https://openai.com/) - AI capabilities
- [Anthropic](https://anthropic.com/) - Claude AI models

## 📧 Support

For support, email support@autoguild.dev or join our Discord server.

## 🗺️ Roadmap

- [ ] Telegram support
- [ ] Slack support
- [ ] Web dashboard
- [ ] Advanced scheduling
- [ ] Custom AI training
- [ ] Multi-language support
- [ ] Voice channel management
- [ ] Advanced role management

---

Built with ❤️ for community managers everywhere.
