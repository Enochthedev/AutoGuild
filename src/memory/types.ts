/**
 * Memory System Types
 */

export interface MemoryEntry {
    id: string;
    content: string;
    type: MemoryType;
    source: MemorySource;
    metadata: MemoryMetadata;
    embedding?: number[]; // Vector embedding for semantic search
    createdAt: Date;
    lastAccessedAt: Date;
    accessCount: number;
    importance: number; // 0-1 score for memory consolidation
}

export enum MemoryType {
    FACT = 'fact',           // "John's birthday is March 15"
    PREFERENCE = 'preference', // "User prefers dark mode"
    EVENT = 'event',         // "DnD session scheduled for Friday"
    CONVERSATION = 'conversation', // Summarized conversation
    LEARNING = 'learning',   // Patterns learned from interactions
    PATTERN = 'pattern',     // Explicit learned patterns
    ACTION = 'action',       // Actions taken and their outcomes
}

export interface MemorySource {
    platform: string;        // discord, telegram, etc.
    guildId?: string;
    channelId?: string;
    userId?: string;
}

export interface MemoryMetadata {
    tags?: string[];
    entities?: string[];     // Named entities extracted
    sentiment?: number;      // -1 to 1
    confidence?: number;     // 0-1 confidence in the memory
    relatedMemories?: string[]; // IDs of related memories
    [key: string]: any;
}

export interface ShortTermMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    author?: string;
    timestamp: number;
    channelId: string;
    guildId?: string;
    platform: string;
}

export interface MemorySearchOptions {
    query: string;
    limit?: number;
    type?: MemoryType;
    guildId?: string;
    minImportance?: number;
    timeRange?: {
        start?: Date;
        end?: Date;
    };
}

export interface MemoryConfig {
    shortTermMaxMessages: number;      // Max messages per channel
    shortTermExpiryMs: number;         // How long before short-term expires
    longTermConsolidationThreshold: number; // Importance threshold to persist
    embeddingModel: string;            // Local model for embeddings
    summaryModel: string;              // Local model for summarization
}

export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
    shortTermMaxMessages: 20,
    shortTermExpiryMs: 30 * 60 * 1000, // 30 minutes
    longTermConsolidationThreshold: 0.5,
    embeddingModel: 'all-MiniLM-L6-v2', // Recommended local embedding model
    summaryModel: 'phi-3-mini',         // Recommended local summarization model
};
