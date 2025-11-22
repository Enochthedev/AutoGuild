# 🌐 AutoGuild Platform Support

AutoGuild supports **7 messaging platforms**, making it the most versatile community management bot available.

## Supported Platforms

### ✅ Discord
- **Status**: Fully supported
- **SDK**: discord.js v14
- **Features**: All features supported
- **Setup**: [Discord Developer Portal](https://discord.com/developers/applications)

**Configuration:**
```env
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_discord_client_id_here
```

---

### ✅ WhatsApp
- **Status**: Fully supported
- **SDK**: whatsapp-web.js
- **Features**: All features supported
- **Setup**: QR code authentication

**Configuration:**
```env
WHATSAPP_ENABLED=true
```

**Setup Steps:**
1. Enable WhatsApp in `.env`
2. Run the bot
3. Scan QR code with WhatsApp mobile app
4. Bot will authenticate and start

---

### ✅ Telegram
- **Status**: Fully supported
- **SDK**: node-telegram-bot-api
- **Features**: All features supported
- **Setup**: [@BotFather](https://t.me/botfather)

**Configuration:**
```env
TELEGRAM_ENABLED=true
TELEGRAM_TOKEN=your_telegram_bot_token_here
```

**Setup Steps:**
1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Use `/newbot` command
3. Follow prompts to create your bot
4. Copy the token to `.env`

---

### ✅ Slack
- **Status**: Fully supported
- **SDK**: @slack/bolt v3
- **Features**: All features supported
- **Setup**: [Slack API Dashboard](https://api.slack.com/apps)

**Configuration:**
```env
SLACK_ENABLED=true
SLACK_TOKEN=your_slack_bot_token_here
SLACK_SIGNING_SECRET=your_slack_signing_secret_here
SLACK_PORT=3002
```

**Setup Steps:**
1. Create a new app at https://api.slack.com/apps
2. Add Bot Token Scopes: `chat:write`, `app_mentions:read`, `channels:history`
3. Install app to workspace
4. Copy Bot User OAuth Token and Signing Secret to `.env`

---

### ✅ Microsoft Teams
- **Status**: Fully supported
- **SDK**: botbuilder v4
- **Features**: All features supported
- **Setup**: [Azure Bot Service](https://portal.azure.com/)

**Configuration:**
```env
TEAMS_ENABLED=true
TEAMS_APP_ID=your_teams_app_id_here
TEAMS_APP_PASSWORD=your_teams_app_password_here
TEAMS_PORT=3003
```

**Setup Steps:**
1. Register bot at [Azure Bot Service](https://portal.azure.com/)
2. Create Microsoft App ID and Password
3. Configure messaging endpoint: `https://yourdomain.com:3003/api/messages`
4. Add to Teams channel

**Note:** Teams requires a public HTTPS endpoint for webhooks.

---

### ✅ Matrix
- **Status**: Fully supported
- **SDK**: matrix-js-sdk v31
- **Features**: All features supported
- **Setup**: Any Matrix homeserver

**Configuration:**
```env
MATRIX_ENABLED=true
MATRIX_HOMESERVER=https://matrix.org
MATRIX_ACCESS_TOKEN=your_matrix_access_token_here
MATRIX_USER_ID=@bot:matrix.org
```

**Setup Steps:**
1. Create account on Matrix homeserver (e.g., https://matrix.org)
2. Get access token:
   ```bash
   curl -X POST -d '{"type":"m.login.password", "user":"yourbot", "password":"yourpassword"}' \
        "https://matrix.org/_matrix/client/r0/login"
   ```
3. Copy `access_token` and `user_id` to `.env`

**Features:**
- End-to-end encrypted messaging
- Decentralized protocol
- Federation with other homeservers
- Message editing and deletion support

---

### ✅ Guilded
- **Status**: Fully supported
- **SDK**: WebSocket + REST API
- **Features**: All features supported
- **Setup**: [Guilded Developer Portal](https://www.guilded.gg/developers)

**Configuration:**
```env
GUILDED_ENABLED=true
GUILDED_TOKEN=your_guilded_bot_token_here
```

**Setup Steps:**
1. Go to [Guilded Developer Portal](https://www.guilded.gg/developers)
2. Create a new bot
3. Copy the bot token
4. Add bot to your Guilded server
5. Configure permissions

**Features:**
- Gaming-focused communities
- Server and channel management
- Rich media support
- WebSocket real-time updates

---

## Feature Comparison

| Feature | Discord | WhatsApp | Telegram | Slack | Teams | Matrix | Guilded |
|---------|---------|----------|----------|-------|-------|--------|---------|
| Text Messages | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Image Support | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Video Support | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| File Sharing | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Message Editing | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Message Deletion | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Roles/Permissions | ✅ | ⚠️ | ⚠️ | ✅ | ✅ | ⚠️ | ✅ |
| Server/Guild Concept | ✅ | ❌ | ❌ | ✅ | ✅ | ⚠️ | ✅ |
| Channel Support | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| AI Commands | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Moderation | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Analytics | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

✅ = Full Support | ⚠️ = Partial Support | ❌ = Not Supported

---

## Multi-Platform Features

All platforms support:
- ✅ **Commands** - All bot commands work universally
- ✅ **AI Integration** - OpenAI and Anthropic support
- ✅ **Moderation** - Content filtering and warnings
- ✅ **Analytics** - User tracking and statistics
- ✅ **Database** - Persistent storage across platforms
- ✅ **Rate Limiting** - Per-user command throttling
- ✅ **Logging** - Comprehensive activity logs

---

## Adding Your Own Platform

Want to add support for another platform? It's easy!

1. **Create Adapter** in `src/adapters/YourPlatformAdapter.ts`:
```typescript
import { BasePlatformAdapter } from './BasePlatformAdapter';
import { Platform } from '../types';

export class YourPlatformAdapter extends BasePlatformAdapter {
  constructor(token: string, eventEmitter: EventEmitter) {
    super(Platform.YOURPLATFORM);
    // Initialize your platform SDK
  }

  async initialize(): Promise<void> {
    // Connect to platform
  }

  async sendMessage(channelId: string, content: string): Promise<void> {
    // Send message implementation
  }

  // Implement other required methods...
}
```

2. **Update Types** in `src/types/index.ts`:
```typescript
export enum Platform {
  // ...existing platforms
  YOURPLATFORM = 'yourplatform',
}
```

3. **Register in BotCore** (`src/core/BotCore.ts`)
4. **Add Configuration** to `.env.example`
5. **Update Documentation**

See `CONTRIBUTING.md` for detailed instructions!

---

## Platform-Specific Notes

### Discord
- Requires "Message Content Intent" enabled
- Best for gaming communities
- Rich embed support

### WhatsApp
- Requires phone number for authentication
- Personal and business accounts supported
- No message editing support

### Telegram
- Fast and lightweight
- Inline bot support
- Excellent group management

### Slack
- Enterprise-focused
- Workspace integration
- Advanced permissions

### Microsoft Teams
- Enterprise communication
- Office 365 integration
- Requires public endpoint

### Matrix
- Decentralized and open-source
- End-to-end encryption
- Federation support

### Guilded
- Gaming community focus
- Tournament and calendar features
- Free voice channels

---

## Roadmap

Future platform support planned:
- [ ] IRC (Internet Relay Chat)
- [ ] Mattermost
- [ ] Rocket.Chat
- [ ] Zulip
- [ ] Element (Matrix client)
- [ ] Revolt

Want to see a platform added? [Open an issue](https://github.com/yourusername/autoguild/issues)!
