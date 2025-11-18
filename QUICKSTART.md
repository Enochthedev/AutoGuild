# 🚀 AutoGuild Quick Start Guide

Get AutoGuild up and running in 5 minutes!

## Step 1: Install Dependencies

```bash
# Make sure you have Node.js 18+ installed
node --version

# Install project dependencies
npm install
```

## Step 2: Get Your API Keys

### Discord Bot Token (Required for Discord)

1. Go to https://discord.com/developers/applications
2. Click "New Application" and give it a name
3. Go to "Bot" section in the left sidebar
4. Click "Add Bot"
5. Under "Privileged Gateway Intents", enable:
   - MESSAGE CONTENT INTENT ✓
   - SERVER MEMBERS INTENT ✓
6. Click "Reset Token" and copy your token
7. Save it for the next step!

### AI API Key (Required for AI features)

Choose one:

**Option A: Anthropic Claude** (Recommended)
1. Go to https://console.anthropic.com/
2. Create an account
3. Go to "API Keys"
4. Create a new API key
5. Copy the key (starts with `sk-ant-...`)

**Option B: OpenAI**
1. Go to https://platform.openai.com/
2. Create an account
3. Go to "API Keys"
4. Create a new secret key
5. Copy the key (starts with `sk-...`)

## Step 3: Configure Environment

```bash
# Copy the example environment file
cp .env.example .env
```

Edit the `.env` file with your favorite text editor:

```env
# Discord Configuration
DISCORD_TOKEN=paste_your_discord_token_here
DISCORD_CLIENT_ID=paste_your_discord_client_id_here

# AI Configuration (choose Anthropic or OpenAI)
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=paste_your_anthropic_key_here
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# Features (all enabled by default)
ENABLE_MODERATION=true
ENABLE_ANALYTICS=true
ENABLE_AUTO_RESPONSES=true
```

## Step 4: Invite Bot to Discord

1. Go back to https://discord.com/developers/applications
2. Select your application
3. Go to "OAuth2" → "URL Generator"
4. Select scopes:
   - `bot` ✓
   - `applications.commands` ✓
5. Select bot permissions:
   - Read Messages/View Channels ✓
   - Send Messages ✓
   - Manage Messages ✓
   - Read Message History ✓
6. Copy the generated URL at the bottom
7. Paste it in your browser and invite the bot to your server

## Step 5: Run the Bot!

### Development Mode (with auto-reload)
```bash
npm run dev
```

### Production Mode
```bash
npm run build
npm start
```

## Step 6: Test Your Bot

In Discord, try these commands:

```
!ping          # Check if bot is responsive
!help          # See all available commands
!about         # Information about AutoGuild
!ask What is the meaning of life?  # Test AI
```

## 🎉 You're All Set!

Your bot should now be running and responding to commands!

## Next Steps

### Enable WhatsApp (Optional)

1. Edit `.env`:
```env
WHATSAPP_ENABLED=true
```

2. Restart the bot:
```bash
npm run dev
```

3. Scan the QR code that appears with WhatsApp on your phone

4. Done! Bot will now work in WhatsApp groups too

### Customize Your Bot

Edit `src/index.ts` to:
- Add/remove plugins
- Change command prefix
- Add custom features

### Create Custom Commands

1. Edit an existing plugin in `src/plugins/`
2. Or create a new plugin (see CONTRIBUTING.md)
3. Restart the bot

## Common Issues

### Bot doesn't respond
- ✓ Check that MESSAGE CONTENT INTENT is enabled in Discord
- ✓ Verify your token is correct in `.env`
- ✓ Make sure the bot has permission to read/send messages
- ✓ Check if you're using the correct command prefix (default: `!`)

### AI commands don't work
- ✓ Verify your AI API key is correct
- ✓ Check that AI_PROVIDER matches your key (anthropic or openai)
- ✓ Ensure you have credits/balance in your AI provider account

### WhatsApp QR code doesn't appear
- ✓ Make sure `WHATSAPP_ENABLED=true` in `.env`
- ✓ Try deleting `.wwebjs_auth/` folder and restarting

### Database errors
- ✓ Ensure `data/` directory exists (created automatically)
- ✓ Check file permissions
- ✓ Only run one instance of the bot at a time

## Getting Help

- 📖 Read the full [README.md](README.md)
- 🏗️ Learn about the [Architecture](ARCHITECTURE.md)
- 🤝 Check [Contributing Guide](CONTRIBUTING.md)
- 🐛 Report issues on GitHub

## Commands Cheat Sheet

### Basic Commands
- `!help` - List all commands
- `!help <command>` - Get help for a specific command
- `!ping` - Check bot latency
- `!about` - Bot information

### Moderation (requires Moderator role)
- `!warn @user <reason>` - Warn a user
- `!modlogs [limit]` - View moderation logs

### Analytics
- `!stats [@user]` - View user statistics
- `!leaderboard [limit]` - Top active users
- `!commands` - Command usage stats (admin only)

### Engagement
- `!ask <question>` - Ask the AI assistant
- `!poll <question> | <option1> | <option2>` - Create a poll
- `!welcome [@user]` - Send welcome message

### Configuration (Admin only)
- `!config` - View current configuration
- `!config prefix <new_prefix>` - Change command prefix

---

Happy botting! 🤖✨
