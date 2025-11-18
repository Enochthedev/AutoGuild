import { z } from 'zod';
import { Logger } from './Logger';
import dotenv from 'dotenv';

dotenv.config();

const ConfigSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'verbose', 'debug']).default('info'),

  // Command configuration
  COMMAND_PREFIX: z.string().default('!'),

  // Discord configuration
  DISCORD_TOKEN: z.string().optional(),
  DISCORD_CLIENT_ID: z.string().optional(),

  // WhatsApp configuration
  WHATSAPP_ENABLED: z.enum(['true', 'false']).default('false'),

  // AI Provider configuration
  AI_PROVIDER: z.enum(['openai', 'anthropic']).optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4-turbo-preview'),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-3-5-sonnet-20241022'),

  // Database
  DATABASE_PATH: z.string().default('./data/autoguild.db'),

  // Dashboard
  DASHBOARD_ENABLED: z.enum(['true', 'false']).default('false'),
  DASHBOARD_PORT: z.string().regex(/^\d+$/).default('3000'),

  // Features
  ENABLE_MODERATION: z.enum(['true', 'false']).default('true'),
  ENABLE_ANALYTICS: z.enum(['true', 'false']).default('true'),
  ENABLE_ENGAGEMENT_TRACKING: z.enum(['true', 'false']).default('true'),
  ENABLE_AUTO_RESPONSES: z.enum(['true', 'false']).default('true'),

  // Rate limiting
  RATE_LIMIT_ENABLED: z.enum(['true', 'false']).default('true'),
  RATE_LIMIT_WINDOW_MS: z.string().regex(/^\d+$/).default('60000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().regex(/^\d+$/).default('10'),

  // Retry configuration
  MAX_RETRY_ATTEMPTS: z.string().regex(/^\d+$/).default('3'),
  RETRY_DELAY_MS: z.string().regex(/^\d+$/).default('1000'),

  // Telegram (optional)
  TELEGRAM_TOKEN: z.string().optional(),
  TELEGRAM_ENABLED: z.enum(['true', 'false']).default('false'),

  // Slack (optional)
  SLACK_TOKEN: z.string().optional(),
  SLACK_ENABLED: z.enum(['true', 'false']).default('false'),

  // Microsoft Teams (optional)
  TEAMS_APP_ID: z.string().optional(),
  TEAMS_APP_PASSWORD: z.string().optional(),
  TEAMS_ENABLED: z.enum(['true', 'false']).default('false'),
});

export type Config = z.infer<typeof ConfigSchema>;

export class ConfigValidator {
  private logger: Logger;
  private config: Config;

  constructor() {
    this.logger = new Logger('ConfigValidator');
    this.config = this.validateConfig();
  }

  private validateConfig(): Config {
    try {
      const config = ConfigSchema.parse(process.env);
      this.logger.info('Configuration validated successfully');
      return config;
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.logger.error('Configuration validation failed:');
        error.errors.forEach((err) => {
          this.logger.error(`  - ${err.path.join('.')}: ${err.message}`);
        });
      }
      throw new Error('Invalid configuration. Please check your .env file.');
    }
  }

  public validatePlatformConfig(): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if at least one platform is configured
    const platforms = [
      this.config.DISCORD_TOKEN,
      this.config.WHATSAPP_ENABLED === 'true',
      this.config.TELEGRAM_ENABLED === 'true' && this.config.TELEGRAM_TOKEN,
      this.config.SLACK_ENABLED === 'true' && this.config.SLACK_TOKEN,
      this.config.TEAMS_ENABLED === 'true' && this.config.TEAMS_APP_ID,
    ];

    if (!platforms.some(Boolean)) {
      errors.push('No platform configured. Please configure at least one platform (Discord, WhatsApp, Telegram, Slack, or Teams).');
    }

    // Discord validation
    if (this.config.DISCORD_TOKEN && !this.config.DISCORD_CLIENT_ID) {
      warnings.push('DISCORD_CLIENT_ID is not set. Some features may not work correctly.');
    }

    // AI validation
    if (this.config.AI_PROVIDER) {
      if (this.config.AI_PROVIDER === 'openai' && !this.config.OPENAI_API_KEY) {
        errors.push('AI_PROVIDER is set to "openai" but OPENAI_API_KEY is not configured.');
      }
      if (this.config.AI_PROVIDER === 'anthropic' && !this.config.ANTHROPIC_API_KEY) {
        errors.push('AI_PROVIDER is set to "anthropic" but ANTHROPIC_API_KEY is not configured.');
      }
    } else if (
      this.config.ENABLE_MODERATION === 'true' ||
      this.config.ENABLE_AUTO_RESPONSES === 'true'
    ) {
      warnings.push('AI-dependent features are enabled but no AI provider is configured.');
    }

    // Telegram validation
    if (this.config.TELEGRAM_ENABLED === 'true' && !this.config.TELEGRAM_TOKEN) {
      errors.push('Telegram is enabled but TELEGRAM_TOKEN is not configured.');
    }

    // Slack validation
    if (this.config.SLACK_ENABLED === 'true' && !this.config.SLACK_TOKEN) {
      errors.push('Slack is enabled but SLACK_TOKEN is not configured.');
    }

    // Teams validation
    if (this.config.TEAMS_ENABLED === 'true') {
      if (!this.config.TEAMS_APP_ID || !this.config.TEAMS_APP_PASSWORD) {
        errors.push('Teams is enabled but TEAMS_APP_ID or TEAMS_APP_PASSWORD is not configured.');
      }
    }

    return { errors, warnings };
  }

  public getConfig(): Config {
    return this.config;
  }

  public printConfigSummary(): void {
    const validation = this.validatePlatformConfig();

    this.logger.info('=== AutoGuild Configuration Summary ===');
    this.logger.info(`Environment: ${this.config.NODE_ENV}`);
    this.logger.info(`Log Level: ${this.config.LOG_LEVEL}`);
    this.logger.info(`Command Prefix: ${this.config.COMMAND_PREFIX}`);
    this.logger.info('');
    this.logger.info('Platforms:');
    this.logger.info(`  - Discord: ${this.config.DISCORD_TOKEN ? '✓ Enabled' : '✗ Disabled'}`);
    this.logger.info(`  - WhatsApp: ${this.config.WHATSAPP_ENABLED === 'true' ? '✓ Enabled' : '✗ Disabled'}`);
    this.logger.info(`  - Telegram: ${this.config.TELEGRAM_ENABLED === 'true' ? '✓ Enabled' : '✗ Disabled'}`);
    this.logger.info(`  - Slack: ${this.config.SLACK_ENABLED === 'true' ? '✓ Enabled' : '✗ Disabled'}`);
    this.logger.info(`  - Teams: ${this.config.TEAMS_ENABLED === 'true' ? '✓ Enabled' : '✗ Disabled'}`);
    this.logger.info('');
    this.logger.info('Features:');
    this.logger.info(`  - AI Provider: ${this.config.AI_PROVIDER || 'Not configured'}`);
    this.logger.info(`  - Moderation: ${this.config.ENABLE_MODERATION === 'true' ? '✓ Enabled' : '✗ Disabled'}`);
    this.logger.info(`  - Analytics: ${this.config.ENABLE_ANALYTICS === 'true' ? '✓ Enabled' : '✗ Disabled'}`);
    this.logger.info(`  - Auto Responses: ${this.config.ENABLE_AUTO_RESPONSES === 'true' ? '✓ Enabled' : '✗ Disabled'}`);
    this.logger.info(`  - Rate Limiting: ${this.config.RATE_LIMIT_ENABLED === 'true' ? '✓ Enabled' : '✗ Disabled'}`);
    this.logger.info(`  - Dashboard: ${this.config.DASHBOARD_ENABLED === 'true' ? `✓ Enabled (Port ${this.config.DASHBOARD_PORT})` : '✗ Disabled'}`);

    if (validation.warnings.length > 0) {
      this.logger.warn('');
      this.logger.warn('Configuration Warnings:');
      validation.warnings.forEach((warning) => {
        this.logger.warn(`  ⚠ ${warning}`);
      });
    }

    if (validation.errors.length > 0) {
      this.logger.error('');
      this.logger.error('Configuration Errors:');
      validation.errors.forEach((error) => {
        this.logger.error(`  ✗ ${error}`);
      });
      throw new Error('Configuration validation failed. Please fix the errors above.');
    }

    this.logger.info('');
    this.logger.info('Configuration validated successfully!');
    this.logger.info('======================================');
  }
}
