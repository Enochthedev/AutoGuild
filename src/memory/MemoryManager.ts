/**
 * Memory Manager
 * 
 * Unified interface for managing both short-term and long-term memory.
 * Handles consolidation, retrieval, and learning.
 * 
 * Short-term → Long-term consolidation:
 * - Periodic consolidation of important conversations
 * - Uses Ollama for summarization
 * - Uses embeddings for semantic storage
 */

import { ShortTermMemory } from './ShortTermMemory';
import { LongTermMemory } from './LongTermMemory';
import { EmbeddingService, getEmbeddingService } from './EmbeddingService';
import { OllamaService, getOllamaService } from './OllamaService';
import { ShortTermMessage, MemoryType, MemorySource, MemorySearchOptions, MemoryConfig, DEFAULT_MEMORY_CONFIG } from './types';
import { Logger } from '../core/Logger';
import { DatabaseManager } from '../database/Database';

export class MemoryManager {
    private logger: Logger;
    private config: MemoryConfig;
    private shortTerm: ShortTermMemory;
    private longTerm: LongTermMemory;
    private embeddingService: EmbeddingService;
    private ollamaService: OllamaService;

    // Consolidation interval
    private consolidationInterval: NodeJS.Timeout | null = null;

    constructor(db: DatabaseManager, config: Partial<MemoryConfig> = {}) {
        this.logger = new Logger('MemoryManager');
        this.config = { ...DEFAULT_MEMORY_CONFIG, ...config };

        this.shortTerm = new ShortTermMemory(this.config);
        // Inject DB into LongTermMemory
        this.longTerm = new LongTermMemory(db, this.config);

        this.embeddingService = getEmbeddingService();
        this.ollamaService = getOllamaService();

        // Initialize services in background
        this.initializeServices();

        // Start periodic consolidation
        this.startConsolidation();

        this.logger.info('Memory system initialized');
    }

    /**
     * Initialize embedding and Ollama services
     */
    private async initializeServices(): Promise<void> {
        try {
            await this.embeddingService.initialize();
            this.logger.info('Embedding service ready');
        } catch (error) {
            this.logger.warn('Embedding service not available - semantic search disabled');
        }

        try {
            await this.ollamaService.checkAvailability();
            if (this.ollamaService.available()) {
                this.logger.info('Ollama service ready');
            }
        } catch (error) {
            this.logger.warn('Ollama not available - advanced summarization disabled');
        }
    }

    // =====================
    // SHORT-TERM OPERATIONS
    // =====================

    /**
     * Add a message to short-term memory
     */
    addMessage(message: ShortTermMessage): void {
        this.shortTerm.add(message);

        // Also check for patterns to learn (Fire and forget, don't await)
        this.detectPatterns(message).catch(e => {
            this.logger.error('Error detecting patterns', e);
        });
    }

    /**
     * Get recent conversation context
     */
    getRecentContext(channelId: string, limit: number = 6): string {
        return this.shortTerm.getContextString(channelId, limit);
    }

    /**
     * Get raw recent messages
     */
    getRecentMessages(channelId: string, limit?: number): ShortTermMessage[] {
        return this.shortTerm.getRecent(channelId, limit);
    }

    // ====================
    // LONG-TERM OPERATIONS
    // ====================

    /**
     * Store a fact/preference/event for long-term recall
     */
    async remember(content: string, type: MemoryType, source: MemorySource, metadata: any = {}): Promise<string> {
        return await this.longTerm.store(content, type, source, metadata);
    }

    /**
     * Recall memories related to a query
     */
    async recall(options: MemorySearchOptions) {
        return await this.longTerm.recall(options);
    }

    /**
     * Explicitly store something the user asked to remember
     */
    async rememberFromCommand(content: string, source: MemorySource): Promise<string> {
        return await this.longTerm.store(
            content,
            MemoryType.FACT,
            source,
            { tags: ['user-requested'], confidence: 0.9 }
        );
    }

    /**
     * Forget a specific memory
     */
    async forget(id: string): Promise<void> {
        await this.longTerm.forget(id);
    }

    // ======================
    // UNIFIED CONTEXT BUILDER
    // ======================

    /**
     * Build full context for AI including both short and long-term memories
     */
    async buildContext(channelId: string, query: string, source: MemorySource): Promise<string> {
        const parts: string[] = [];

        // 1. Short-term conversation context
        const recentContext = this.getRecentContext(channelId, 6);
        if (recentContext) {
            parts.push(`Recent conversation:\n${recentContext}`);
        }

        // 2. Relevant long-term memories
        const relevantMemories = await this.longTerm.recall({
            query,
            limit: 5,
            guildId: source.guildId,
            minImportance: 0.3,
        });

        if (relevantMemories.length > 0) {
            const memoryContext = relevantMemories
                .map(m => `[${m.type}] ${m.content}`)
                .join('\n');
            parts.push(`Relevant knowledge:\n${memoryContext}`);
        }

        // 3. Learned patterns for this guild
        const patterns = await this.longTerm.getPatterns(source.guildId, 0.6);
        if (patterns.length > 0) {
            const patternContext = patterns
                .slice(0, 3)
                .map((p: any) => p.pattern)
                .join('; ');
            parts.push(`Learned patterns: ${patternContext}`);
        }

        return parts.join('\n\n');
    }

    // ===================
    // LEARNING & PATTERNS
    // ===================

    /**
     * Detect and record patterns from messages
     */
    private async detectPatterns(message: ShortTermMessage): Promise<void> {
        const content = message.content.toLowerCase();

        // Pattern: User preferences
        const preferPatterns = [
            /i (prefer|like|want|need) (.+)/i,
            /please (always|never) (.+)/i,
            /remember that (.+)/i,
        ];

        for (const pattern of preferPatterns) {
            const match = content.match(pattern);
            if (match) {
                const extracted = match[0];
                await this.longTerm.recordPattern(extracted, message.guildId);
                this.logger.debug(`Detected pattern: ${extracted}`);
            }
        }
    }

    /**
     * Start periodic consolidation of short-term to long-term
     */
    private startConsolidation(): void {
        // Run every 5 minutes
        this.consolidationInterval = setInterval(() => {
            this.runConsolidation().catch(e => {
                this.logger.error('Consolidation failed', e);
            });
        }, 5 * 60 * 1000);
    }

    /**
     * Consolidate important short-term memories to long-term
     * Short-term → Long-term transition
     */
    private async runConsolidation(): Promise<void> {
        const activeChannels = this.shortTerm.getActiveChannels();

        for (const { platform, channelId } of activeChannels) {
            // Note: getRecent now requires platform, but defaults to discord. 
            // We should use the platform from activeChannel object
            const messages = this.shortTerm.getRecent(channelId, 10, platform);
            const context = messages.map(m => `${m.author || m.role}: ${m.content}`).join('\n');

            if (context.length < 100) continue;

            try {
                let summary: string;
                let facts: string[] = [];

                // Use Ollama for intelligent summarization if available
                if (this.ollamaService.available()) {
                    summary = await this.ollamaService.summarizeConversation(context);
                    facts = await this.ollamaService.extractFacts(context);

                    this.logger.debug(`Ollama extracted ${facts.length} facts from conversation`);
                } else {
                    // Fallback: simple keyword-based extraction
                    summary = context.substring(0, 200);
                }

                // Get platform from first message
                // const platform = messages[0]?.platform || 'unknown'; // Already have platform from activeChannels loop
                const source = { platform, channelId };

                // Store the summary
                if (summary && summary.length > 20) {
                    const memoryId = await this.longTerm.store(
                        summary,
                        MemoryType.CONVERSATION,
                        source,
                        { tags: ['consolidated', 'auto'], confidence: 0.7 }
                    );

                    // Embedding logic omitted for brevity, handled inside store logic ideally if we move embedding gen there
                }

                // Store individual facts
                for (const fact of facts) {
                    if (fact.length > 15) {
                        await this.longTerm.store(
                            fact,
                            MemoryType.FACT,
                            source,
                            { tags: ['extracted', 'auto'], confidence: 0.6 }
                        );
                    }
                }

                this.logger.debug(`Consolidated conversation from channel ${channelId}`);
            } catch (error) {
                this.logger.warn(`Failed to consolidate channel ${channelId}`, error);
            }
        }
    }

    // ============
    // STATS & INFO
    // ============

    async getStats(): Promise<any> {
        return {
            shortTerm: this.shortTerm.getStats(),
            longTerm: await this.longTerm.getStats(),
        };
    }

    // ========
    // SHUTDOWN
    // ========

    shutdown(): void {
        this.shortTerm.shutdown();
        this.longTerm.close();

        if (this.consolidationInterval) {
            clearInterval(this.consolidationInterval);
            this.consolidationInterval = null;
        }

        this.logger.info('Memory system shut down');
    }
}
