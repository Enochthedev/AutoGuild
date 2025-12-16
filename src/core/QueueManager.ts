import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import { Logger } from './Logger';
import { BotCore } from './BotCore';
import { Platform } from '../types';

export interface MessageJobData {
    platform: Platform;
    channelId: string;
    userId: string;
    username: string;
    content: string;
    guildId?: string;
    timestamp: number;
}

export interface ActionJobData {
    type: string;
    platform: Platform;
    guildId?: string;
    channelId?: string;
    params: any;
}

export class QueueManager {
    private logger: Logger;
    private connection: { host: string; port: number };

    // Queues
    public messageQueue: Queue;
    public actionQueue: Queue;

    // Workers
    private messageWorker: Worker;
    private actionWorker: Worker;

    private bot: BotCore; // Reference to bot for executing logic

    constructor(bot: BotCore) {
        this.logger = new Logger('QueueManager');
        this.bot = bot;

        // Redis Connection config (simpler than full URL parsing for now)
        // In prod, use IORedis instance from URL
        this.connection = {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
        };

        // Initialize Queues
        this.messageQueue = new Queue('incoming_messages', { connection: this.connection });
        this.actionQueue = new Queue('autonomous_actions', { connection: this.connection });

        // Initialize Workers (Paused by default until start called)
        this.messageWorker = new Worker('incoming_messages', this.processMessageJob.bind(this), {
            connection: this.connection,
            concurrency: 5 // Process 5 messages in parallel
        });

        this.actionWorker = new Worker('autonomous_actions', this.processActionJob.bind(this), {
            connection: this.connection,
            concurrency: 2 // Limit actions to avoid rate limits
        });

        this.setupEventListeners();
        this.logger.info('Queue system initialized (BullMQ + Redis)');
    }

    /**
     * Add a generic message to the processing queue
     */
    async addMessage(data: MessageJobData) {
        await this.messageQueue.add('message', data, {
            removeOnComplete: true,
            removeOnFail: 500 // Keep last 500 failed jobs for inspection
        });
    }

    /**
     * Add an action to the execution queue
     */
    async addAction(data: ActionJobData) {
        await this.actionQueue.add('action', data, {
            removeOnComplete: true,
        });
    }

    /**
     * WORKER: Process incoming messages
     * This decoupled logic calls back into BotCore to handle the "business logic"
     */
    private async processMessageJob(job: Job<MessageJobData>) {
        const { platform, channelId, userId, username, content, guildId, timestamp } = job.data;

        this.logger.debug(`Processing message job: ${job.id} from ${username}`);

        // Transform back to UniversalMessage format roughly
        const message = {
            platform,
            channelId,
            userId,
            username,
            content,
            guildId,
            timestamp,
            id: job.id || 'unknown', // internal job id as msg id proxy if needed
            context: {}
        };

        // Call the original logic. 
        // In a microservices architecture, this worker would be a separate process 
        // that might call an AI Service over HTTP.
        // Here we call the in-process method.
        await this.bot.processMessage(message);
    }

    /**
     * WORKER: Execute actions
      */
    private async processActionJob(job: Job<ActionJobData>) {
        const { type, platform, params, guildId, channelId } = job.data;
        this.logger.info(`Processing action job ${job.id}: ${type}`, params);

        // Delegate to BotCore Action Execution Logic
        await this.bot.executeAction({
            type,
            platform,
            params: { ...params, guildId, channelId }
        });
    }

    private setupEventListeners() {
        this.messageWorker.on('completed', (job) => {
            // this.logger.debug(`Job ${job.id} completed`);
        });

        this.messageWorker.on('failed', (job, err) => {
            this.logger.error(`Job ${job?.id} failed`, err);
        });
    }

    async pause() {
        await this.messageWorker.pause();
        await this.actionWorker.pause();
    }

    async resume() {
        await this.messageWorker.resume();
        await this.actionWorker.resume();
    }

    async close() {
        await this.messageQueue.close();
        await this.actionQueue.close();
        await this.messageWorker.close();
        await this.actionWorker.close();
    }
}
