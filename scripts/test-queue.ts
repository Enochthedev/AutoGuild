import { QueueManager } from '../src/core/QueueManager';
import { BotCore } from '../src/core/BotCore';
import { Platform } from '../src/types';

// Mock BotCore to avoid starting full infrastructure
class MockBot {
    async processMessage(msg: any) {
        console.log('✅ WORKER PROCESSED MESSAGE:', msg.content);
        console.log('   User:', msg.author.username);
        console.log('   Timestamp:', msg.timestamp);
    }
}

async function main() {
    console.log('🚀 Starting Queue Test...');

    const bot = new MockBot() as unknown as BotCore;
    const queueManager = new QueueManager(bot);

    // Wait for connection
    await new Promise(r => setTimeout(r, 1000));

    console.log('📩 Adding test message to queue...');
    await queueManager.addMessage({
        platform: Platform.DISCORD,
        channelId: '123',
        userId: 'user_999',
        username: 'TestUser',
        content: 'Hello via Redis!',
        timestamp: Date.now()
    });

    console.log('⏳ Waiting for worker...');
    await new Promise(r => setTimeout(r, 2000));

    console.log('👋 Closing queues...');
    await queueManager.close();
}

main();
