# Scalability & Database Migration Plan

This document outlines the strategy for scaling **Sox/Guildly** to handle concurrent users across multiple platforms and migrating to enterprise-grade databases.

## 1. Concurrency & Context Isolation

Sox is designed to handle multiple concurrent conversations (e.g., DnD in one channel, Work in another) through strict **Context Isolation**.

### How it works:
- **Composite Context Keys**: 
  - Every conversation is tracked by a unique key: `${platform}:${channelId}`.
  - This ensures a DnD game on Discord Channel A never leaks into WhatsApp Chat B.
- **Memory Partitioning**:
  - **Short-Term Memory**: Partitioned by Channel ID in RAM.
  - **Long-Term Memory**: Partitioned by Guild ID in the database.

### Scaling Strategy:
- **Stateless Core**: The `BotCore` logic is largely stateless per request. State is retrieved from ShortTermMemory (RAM) or LongTermMemory (DB) at the moment of processing.
- **Horizontal Scaling**: To scale to thousands of servers, we can shard the bot:
  - Run multiple instances of Sox.
  - Use a **Redis** layer for ShortTermMemory instead of in-memory RAM.
  - Use a centralized DB (Postgres/CockroachDB) for LongTermMemory.

---

## 2. Database Migration Path

Currently, Sox uses **SQLite** (`better-sqlite3`) for simplicity and ease of deployment. 
To scale up, we recommend migrating to **PostgreSQL** or **CockroachDB**.

### Why Upgrade?
- **Concurrency**: SQLite locks the file on write; Postgres handles thousands of concurrent writes.
- **Vector Search**: Postgres has `pgvector` for native embedding support (replacing our local file search).
- **Resilience**: CockroachDB offers distributed, unbreakable SQL capabilities.

### Migration Steps:

#### Phase 1: Abstract the Database Layer
We should refactor the code to use an ORM (Object-Relational Mapper) like **Prisma**. This genericizes the database code.

**Current (Raw SQLite):**
```typescript
db.prepare('SELECT * FROM memories WHERE ...').get();
```

**Proposed (Prisma ORM):**
```typescript
prisma.memory.findMany({ where: { ... } });
```
*Prisma works with SQLite, Postgres, and CockroachDB with just a config change.*

#### Phase 2: Schema Migration
1. Define `schema.prisma` matching our current tables.
2. Run `prisma migrate` to create tables in the new DB.
3. Write a script to export SQLite data -> Import to Postgres.

#### Phase 3: Infrastructure
For high availability, we recommend:
- **Primary DB**: CockroachDB Serverless or a managed Postgres instance (Supabase/Neon).
- **Cache**: Redis for session state and rate limiting.

---

## 3. Handling Multi-Platform Game States

To handle active "Sessions" (like a DnD game), we should introduce a **SessionManager**.

```typescript
interface GameSession {
  sessionId: string;
  type: 'dnd' | 'trivia';
  state: any; // The game board/variables
  participants: string[];
  ttl: number; // Auto-expire after 24h
}
```

- **Storage**: Store active sessions in the Key-Value store (currently SQLite, easy migration to Redis).
- **Routing**: When a message comes in, check `KVStore.get('session:' + channelId)`.
  - If exists -> Route to `GamePlugin`.
  - If null -> Route to `AIConversation`.

## Summary Recommendation

1. **Immediate**: The current SQLite + RAM setup is fine for < 50 concurrent servers.
2. **Next Step**: Switch to **Prisma ORM** to verify code works with Postgres.
3. **Scale Up**: Deploy **PostgreSQL** + **Redis** when you hit > 100 servers.
