import { CronJob } from 'cron';
import { Logger } from './Logger';

export interface ScheduledTask {
  id: string;
  name: string;
  cronExpression: string;
  handler: () => Promise<void> | void;
  enabled: boolean;
}

export class SchedulerService {
  private logger: Logger;
  private jobs: Map<string, CronJob>;
  private tasks: Map<string, ScheduledTask>;

  constructor() {
    this.logger = new Logger('Scheduler');
    this.jobs = new Map();
    this.tasks = new Map();
  }

  /**
   * Register a scheduled task
   */
  public registerTask(task: ScheduledTask): void {
    if (this.tasks.has(task.id)) {
      this.logger.warn(`Task ${task.id} already registered, replacing...`);
      this.unregisterTask(task.id);
    }

    this.tasks.set(task.id, task);

    if (task.enabled) {
      this.startTask(task.id);
    }

    this.logger.info(`Registered task: ${task.name} (${task.cronExpression})`);
  }

  /**
   * Unregister a scheduled task
   */
  public unregisterTask(taskId: string): void {
    this.stopTask(taskId);
    this.tasks.delete(taskId);
    this.logger.info(`Unregistered task: ${taskId}`);
  }

  /**
   * Start a specific task
   */
  public startTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      this.logger.error(`Task ${taskId} not found`);
      return;
    }

    if (this.jobs.has(taskId)) {
      this.logger.warn(`Task ${taskId} already running`);
      return;
    }

    try {
      const job = new CronJob(
        task.cronExpression,
        async () => {
          this.logger.debug(`Executing task: ${task.name}`);
          try {
            await task.handler();
          } catch (error) {
            this.logger.error(`Error executing task ${task.name}`, error);
          }
        },
        null,
        true,
        'UTC'
      );

      this.jobs.set(taskId, job);
      this.logger.info(`Started task: ${task.name}`);
    } catch (error) {
      this.logger.error(`Failed to start task ${task.name}`, error);
    }
  }

  /**
   * Stop a specific task
   */
  public stopTask(taskId: string): void {
    const job = this.jobs.get(taskId);
    if (job) {
      job.stop();
      this.jobs.delete(taskId);
      this.logger.info(`Stopped task: ${taskId}`);
    }
  }

  /**
   * Stop all tasks
   */
  public stopAll(): void {
    for (const [taskId, job] of this.jobs.entries()) {
      job.stop();
      this.logger.info(`Stopped task: ${taskId}`);
    }
    this.jobs.clear();
  }

  /**
   * Get all registered tasks
   */
  public getTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get running tasks
   */
  public getRunningTasks(): string[] {
    return Array.from(this.jobs.keys());
  }

  /**
   * Execute a task immediately (outside of schedule)
   */
  public async executeTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    this.logger.info(`Manually executing task: ${task.name}`);
    try {
      await task.handler();
    } catch (error) {
      this.logger.error(`Error executing task ${task.name}`, error);
      throw error;
    }
  }

  /**
   * Register default tasks
   */
  public registerDefaultTasks(botCore: any): void {
    // Database cleanup (daily at 3 AM)
    this.registerTask({
      id: 'database-cleanup',
      name: 'Database Cleanup',
      cronExpression: '0 3 * * *',
      enabled: true,
      handler: async () => {
        this.logger.info('Running database cleanup...');
        // Implement cleanup logic
      },
    });

    // Analytics aggregation (hourly)
    this.registerTask({
      id: 'analytics-aggregation',
      name: 'Analytics Aggregation',
      cronExpression: '0 * * * *',
      enabled: process.env.ENABLE_ANALYTICS === 'true',
      handler: async () => {
        this.logger.info('Aggregating analytics...');
        // Implement analytics aggregation
      },
    });

    // Health check (every 5 minutes)
    this.registerTask({
      id: 'health-check',
      name: 'Health Check',
      cronExpression: '*/5 * * * *',
      enabled: true,
      handler: async () => {
        this.logger.debug('Performing health check...');
        // Check platform connections, database, etc.
      },
    });

    // Backup (daily at 2 AM)
    this.registerTask({
      id: 'database-backup',
      name: 'Database Backup',
      cronExpression: '0 2 * * *',
      enabled: true,
      handler: async () => {
        this.logger.info('Creating database backup...');
        const db = botCore.getDatabase();
        if (db && db.createBackup) {
          await db.createBackup();
        }
      },
    });
  }
}
