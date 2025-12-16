/**
 * Session Manager
 * 
 * Manages active game sessions or "modes" for specific channels.
 * This allows a channel to be locked into a specific context (e.g. DnD Game, Interview, Trivia)
 * separate from normal chat or other channels.
 */

import { DatabaseManager } from '../database/Database';
import { Logger } from './Logger';

export interface Session {
    id: string;
    channelId: string;
    guildId: string;
    type: string; // 'dnd', 'trivia', 'interview'
    data: any; // Flexible state object
    createdAt: number;
    updatedAt: number;
}

export class SessionManager {
    private logger: Logger;
    private db: DatabaseManager;
    private cache: Map<string, Session>;

    constructor(db: DatabaseManager) {
        this.logger = new Logger('SessionManager');
        this.db = db;
        this.cache = new Map();
    }

    /**
     * Start a new session in a channel
     */
    async startSession(
        channelId: string,
        guildId: string,
        type: string,
        initialData: any = {}
    ): Promise<Session> {
        const session: Session = {
            id: `${guildId}:${channelId}`, // One session per channel enforcement
            channelId,
            guildId,
            type,
            data: initialData,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        // Store in cache
        this.cache.set(channelId, session);

        // Persist to DB (using KeyValue store for now)
        await this.db.set(
            `session:${channelId}`,
            session,
            guildId
        );

        this.logger.info(`Started ${type} session in channel ${channelId}`);
        return session;
    }

    /**
     * Get active session for a channel
     */
    async getSession(channelId: string): Promise<Session | null> {
        // Check cache first
        if (this.cache.has(channelId)) {
            return this.cache.get(channelId)!;
        }

        // Check DB
        const stored = await this.db.get(`session:${channelId}`);
        if (stored) {
            this.cache.set(channelId, stored);
            return stored;
        }

        return null;
    }

    /**
     * Update session state
     */
    async updateSession(channelId: string, data: Partial<any>): Promise<void> {
        const session = await this.getSession(channelId);
        if (!session) return;

        session.data = { ...session.data, ...data };
        session.updatedAt = Date.now();

        this.cache.set(channelId, session);
        await this.db.set(
            `session:${channelId}`,
            session,
            session.guildId
        );
    }

    /**
     * End a session
     */
    async endSession(channelId: string): Promise<void> {
        const session = await this.getSession(channelId);
        if (session) {
            this.cache.delete(channelId);
            await this.db.delete(`session:${channelId}`, session.guildId);
            this.logger.info(`Ended session in channel ${channelId}`);
        }
    }

    /**
     * Check if a channel is "busy" with a specific task
     */
    async isBusy(channelId: string): Promise<boolean> {
        const session = await this.getSession(channelId);
        return !!session;
    }
}
