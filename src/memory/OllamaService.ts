/**
 * Ollama Service
 * 
 * Connects to a local Ollama instance for running LLMs like Phi-3 or Mistral.
 * Used for:
 * - Summarizing conversations for long-term memory
 * - Extracting facts and preferences
 * - Learning patterns from interactions
 */

import { Logger } from '../core/Logger';

export interface OllamaConfig {
    baseUrl: string;
    model: string;
    timeout: number;
}

const DEFAULT_CONFIG: OllamaConfig = {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'phi3:mini',
    timeout: 60000, // 60 seconds
};

export interface OllamaResponse {
    model: string;
    response: string;
    done: boolean;
    context?: number[];
    total_duration?: number;
    eval_count?: number;
}

export class OllamaService {
    private logger: Logger;
    private config: OllamaConfig;
    private isAvailable: boolean = false;

    constructor(config: Partial<OllamaConfig> = {}) {
        this.logger = new Logger('OllamaService');
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Check if Ollama is available
     */
    async checkAvailability(): Promise<boolean> {
        try {
            const response = await fetch(`${this.config.baseUrl}/api/tags`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000),
            });

            if (response.ok) {
                const data = await response.json() as any;
                this.logger.info(`Ollama available with ${data.models?.length || 0} models`);
                this.isAvailable = true;
                return true;
            }
        } catch (error) {
            this.logger.warn('Ollama not available - local LLM features disabled');
            this.isAvailable = false;
        }
        return false;
    }

    /**
     * Generate a completion from the local LLM
     */
    async generate(prompt: string, options: { model?: string; system?: string } = {}): Promise<string> {
        if (!this.isAvailable) {
            await this.checkAvailability();
            if (!this.isAvailable) {
                throw new Error('Ollama is not available');
            }
        }

        try {
            const response = await fetch(`${this.config.baseUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: options.model || this.config.model,
                    prompt,
                    system: options.system,
                    stream: false,
                }),
                signal: AbortSignal.timeout(this.config.timeout),
            });

            if (!response.ok) {
                throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json() as OllamaResponse;
            return data.response;
        } catch (error) {
            this.logger.error('Ollama generation failed', error);
            throw error;
        }
    }

    /**
     * Summarize a conversation for long-term memory storage
     */
    async summarizeConversation(conversation: string): Promise<string> {
        const prompt = `Summarize the following conversation into 1-3 key facts or events that should be remembered. Focus on:
- Important decisions made
- User preferences mentioned
- Events scheduled or discussed
- Key information shared

Conversation:
${conversation}

Summary (bullet points):`;

        try {
            return await this.generate(prompt, {
                system: 'You are a memory assistant that extracts and summarizes key information from conversations. Be concise and factual.',
            });
        } catch (error) {
            this.logger.warn('Failed to summarize conversation, using fallback');
            return '';
        }
    }

    /**
     * Extract facts from text
     */
    async extractFacts(text: string): Promise<string[]> {
        const prompt = `Extract distinct facts from this text. Return each fact on a new line.

Text:
${text}

Facts:`;

        try {
            const response = await this.generate(prompt, {
                system: 'Extract only factual statements. One fact per line. Be concise.',
            });

            return response
                .split('\n')
                .map(line => line.replace(/^[-•*]\s*/, '').trim())
                .filter(line => line.length > 10);
        } catch (error) {
            return [];
        }
    }

    /**
     * Determine importance of a memory (0-1)
     */
    async assessImportance(content: string): Promise<number> {
        const prompt = `Rate the importance of remembering this information on a scale of 0 to 10, where:
0 = trivial, forgettable
5 = moderately useful
10 = critical, must remember

Information: "${content}"

Respond with just a number:`;

        try {
            const response = await this.generate(prompt);
            const score = parseFloat(response.trim());
            if (!isNaN(score)) {
                return Math.max(0, Math.min(1, score / 10));
            }
        } catch (error) {
            // Fallback
        }
        return 0.5;
    }

    /**
     * Get available models
     */
    async getModels(): Promise<string[]> {
        try {
            const response = await fetch(`${this.config.baseUrl}/api/tags`);
            if (response.ok) {
                const data = await response.json() as any;
                return data.models?.map((m: any) => m.name) || [];
            }
        } catch (error) {
            this.logger.error('Failed to get Ollama models', error);
        }
        return [];
    }

    /**
     * Check if service is ready
     */
    available(): boolean {
        return this.isAvailable;
    }
}

// Singleton
let ollamaServiceInstance: OllamaService | null = null;

export function getOllamaService(): OllamaService {
    if (!ollamaServiceInstance) {
        ollamaServiceInstance = new OllamaService();
    }
    return ollamaServiceInstance;
}
