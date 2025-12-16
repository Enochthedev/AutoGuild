import weaviate, { WeaviateClient } from 'weaviate-ts-client';
import { AIManager } from '../ai/AIProvider';
import { Logger } from '../core/Logger';

const MEMORY_CLASS = 'LongTermMemory';

export class VectorStore {
    private client: WeaviateClient;
    private logger: Logger;
    private aiManager: AIManager;

    constructor(aiManager: AIManager) {
        this.logger = new Logger('VectorStore');
        this.aiManager = aiManager;

        this.client = weaviate.client({
            scheme: 'http',
            host: 'localhost:8081', // Port from docker-compose
        });

        this.initSchema();
    }

    private async initSchema() {
        try {
            const schema = await this.client.schema.getter().do();
            const classExists = schema.classes?.some((c) => c.class === MEMORY_CLASS);

            if (!classExists) {
                this.logger.info(`Creating Weaviate class: ${MEMORY_CLASS}`);
                await this.client.schema
                    .classCreator()
                    .withClass({
                        class: MEMORY_CLASS,
                        description: 'Long-term memory storage for AutoGuild',
                        vectorizer: 'none', // We provide vectors manually
                        properties: [
                            { name: 'content', dataType: ['text'] },
                            { name: 'type', dataType: ['string'] }, // 'fact', 'conversation', etc.
                            { name: 'platform', dataType: ['string'] },
                            { name: 'channelId', dataType: ['string'] },
                            { name: 'userId', dataType: ['string'] },
                            { name: 'guildId', dataType: ['string'] },
                            { name: 'timestamp', dataType: ['date'] },
                        ],
                    })
                    .do();
            }
        } catch (error) {
            this.logger.error('Failed to initialize Weaviate schema', error);
        }
    }

    async storeMemory(content: string, metadata: any): Promise<string> {
        try {
            this.logger.debug('Generating embedding for memory...');
            const vector = await this.aiManager.generateEmbedding(content);

            this.logger.debug('Storing memory in Weaviate...');
            const response = await this.client.data
                .creator()
                .withClassName(MEMORY_CLASS)
                .withProperties({
                    content,
                    ...metadata,
                    timestamp: new Date().toISOString(),
                })
                .withVector(vector)
                .do();

            this.logger.info(`Memory stored in vector db with ID: ${response.id}`);
            return response.id!; // Return UUID
        } catch (error) {
            this.logger.error('Failed to store memory in vector db', error);
            throw error;
        }
    }

    async searchMemories(query: string, limit: number = 5, filters?: any): Promise<any[]> {
        try {
            const vector = await this.aiManager.generateEmbedding(query);

            let builder = this.client.graphql
                .get()
                .withClassName(MEMORY_CLASS)
                .withFields('content type platform guildId _additional { id distance }')
                .withNearVector({ vector })
                .withLimit(limit);

            if (filters) {
                // Apply simple where filter if needed
                // For now, ignoring complex filters to keep it simple
            }

            const result = await builder.do();
            const memories = result.data.Get[MEMORY_CLASS];

            return memories || [];
        } catch (error) {
            this.logger.error('Failed to search memories', error);
            return [];
        }
    }
}
