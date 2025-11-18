import express, { Express, Request, Response, NextFunction } from 'express';
import { Logger } from './Logger';
import { BotCore } from './BotCore';
import path from 'path';

export class APIServer {
  private logger: Logger;
  private app: Express;
  private server: any;
  private botCore: BotCore;

  constructor(botCore: BotCore) {
    this.logger = new Logger('APIServer');
    this.app = express();
    this.botCore = botCore;

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Body parsing
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // CORS
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      next();
    });

    // Request logging
    this.app.use((req, res, next) => {
      this.logger.debug(`${req.method} ${req.path}`);
      next();
    });

    // Error handling
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      this.logger.error('API Error', err);
      res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined,
      });
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      const db = this.botCore.getDatabase();
      const platforms = Array.from((this.botCore as any).adapters.keys());

      res.json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        platforms,
        database: db ? 'connected' : 'disconnected',
      });
    });

    // Status endpoint
    this.app.get('/api/status', (req, res) => {
      const platforms = Array.from((this.botCore as any).adapters.entries()).map(
        ([platform, adapter]: any) => ({
          platform,
          ready: adapter.isReady,
        })
      );

      res.json({
        uptime: process.uptime(),
        platforms,
        memory: process.memoryUsage(),
        version: '1.0.0',
      });
    });

    // Database stats
    this.app.get('/api/database/stats', (req, res) => {
      try {
        const db = this.botCore.getDatabase();
        const stats = db.getStats();
        res.json(stats);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Database backup
    this.app.post('/api/database/backup', async (req, res) => {
      try {
        const db = this.botCore.getDatabase();
        const backupPath = await db.createBackup();
        res.json({ success: true, backupPath });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // List backups
    this.app.get('/api/database/backups', (req, res) => {
      try {
        const db = this.botCore.getDatabase();
        const backups = db.listBackups();
        res.json({ backups });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // User stats
    this.app.get('/api/users/:userId/stats', (req, res) => {
      try {
        const { userId } = req.params;
        const { platform = 'discord' } = req.query;
        const db = this.botCore.getDatabase();
        const stats = db.getUserStats(userId, platform as string);

        if (!stats) {
          res.status(404).json({ error: 'User not found' });
          return;
        }

        res.json(stats);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Top users leaderboard
    this.app.get('/api/leaderboard', (req, res) => {
      try {
        const { platform = 'discord', limit = '10' } = req.query;
        const db = this.botCore.getDatabase();
        const topUsers = db.getTopActiveUsers(platform as string, parseInt(limit as string));
        res.json({ leaderboard: topUsers });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Guild configuration
    this.app.get('/api/guilds/:guildId/config', (req, res) => {
      try {
        const { guildId } = req.params;
        const { platform = 'discord' } = req.query;
        const db = this.botCore.getDatabase();
        const config = db.getGuildConfig(guildId, platform as string);

        if (!config) {
          res.status(404).json({ error: 'Guild not found' });
          return;
        }

        res.json(config);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Update guild configuration
    this.app.put('/api/guilds/:guildId/config', (req, res) => {
      try {
        const { guildId } = req.params;
        const { platform = 'discord' } = req.query;
        const db = this.botCore.getDatabase();

        const config = {
          guildId,
          platform: platform as string,
          ...req.body,
        };

        db.setGuildConfig(config);
        res.json({ success: true, config });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Moderation logs
    this.app.get('/api/guilds/:guildId/modlogs', (req, res) => {
      try {
        const { guildId } = req.params;
        const { platform = 'discord', limit = '50' } = req.query;
        const db = this.botCore.getDatabase();
        const logs = db.getModerationLogs(
          guildId,
          platform as string,
          parseInt(limit as string)
        );
        res.json({ logs });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Command statistics
    this.app.get('/api/commands/stats', (req, res) => {
      try {
        const { limit = '10' } = req.query;
        const db = this.botCore.getDatabase();
        const stats = db.getCommandStats(parseInt(limit as string));
        res.json({ commands: stats });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Serve dashboard (if built)
    const dashboardPath = path.join(__dirname, '../../dashboard/dist');
    this.app.use(express.static(dashboardPath));
    this.app.get('*', (req, res) => {
      res.sendFile(path.join(dashboardPath, 'index.html'));
    });
  }

  public async start(port: number = 3000): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(port, () => {
          this.logger.info(`API server listening on port ${port}`);
          this.logger.info(`Dashboard available at http://localhost:${port}`);
          this.logger.info(`API docs available at http://localhost:${port}/api`);
          resolve();
        });

        this.server.on('error', (error: Error) => {
          this.logger.error('API server error', error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close((error: Error) => {
          if (error) {
            this.logger.error('Error stopping API server', error);
            reject(error);
          } else {
            this.logger.info('API server stopped');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  public getApp(): Express {
    return this.app;
  }
}
