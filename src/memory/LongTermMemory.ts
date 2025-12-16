/**
 * Long-Term Memory (LTM)
 * 
 * Persistent storage with semantic embeddings for knowledge retrieval.
 * Stores facts, preferences, learned patterns across all platforms.
 * 
 * ARCHITECTURE:
 * - CockroachDB (Postgres) via Prisma for storage
 * - Vector embeddings stored in 'content' or separate field (future Weaviate integration)
 */

import { MemoryEntry, MemoryType, MemorySource, MemoryMetadata, MemorySearchOptions, MemoryConfig, DEFAULT_MEMORY_CONFIG } from './types';
import { Logger } from '../core/Logger';
import { DatabaseManager } from '../database/Database';
import crypto from 'crypto';

export class LongTermMemory {
    private logger: Logger;
    private config: MemoryConfig;
    private db: DatabaseManager;

    constructor(db: DatabaseManager, config: Partial<MemoryConfig> = {}) {
        this.logger = new Logger('LongTermMemory');
        this.config = { ...DEFAULT_MEMORY_CONFIG, ...config };
        this.db = db;

        // No need to init tables manually, Prisma handles migrations
        this.logger.info(`Long-term memory initialized (Prisma/CockroachDB)`);
    }

    /**
     * Store a new memory
     */
    async store(content: string, type: MemoryType, source: MemorySource, metadata: MemoryMetadata = {}): Promise<string> {
        // Since sqlite is sync but prisma is async, we return Promise<string> now
        // Callers must await this!

        const memory = await this.db.prisma.memory.create({
            data: {
                content,
                type,
                source: {
                    platform: source.platform,
                    channelId: source.channelId,
                    userId: source.userId,
                    guildId: source.guildId
                },
                importance: metadata.confidence || 0.5,
                tags: metadata.tags || [],
                // We'll store metadata fields that don't fit schema in the future
            }
        });

        this.logger.debug(`Stored memory: ${memory.id} (${type})`);
        return memory.id;
    }

    /**
     * Recall memories by keyword search (basic implementation)
     * TODO: Using native Postgres Full Text Search (tsvector) would be better here
     */
    async recall(options: MemorySearchOptions): Promise<MemoryEntry[]> {
        // Construct Prisma where clause
        const where: any = {
            content: {
                contains: options.query, // Basic implementation, case sensitive depends on DB collation
                mode: 'insensitive'      // Case insensitive search
            }
        };

        if (options.type) where.type = options.type;
        // In the JSON source field, deep filtering is tricky without specialized operators
        // We'll rely on memory tagging or just filter post-query if needed for simple cases

        if (options.minImportance) {
            where.importance = { gte: options.minImportance };
        }

        const memories = await this.db.prisma.memory.findMany({
            where,
            orderBy: [
                { importance: 'desc' },
                { updatedAt: 'desc' }
            ],
            take: options.limit || 10
        });

        // Update last accessed in background
        // We don't await this to keep read fast
        if (memories.length > 0) {
            const ids = memories.map(m => m.id);
            this.db.prisma.memory.updateMany({
                where: { id: { in: ids } },
                data: { updatedAt: new Date() } // We'll use updatedAt as lastAccessed for now
            }).catch(() => { });
        }

        return memories.map(this.rowToMemoryEntry);
    }

    /**
     * Get a specific memory by ID
     */
    async get(id: string): Promise<MemoryEntry | null> {
        const memory = await this.db.prisma.memory.findUnique({ where: { id } });
        if (!memory) return null;
        return this.rowToMemoryEntry(memory);
    }

    /**
     * Update a memory's importance score
     */
    async updateImportance(id: string, importance: number): Promise<void> {
        await this.db.prisma.memory.update({
            where: { id },
            data: { importance: Math.max(0, Math.min(1, importance)) }
        });
    }

    /**
     * Delete a memory
     */
    async forget(id: string): Promise<void> {
        await this.db.prisma.memory.delete({ where: { id } });
        this.logger.debug(`Forgot memory: ${id}`);
    }

    // ... (Consolidate method is higher-level logic, mostly managed by MemoryManager, 
    // but helper methods here are good)

    /**
     * Get learned patterns
     * Note: We are now storing patterns as MEMORY type 'pattern' instead of a separate table
     * to simplify the schema. 
     */
    async getPatterns(guildId?: string, minConfidence: number = 0.5): Promise<any[]> {
        // This query is tricky with JSON source.
        // For now, we'll fetch 'pattern' type memories.
        // Ideally we filter by guildId in source JSON.

        const patterns = await this.db.prisma.memory.findMany({
            where: {
                type: 'pattern',
                importance: { gte: minConfidence }
            },
            take: 20
        });

        // Filter by guildId in memory (since JSON filtering in Prisma < 5 is limited, though v7 is better)
        // With CockroachDB JSONB, we can do path filtering, but let's keep it safe.
        return patterns
            .filter(p => {
                const src = p.source as any;
                return !guildId || (src && src.guildId === guildId);
            })
            .map(p => ({
                pattern: p.content,
                confidence: p.importance
            }));
    }

    // Pattern recording helper
    async recordPattern(pattern: string, guildId?: string): Promise<void> {
        // Upsert logic... using findFirst then update/create
        // Check if pattern exists for this guild

        // This is simplified. In high scale, use a dedicated Pattern model or TimescaleDB.
        await this.store(
            pattern,
            MemoryType.PATTERN as any || 'pattern', // Cast if enum mismatch
            { platform: 'auto', guildId, channelId: '', userId: '' },
            { confidence: 0.5, tags: ['learned'] }
        );
    }

    /**
     * Get statistics
     */
    async getStats(): Promise<any> {
        const count = await this.db.prisma.memory.count();
        return { totalMemories: count, backend: 'CockroachDB' };
    }

    /**
     * Convert database row to MemoryEntry
     */
    private rowToMemoryEntry(row: any): MemoryEntry {
        const sourceFromDb = row.source as any || {};

        return {
            id: row.id,
            content: row.content,
            type: row.type as MemoryType,
            source: {
                platform: sourceFromDb.platform || 'unknown',
                guildId: sourceFromDb.guildId,
                channelId: sourceFromDb.channelId,
                userId: sourceFromDb.userId,
            },
            metadata: {
                tags: row.tags || [],
                confidence: row.importance
            },
            // embedding: ...
            createdAt: row.createdAt,
            lastAccessedAt: row.updatedAt,
            accessCount: 0, // Not tracking count in schema yet
            importance: row.importance,
        };
    }

    /**
     * Close database connection
     */
    close(): void {
        // DatabaseManager manages the connection
    }
}
