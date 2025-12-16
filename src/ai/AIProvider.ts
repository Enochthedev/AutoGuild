import { AIProviderConfig, AIMessage, AIResponse } from '../types';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { Logger } from '../core/Logger';

export interface AIProvider {
  generateResponse(messages: AIMessage[], systemPrompt?: string): Promise<AIResponse>;
  generateCompletion(prompt: string): Promise<string>;
  generateEmbedding(text: string): Promise<number[]>;
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

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
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

  async generateEmbedding(text: string): Promise<number[]> {
    throw new Error('Anthropic does not support embeddings directly.');
  }
}

export class OpenRouterProvider implements AIProvider {
  private client: OpenAI;
  private logger: Logger;

  constructor(private config: AIProviderConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
    });
    this.logger = new Logger('OpenRouterProvider');
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
        transforms: ['middle-out'], // Automatically compress prompts that exceed context limit
      } as any);

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
      this.logger.error('Failed to generate OpenRouter response', error);
      throw error;
    }
  }

  async generateCompletion(prompt: string): Promise<string> {
    const response = await this.generateResponse([{ role: 'user', content: prompt }]);
    return response.content;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    // OpenRouter might support embeddings, but consistent API varies
    throw new Error('OpenRouter embeddings not implemented yet.');
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
    } else if (config.provider === 'openrouter') {
      this.provider = new OpenRouterProvider(config);
      this.logger.info('Using OpenRouter as AI provider');
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

  async generateEmbedding(text: string): Promise<number[]> {
    return this.provider.generateEmbedding(text);
  }

  async moderateContent(content: string): Promise<{ flagged: boolean; reason?: string }> {
    // For moderation, we can use a cheaper/faster model if supported by the provider
    // This is handled by the provider configuration for now, but in future could be overridden per request
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
      // Attempt to parse JSON cleanly, handling potential markdown code blocks
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : response;
      const result = JSON.parse(jsonStr);
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
    const systemPrompt = `You are a regular member of this group chat named Sox.
Your goal is to reply just like a text message to a friend.
- Keep it casual, short, and punchy.
- Don't act like a customer service bot.
- Use lowercase often, maybe some slang if it fits, but keep it readable.
- If someone asks about the server ("what is the best thing to do"), give a genuine, cool recommendation based on typical community vibes.
- Don't use heavy formatting or bullet points unless absolutely necessary.
- Be helpful but chill.

Context: ${context}`;

    const response = await this.chat(
      [{ role: 'user', content: userMessage }],
      systemPrompt
    );

    return response.content;
  }

  async generateAutonomousResponse(
    context: string,
    userMessage: string
  ): Promise<import('../types').AIActionResponse> {
    const toolsPrompt = `
You are an autonomous AI community manager named Sox.
You have the power to MANAGE the server/community directly using actions.
You possess DEEP MEMORY:
- You automatically recall relevant facts, user preferences, and past events from your Long-Term Memory (provided in Context).
- You remember the recent conversation history (provided in Context).
- You can store new specific memories if explicitly asked to "remember" something.

AVAILABLE ACTIONS:
1. create_channel
   - params: { name: string, type: 'text'|'voice' }
   - description: Create a new channel for specific topics, games, or events.
2. delete_channel
   - params: { channel_id: string }
   - description: Delete an existing channel. Careful with this!
3. store_memory
   - params: { key: string, value: any }
   - description: Explicitly store a key-value pair for critical data (e.g. game state). Use sparingly; normal conversation is remembered automatically.
4. trace_cost
   - params: { tokens: { prompt: number, completion: number } }
   - description: Internal use only. Start response with this if you want to track cost.

INSTRUCTIONS:
- Analyze the user's request.
- If they ask to do something you can do (like "host a dnd game"), CREATE the necessary channels and SET UP the game state using actions.
- If they ask to DELETE a channel (e.g., "delete this channel"), use the delete_channel action.
- If it's a normal chat, just respond normally.
- You MUST respond in valid JSON format.

JSON FORMAT:
{
  "response": "Your conversational text response to the user",
  "actions": [
    {
      "type": "create_channel" | "delete_channel" | "store_memory" | "read_memory",
      "params": { ... },
      "reason": "Why you are taking this action"
    }
  ]
}

Example:
User: "Let's play D&D!"
JSON:
{
  "response": "Awesome! I'll set up a D&D channel for us.",
  "actions": [
    { "type": "create_channel", "params": { "name": "dnd-campaign", "type": "text" }, "reason": "User initiated a D&D game" }
  ]
}
`;

    const fullPrompt = `${toolsPrompt}\n\nContext: ${context}`;

    try {
      const response = await this.chat(
        [{ role: 'user', content: userMessage }],
        fullPrompt
      );

      // Clean up markdown code blocks if present (e.g. ```json ... ```)
      const cleanContent = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanContent);
      return parsed;
    } catch (error) {
      this.logger.error('Failed to parse autonomous response', error);
      // Fallback to text-only response
      return {
        response: "I'm having a bit of trouble processing that request right now.",
        actions: []
      };
    }
  }
}

