/**
 * Sox Memory System
 * 
 * This module handles both short-term and long-term memory for the bot.
 * 
 * SHORT-TERM MEMORY:
 * - In-memory conversation context (last N messages)
 * - Fast, volatile, per-channel/session
 * - Used for immediate context awareness ("that channel", "the one you just made")
 * 
 * LONG-TERM MEMORY:
 * - Persistent storage with semantic embeddings
 * - Cross-platform knowledge base
 * - Facts, preferences, learned patterns
 * - Used for "remember that John prefers morning meetings"
 * 
 * LOCAL MODELS:
 * - EmbeddingService: all-MiniLM-L6-v2 for semantic search
 * - OllamaService: Phi-3/Mistral for summarization and learning
 */

export * from './ShortTermMemory';
export * from './LongTermMemory';
export * from './MemoryManager';
export * from './EmbeddingService';
export * from './OllamaService';
export * from './types';
