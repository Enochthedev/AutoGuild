/**
 * Short-Term Memory (STM)
 * 
 * Fast, in-memory storage for recent conversation context.
 * Automatically expires old messages and maintains per-channel history.
 */

import { ShortTermMessage, MemoryConfig, DEFAULT_MEMORY_CONFIG } from './types';
import { Logger } from '../core/Logger';

export class ShortTermMemory {
    private logger: Logger;
    private config: MemoryConfig;

    private conversations: Map<string, ShortTermMessage[]>;

    // Cleanup interval
    private cleanupInterval: NodeJS.Timeout | null = null;

    constructor(config: Partial<MemoryConfig> = {}) {
        this.logger = new Logger('ShortTermMemory');
        this.config = { ...DEFAULT_MEMORY_CONFIG, ...config };
        this.conversations = new Map();

        // Start cleanup interval
        this.startCleanup();
    }

    /**
     * Add a message to the short-term memory
     */
    add(message: ShortTermMessage): void {
        // Composite key to ensure uniqueness across platforms
        const key = this.getCompositeKey(message.platform, message.channelId);

        if (!this.conversations.has(key)) {
            this.conversations.set(key, []);
        }

        const history = this.conversations.get(key)!;
        history.push(message);

        // Prune old messages if exceeding limit
        if (history.length > this.config.shortTermMaxMessages) {
            history.shift();
        }
    }

    /**
     * Get recent conversation context as a string
     */
    getContextString(channelId: string, limit: number = 6, platform: string = 'discord'): string {
        const key = this.getCompositeKey(platform, channelId);
        const history = this.conversations.get(key) || [];

        return history
            .slice(-limit)
            .map(msg => `${msg.author || msg.role}: ${msg.content}`)
            .join('\n');
    }

    /**
     * Get raw recent messages
     */
    getRecent(channelId: string, limit: number = 10, platform: string = 'discord'): ShortTermMessage[] {
        const key = this.getCompositeKey(platform, channelId);
        const history = this.conversations.get(key) || [];
        return history.slice(-limit);
    }

    /**
     * Get all active channel IDs (returns composite keys or objects)
     */
    getActiveChannels(): { platform: string; channelId: string }[] {
        const active: { platform: string; channelId: string }[] = [];

        for (const key of this.conversations.keys()) {
            const [platform, channelId] = key.split(':');
            if (platform && channelId) {
                active.push({ platform, channelId });
            }
        }

        return active;
    }

    private getCompositeKey(platform: string, channelId: string): string {
        return `${platform}:${channelId}`;
    }

    /**
     * Search short-term memory for relevant context
     */
    search(channelId: string, query: string, platform: string = 'discord'): ShortTermMessage[] {
        const key = this.getCompositeKey(platform, channelId);
        const messages = this.conversations.get(key) || [];
        const queryLower = query.toLowerCase();

        return messages.filter(m =>
            m.content.toLowerCase().includes(queryLower)
        );
    }

    /**
     * Clear a channel's short-term memory
     */
    clear(channelId: string, platform: string = 'discord'): void {
        const key = this.getCompositeKey(platform, channelId);
        this.conversations.delete(key);
    }

    /**
     * Start periodic cleanup of expired messages
     */
    private startCleanup(): void {
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 60 * 1000); // Every minute
    }

    /**
     * Remove expired messages
     */
    private cleanup(): void {
        const now = Date.now();
        const expiryThreshold = now - this.config.shortTermExpiryMs;
        let totalRemoved = 0;

        for (const [key, messages] of this.conversations.entries()) {
            const before = messages.length;
            const filtered = messages.filter(m => m.timestamp > expiryThreshold);

            if (filtered.length === 0) {
                this.conversations.delete(key);
            } else {
                this.conversations.set(key, filtered);
            }

            totalRemoved += before - filtered.length;
        }

        if (totalRemoved > 0) {
            this.logger.debug(`Cleaned up ${totalRemoved} expired short-term messages`);
        }
    }

    /**
     * Get statistics
     */
    getStats(): { channels: number; totalMessages: number } {
        let totalMessages = 0;
        for (const messages of this.conversations.values()) {
            totalMessages += messages.length;
        }
        return {
            channels: this.conversations.size,
            totalMessages,
        };
    }

    /**
     * Shutdown cleanup
     */
    shutdown(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
}
