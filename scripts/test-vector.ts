import { VectorStore } from '../src/memory/VectorStore';
import { AIManager } from '../src/ai/AIProvider';
import dotenv from 'dotenv';
import weaviate from 'weaviate-ts-client';

dotenv.config();

// Mock AI Manager to avoid spending OpenAI credits on simple connectivity test
// or use real one if API key is present
class MockAIManager extends AIManager {
    constructor() {
        super({ provider: 'openai', apiKey: 'mock', model: 'mock' });
    }

    async generateEmbedding(text: string): Promise<number[]> {
        console.log(`🤖 Generating mock embedding for: "${text.substring(0, 20)}..."`);
        // Return a random 1536-dimensional vector (standard for OpenAI)
        return Array(1536).fill(0).map(() => Math.random());
    }
}

async function main() {
    console.log('🚀 Starting Vector Store Test (Weaviate + Embeddings)...');

    // Verify Weaviate connectivity first
    try {
        const client = weaviate.client({ scheme: 'http', host: 'localhost:8081' });
        const meta = await client.misc.metaGetter().do();
        console.log(`✅ Connected to Weaviate version: ${meta.version}`);
    } catch (err) {
        console.error('❌ Failed to connect to Weaviate at localhost:8081. Is docker-compose running?');
        console.error(err);
        process.exit(1);
    }

    // Determine if we have a real API key to test real embeddings
    let aiManager: AIManager;
    if (process.env.OPENAI_API_KEY) {
        console.log('✨ Using REAL OpenAI for embeddings.');
        aiManager = new AIManager({ provider: 'openai', apiKey: process.env.OPENAI_API_KEY, model: 'gpt-3.5-turbo' });
    } else {
        console.log('⚠️ No OPENAI_API_KEY found. Using MOCK embeddings.');
        aiManager = new MockAIManager();
    }

    const vectorStore = new VectorStore(aiManager);

    // 1. Store a memory
    const memoryContent = "The user prefers Python over JavaScript because of its simplicity.";
    console.log(`\n📝 Storing memory: "${memoryContent}"`);

    try {
        const id = await vectorStore.storeMemory(memoryContent, {
            type: 'preference',
            userId: 'test_user_1',
            platform: 'test'
        });
        console.log(`✅ Stored successfully with ID: ${id}`);

        // Wait for indexing (Weaviate is fast/eventual)
        await new Promise(r => setTimeout(r, 1000));

        // 2. Search for memory
        const query = "What programming language does the user like?";
        console.log(`\n🔍 Searching for: "${query}"`);

        const results = await vectorStore.searchMemories(query, 2);

        if (results && results.length > 0) {
            console.log('✅ Found match!');
            console.log('   Match:', results[0].content);
            console.log('   Distance:', results[0]._additional?.distance);
        } else {
            console.warn('⚠️ No matches found. (If using Mock embeddings, this is expected as vectors are random)');
        }

    } catch (error) {
        console.error('❌ Error during vector operations:', error);
    }
}

main();
