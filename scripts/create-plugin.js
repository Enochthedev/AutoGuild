#!/usr/bin/env node

/**
 * Plugin Generator CLI
 *
 * Usage: node scripts/create-plugin.js <plugin-name>
 * Example: node scripts/create-plugin.js MyAwesomePlugin
 */

const fs = require('fs');
const path = require('path');

const pluginName = process.argv[2];

if (!pluginName) {
  console.error('❌ Error: Please provide a plugin name');
  console.log('Usage: node scripts/create-plugin.js <PluginName>');
  console.log('Example: node scripts/create-plugin.js MyAwesomePlugin');
  process.exit(1);
}

// Validate plugin name
if (!/^[A-Z][a-zA-Z0-9]*Plugin$/.test(pluginName)) {
  console.error('❌ Error: Plugin name must:');
  console.error('   - Start with a capital letter');
  console.error('   - Contain only letters and numbers');
  console.error('   - End with "Plugin"');
  console.error('Example: MyAwesomePlugin');
  process.exit(1);
}

const pluginTemplate = `import { Plugin, PluginContext, UniversalMessage, CommandContext, UserRole } from '../types';

export class ${pluginName} implements Plugin {
  name = '${pluginName}';
  version = '1.0.0';
  description = 'Description of your plugin';

  private context!: PluginContext;

  async initialize(context: PluginContext): Promise<void> {
    this.context = context;
    this.context.logger.info('${pluginName} initialized');

    // TODO: Initialize your plugin
  }

  async shutdown(): Promise<void> {
    this.context.logger.info('${pluginName} shutting down');

    // TODO: Clean up resources
  }

  async onMessage(message: UniversalMessage): Promise<void> {
    if (message.author.isBot) return;

    // TODO: Handle incoming messages
  }

  commands = [
    {
      name: 'example',
      description: 'Example command',
      usage: '!example',
      execute: async (ctx: CommandContext) => {
        const adapter = this.context.bot.getAdapter(ctx.platform);

        // TODO: Implement command logic
        await adapter?.sendMessage(
          ctx.channel.id,
          'Hello from ${pluginName}!'
        );
      },
    },
  ];
}
`;

const testTemplate = `import { ${pluginName} } from './${pluginName}';

describe('${pluginName}', () => {
  let plugin: ${pluginName};

  beforeEach(() => {
    plugin = new ${pluginName}();
  });

  it('should initialize correctly', async () => {
    const context: any = {
      logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      },
      bot: {},
      config: {},
      database: {},
    };

    await plugin.initialize(context);
    expect(context.logger.info).toHaveBeenCalledWith('${pluginName} initialized');
  });

  it('should have correct metadata', () => {
    expect(plugin.name).toBe('${pluginName}');
    expect(plugin.version).toBe('1.0.0');
    expect(plugin.description).toBeDefined();
  });

  it('should have commands defined', () => {
    expect(plugin.commands).toBeDefined();
    expect(Array.isArray(plugin.commands)).toBe(true);
  });

  // TODO: Add more tests
});
`;

const readmeTemplate = `# ${pluginName}

## Description

TODO: Describe what your plugin does

## Features

- TODO: List features

## Commands

### \`!example\`

TODO: Describe command

**Usage:** \`!example\`

**Permissions:** None

## Configuration

TODO: Document any configuration options

## Installation

This plugin is automatically loaded when AutoGuild starts.

## Development

### Testing

\`\`\`bash
npm test -- ${pluginName}
\`\`\`

### Building

\`\`\`bash
npm run build
\`\`\`

## License

MIT
`;

// Create plugin file
const pluginDir = path.join(__dirname, '../src/plugins');
const pluginPath = path.join(pluginDir, `${pluginName}.ts`);

if (fs.existsSync(pluginPath)) {
  console.error(`❌ Error: Plugin ${pluginName} already exists at ${pluginPath}`);
  process.exit(1);
}

try {
  // Ensure plugins directory exists
  if (!fs.existsSync(pluginDir)) {
    fs.mkdirSync(pluginDir, { recursive: true });
  }

  // Write plugin file
  fs.writeFileSync(pluginPath, pluginTemplate);
  console.log(`✅ Created plugin: ${pluginPath}`);

  // Create test file
  const testDir = path.join(__dirname, '../tests/plugins');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  const testPath = path.join(testDir, `${pluginName}.test.ts`);
  fs.writeFileSync(testPath, testTemplate);
  console.log(`✅ Created test: ${testPath}`);

  // Create README
  const docsDir = path.join(__dirname, '../docs/plugins');
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  const readmePath = path.join(docsDir, `${pluginName}.md`);
  fs.writeFileSync(readmePath, readmeTemplate);
  console.log(`✅ Created docs: ${readmePath}`);

  console.log('');
  console.log('🎉 Plugin created successfully!');
  console.log('');
  console.log('Next steps:');
  console.log(`1. Edit ${pluginPath} to implement your plugin`);
  console.log(`2. Add tests in ${testPath}`);
  console.log(`3. Document your plugin in ${readmePath}`);
  console.log(`4. Load your plugin in src/index.ts:`);
  console.log('');
  console.log(`   import { ${pluginName} } from './plugins/${pluginName}';`);
  console.log(`   await bot.loadPlugin(new ${pluginName}());`);
  console.log('');
  console.log('Happy coding! 🚀');
} catch (error) {
  console.error('❌ Error creating plugin:', error.message);
  process.exit(1);
}
