/**
 * Embedding Service
 * 
 * Uses @xenova/transformers to run all-MiniLM-L6-v2 locally for semantic embeddings.
 * This enables semantic search across long-term memories.
 */

import { Logger } from '../core/Logger';

// Dynamic import for transformers (ESM module)
let pipeline: any = null;
let embeddingPipeline: any = null;

export class EmbeddingService {
    private logger: Logger;
    private modelName: string;
    private isReady: boolean = false;
    private initPromise: Promise<void> | null = null;

    constructor(modelName: string = 'Xenova/all-MiniLM-L6-v2') {
        this.logger = new Logger('EmbeddingService');
        this.modelName = modelName;
    }

    /**
     * Initialize the embedding model
     */
    async initialize(): Promise<void> {
        if (this.isReady) return;
        if (this.initPromise) return this.initPromise;

        this.initPromise = this._initialize();
        return this.initPromise;
    }

    private async _initialize(): Promise<void> {
        try {
            this.logger.info(`Loading embedding model: ${this.modelName}...`);

            // Dynamic import for ESM compatibility
            const transformers = await import('@xenova/transformers');
            pipeline = transformers.pipeline;

            // Create the embedding pipeline
            embeddingPipeline = await pipeline('feature-extraction', this.modelName, {
                quantized: true, // Use quantized model for speed
            });

            this.isReady = true;
            this.logger.info('Embedding model loaded successfully');
        } catch (error) {
            this.logger.error('Failed to load embedding model', error);
            throw error;
        }
    }

    /**
     * Generate embedding for a single text
     */
    async embed(text: string): Promise<number[]> {
        if (!this.isReady) {
            await this.initialize();
        }

        try {
            const output = await embeddingPipeline(text, {
                pooling: 'mean',
                normalize: true,
            });

            // Convert to regular array
            return Array.from(output.data);
        } catch (error) {
            this.logger.error('Failed to generate embedding', error);
            throw error;
        }
    }

    /**
     * Generate embeddings for multiple texts
     */
    async embedBatch(texts: string[]): Promise<number[][]> {
        if (!this.isReady) {
            await this.initialize();
        }

        const embeddings: number[][] = [];

        for (const text of texts) {
            const embedding = await this.embed(text);
            embeddings.push(embedding);
        }

        return embeddings;
    }

    /**
     * Calculate cosine similarity between two embeddings
     */
    cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) {
            throw new Error('Embeddings must have same dimensions');
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    /**
     * Find most similar texts from a list
     */
    async findSimilar(
        query: string,
        candidates: { id: string; text: string; embedding?: number[] }[],
        topK: number = 5
    ): Promise<{ id: string; text: string; similarity: number }[]> {
        const queryEmbedding = await this.embed(query);

        const scored = await Promise.all(
            candidates.map(async (candidate) => {
                const embedding = candidate.embedding || await this.embed(candidate.text);
                const similarity = this.cosineSimilarity(queryEmbedding, embedding);
                return {
                    id: candidate.id,
                    text: candidate.text,
                    similarity,
                };
            })
        );

        // Sort by similarity descending
        scored.sort((a, b) => b.similarity - a.similarity);

        return scored.slice(0, topK);
    }

    /**
     * Check if the service is ready
     */
    ready(): boolean {
        return this.isReady;
    }
}

// Singleton instance
let embeddingServiceInstance: EmbeddingService | null = null;

export function getEmbeddingService(): EmbeddingService {
    if (!embeddingServiceInstance) {
        embeddingServiceInstance = new EmbeddingService();
    }
    return embeddingServiceInstance;
}
