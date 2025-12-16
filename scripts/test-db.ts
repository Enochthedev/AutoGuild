import { DatabaseManager } from '../src/database/Database';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
    console.log('🚀 Starting Database Connectivity Test...');

    // Initialize Database Manager (which uses Prisma)
    // We pass a dummy path for compatibility, but it uses ENV
    const db = new DatabaseManager('./dummy.db');

    try {
        // 1. Test User Identity Creation
        console.log('\n📝 Testing User Identity Creation...');
        const userId = 'user_123';
        const platform = 'discord';
        await db.trackUserActivity(userId, platform);

        const stats = await db.getUserStats(userId, platform);
        console.log('✅ User Stats Retrieved:', stats);
        if (stats?.messageCount !== 1) throw new Error('Message count mismatch');

        // 2. Test Guild Config
        console.log('\n📝 Testing Guild Config...');
        const guildId = 'guild_999';
        await db.setGuildConfig({
            guildId,
            platform,
            prefix: '?',
            moderationEnabled: true,
            welcomeMessage: 'Hello World'
        });

        const config = await db.getGuildConfig(guildId, platform);
        console.log('✅ Guild Config Retrieved:', config);
        if (config?.prefix !== '?') throw new Error('Prefix mismatch');

        // 3. Test Key-Value Store (Memory/Session backing)
        console.log('\n📝 Testing Generic Key-Value Store...');
        await db.set('test_key', { foo: 'bar' }, guildId);
        const val = await db.get('test_key', guildId);
        console.log('✅ KV Values Retrieved:', val);
        if (val.foo !== 'bar') throw new Error('KV Mismatch');

        // 4. Verification
        console.log('\n✨ Database Test PASSED! Connected to CockroachDB.');

    } catch (error) {
        console.error('\n❌ Database Test FAILED:', error);
    } finally {
        await db.close();
    }
}

main();
