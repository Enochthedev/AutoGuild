# Contributing to AutoGuild

Thank you for your interest in contributing to AutoGuild! This document provides guidelines and instructions for contributing.

## 🌟 How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When creating a bug report, include:

- **Clear title and description**
- **Steps to reproduce** the behavior
- **Expected behavior** vs actual behavior
- **Screenshots** if applicable
- **Environment details** (OS, Node.js version, etc.)
- **Log files** from `logs/` directory

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

- **Use a clear and descriptive title**
- **Provide detailed description** of the suggested enhancement
- **Explain why this enhancement would be useful**
- **List any similar features** in other bots if applicable

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Make your changes** following our coding standards
3. **Add tests** if applicable
4. **Update documentation** as needed
5. **Ensure tests pass** by running `npm test`
6. **Submit your pull request**

## 💻 Development Setup

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- Git
- TypeScript knowledge

### Setup Steps

1. Fork and clone the repository:
```bash
git clone https://github.com/your-username/autoguild.git
cd autoguild
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file:
```bash
cp .env.example .env
```

4. Add your test credentials to `.env`

5. Start development:
```bash
npm run dev
```

## 📝 Coding Standards

### TypeScript Guidelines

- **Use TypeScript** for all new code
- **Type everything** - avoid `any` when possible
- **Use interfaces** for object shapes
- **Use enums** for fixed sets of values
- **Export types** from `src/types/index.ts`

### Code Style

- **Use Prettier** for formatting: `npm run format`
- **Use ESLint** for linting: `npm run lint`
- **2 spaces** for indentation
- **Single quotes** for strings
- **Semicolons** required
- **No trailing whitespace**

### Example Code Structure

```typescript
import { Plugin, PluginContext } from '../types';
import { Logger } from '../core/Logger';

export class ExamplePlugin implements Plugin {
  name = 'ExamplePlugin';
  version = '1.0.0';
  description = 'Example plugin description';

  private context!: PluginContext;
  private logger: Logger;

  constructor() {
    this.logger = new Logger('ExamplePlugin');
  }

  async initialize(context: PluginContext): Promise<void> {
    this.context = context;
    this.logger.info('Plugin initialized');
  }

  // Your plugin logic here
}
```

### Naming Conventions

- **Classes**: PascalCase (e.g., `DiscordAdapter`, `ModerationPlugin`)
- **Functions/Methods**: camelCase (e.g., `getUserStats`, `sendMessage`)
- **Variables**: camelCase (e.g., `messageCount`, `userId`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_RETRIES`, `DEFAULT_PREFIX`)
- **Interfaces**: PascalCase with descriptive names (e.g., `UniversalMessage`, `CommandContext`)
- **Enums**: PascalCase (e.g., `Platform`, `UserRole`)

## 🔌 Adding New Platforms

To add support for a new platform:

1. **Create a new adapter** in `src/adapters/`:

```typescript
import { BasePlatformAdapter } from './BasePlatformAdapter';
import { Platform } from '../types';

export class TelegramAdapter extends BasePlatformAdapter {
  constructor(token: string, eventEmitter: EventEmitter) {
    super(Platform.TELEGRAM);
    // Initialize platform client
  }

  async initialize(): Promise<void> {
    // Setup platform connection
  }

  // Implement required methods
}
```

2. **Add platform to enum** in `src/types/index.ts`:

```typescript
export enum Platform {
  DISCORD = 'discord',
  WHATSAPP = 'whatsapp',
  TELEGRAM = 'telegram', // New platform
}
```

3. **Update BotCore** to support the new platform in `src/core/BotCore.ts`

4. **Add configuration** to `.env.example`

5. **Update documentation** in README.md

## 🧪 Testing

While we don't have comprehensive tests yet, please:

- **Test your changes manually** on all affected platforms
- **Test edge cases** and error conditions
- **Verify existing functionality** still works
- **Document test scenarios** in your PR

Future: We'll be adding Jest tests. Contributions to testing infrastructure are welcome!

## 📚 Documentation

When adding new features:

- **Update README.md** with usage examples
- **Add JSDoc comments** to public APIs
- **Update ARCHITECTURE.md** if changing core structure
- **Add inline comments** for complex logic
- **Update .env.example** for new configuration

### Documentation Style

```typescript
/**
 * Sends a message to a specific channel
 *
 * @param channelId - The ID of the channel to send to
 * @param content - The message content to send
 * @param options - Optional platform-specific options
 * @throws {Error} If the channel is not found or message fails to send
 * @returns Promise that resolves when message is sent
 */
async sendMessage(channelId: string, content: string, options?: any): Promise<void>
```

## 🎯 Plugin Development

### Plugin Checklist

- [ ] Implements `Plugin` interface
- [ ] Has clear name, version, and description
- [ ] Includes error handling
- [ ] Uses logger for important events
- [ ] Documents all commands
- [ ] Handles permissions appropriately
- [ ] Works across all supported platforms (or specifies platform restrictions)

### Plugin Template

```typescript
import { Plugin, PluginContext, CommandContext } from '../types';

export class TemplatePlugin implements Plugin {
  name = 'TemplatePlugin';
  version = '1.0.0';
  description = 'Plugin description';

  private context!: PluginContext;

  async initialize(context: PluginContext): Promise<void> {
    this.context = context;
    // Setup logic
  }

  async shutdown(): Promise<void> {
    // Cleanup logic
  }

  async onMessage(message: UniversalMessage): Promise<void> {
    // Message handling logic
  }

  commands = [
    {
      name: 'example',
      description: 'Example command',
      usage: '!example <arg>',
      execute: async (ctx: CommandContext) => {
        // Command logic
      },
    },
  ];
}
```

## 🐛 Debugging

### Enable Debug Logging

Set in `.env`:
```env
LOG_LEVEL=debug
```

### Common Issues

**Database locked**: Ensure only one instance is running
**Platform not connecting**: Check API keys and network
**AI not working**: Verify API key and model name
**Commands not responding**: Check prefix configuration

### Debug Tools

- Check `logs/error.log` for errors
- Use `!ping` to verify bot is responsive
- Monitor console output in development mode
- Use database browser to inspect SQLite database

## 🚀 Release Process

(For maintainers)

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Create git tag: `git tag v1.x.x`
4. Push tag: `git push origin v1.x.x`
5. Create GitHub release with notes
6. Build and publish if applicable

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

## 💬 Communication

- **GitHub Issues** - Bug reports and feature requests
- **Pull Requests** - Code contributions and discussions
- **Discussions** - General questions and ideas

## ✅ Contribution Checklist

Before submitting a PR:

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tested on relevant platforms
- [ ] Commit messages are clear

## 🙏 Thank You!

Your contributions make AutoGuild better for everyone. We appreciate your time and effort!

---

Happy Contributing! 🎉
