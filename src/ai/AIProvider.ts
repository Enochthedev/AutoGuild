import { AIProviderConfig, AIMessage, AIResponse } from '../types';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { Logger } from '../core/Logger';

export interface AIProvider {
  generateResponse(messages: AIMessage[], systemPrompt?: string): Promise<AIResponse>;
  generateCompletion(prompt: string): Promise<string>;
}

export class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  private logger: Logger;

  constructor(private config: AIProviderConfig) {
    this.client = new OpenAI({ apiKey: config.apiKey });
    this.logger = new Logger('OpenAIProvider');
  }

  async generateResponse(messages: AIMessage[], systemPrompt?: string): Promise<AIResponse> {
    try {
      const formattedMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

      if (systemPrompt) {
        formattedMessages.push({ role: 'system', content: systemPrompt });
      }

      formattedMessages.push(
        ...messages.map((msg) => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
        }))
      );

      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: formattedMessages,
        temperature: this.config.temperature || 0.7,
        max_tokens: this.config.maxTokens || 1000,
      });

      const choice = response.choices[0];
      return {
        content: choice.message.content || '',
        usage: response.usage
          ? {
              promptTokens: response.usage.prompt_tokens,
              completionTokens: response.usage.completion_tokens,
              totalTokens: response.usage.total_tokens,
            }
          : undefined,
        model: response.model,
      };
    } catch (error) {
      this.logger.error('Failed to generate OpenAI response', error);
      throw error;
    }
  }

  async generateCompletion(prompt: string): Promise<string> {
    const response = await this.generateResponse([{ role: 'user', content: prompt }]);
    return response.content;
  }
}

export class AnthropicProvider implements AIProvider {
  private client: Anthropic;
  private logger: Logger;

  constructor(private config: AIProviderConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey });
    this.logger = new Logger('AnthropicProvider');
  }

  async generateResponse(messages: AIMessage[], systemPrompt?: string): Promise<AIResponse> {
    try {
      const formattedMessages: Anthropic.MessageParam[] = messages.map((msg) => ({
        role: msg.role === 'system' ? 'user' : (msg.role as 'user' | 'assistant'),
        content: msg.content,
      }));

      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens || 1000,
        temperature: this.config.temperature || 0.7,
        system: systemPrompt,
        messages: formattedMessages,
      });

      const content =
        response.content[0].type === 'text' ? response.content[0].text : '';

      return {
        content,
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        },
        model: response.model,
      };
    } catch (error) {
      this.logger.error('Failed to generate Anthropic response', error);
      throw error;
    }
  }

  async generateCompletion(prompt: string): Promise<string> {
    const response = await this.generateResponse([{ role: 'user', content: prompt }]);
    return response.content;
  }
}

export class AIManager {
  private provider: AIProvider;
  private logger: Logger;

  constructor(config: AIProviderConfig) {
    this.logger = new Logger('AIManager');

    if (config.provider === 'openai') {
      this.provider = new OpenAIProvider(config);
      this.logger.info('Using OpenAI as AI provider');
    } else if (config.provider === 'anthropic') {
      this.provider = new AnthropicProvider(config);
      this.logger.info('Using Anthropic as AI provider');
    } else {
      throw new Error(`Unsupported AI provider: ${config.provider}`);
    }
  }

  async chat(messages: AIMessage[], systemPrompt?: string): Promise<AIResponse> {
    return this.provider.generateResponse(messages, systemPrompt);
  }

  async complete(prompt: string): Promise<string> {
    return this.provider.generateCompletion(prompt);
  }

  async moderateContent(content: string): Promise<{ flagged: boolean; reason?: string }> {
    const prompt = `Analyze the following content for moderation. Determine if it contains:
- Hate speech
- Harassment or bullying
- Spam
- Explicit content
- Dangerous or illegal activities

Content: "${content}"

Respond with a JSON object: {"flagged": true/false, "reason": "explanation if flagged"}`;

    try {
      const response = await this.complete(prompt);
      const result = JSON.parse(response);
      return result;
    } catch (error) {
      this.logger.error('Content moderation failed', error);
      return { flagged: false };
    }
  }

  async generateEngagementResponse(
    context: string,
    userMessage: string
  ): Promise<string> {
    const systemPrompt = `You are AutoGuild, a helpful and friendly community management bot.
Your role is to engage with community members, answer questions, and maintain a positive atmosphere.
Be concise, friendly, and helpful. ${context}`;

    const response = await this.chat(
      [{ role: 'user', content: userMessage }],
      systemPrompt
    );

    return response.content;
  }
}
