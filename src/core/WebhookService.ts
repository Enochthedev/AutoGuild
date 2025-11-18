import express, { Express, Request, Response } from 'express';
import { Logger } from './Logger';
import crypto from 'crypto';

export interface WebhookHandler {
  id: string;
  path: string;
  secret?: string;
  handler: (payload: any, headers: any) => Promise<void> | void;
  verifySignature?: (payload: string, signature: string, secret: string) => boolean;
}

export class WebhookService {
  private logger: Logger;
  private app: Express;
  private handlers: Map<string, WebhookHandler>;
  private server: any;

  constructor() {
    this.logger = new Logger('WebhookService');
    this.app = express();
    this.handlers = new Map();

    // Middleware
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  /**
   * Register a webhook handler
   */
  public registerWebhook(handler: WebhookHandler): void {
    if (this.handlers.has(handler.id)) {
      this.logger.warn(`Webhook ${handler.id} already registered, replacing...`);
    }

    this.handlers.set(handler.id, handler);

    this.app.post(handler.path, async (req: Request, res: Response) => {
      try {
        // Verify signature if secret is provided
        if (handler.secret) {
          const signature = req.headers['x-hub-signature'] as string ||
                          req.headers['x-signature'] as string;

          if (!signature) {
            res.status(401).json({ error: 'Missing signature' });
            return;
          }

          const verifyFn = handler.verifySignature || this.defaultSignatureVerifier;
          const bodyStr = JSON.stringify(req.body);

          if (!verifyFn(bodyStr, signature, handler.secret)) {
            res.status(401).json({ error: 'Invalid signature' });
            return;
          }
        }

        await handler.handler(req.body, req.headers);
        res.status(200).json({ success: true });
      } catch (error: any) {
        this.logger.error(`Error handling webhook ${handler.id}`, error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.logger.info(`Registered webhook: ${handler.id} at ${handler.path}`);
  }

  /**
   * Default HMAC SHA256 signature verifier
   */
  private defaultSignatureVerifier(payload: string, signature: string, secret: string): boolean {
    const hmac = crypto.createHmac('sha256', secret);
    const digest = 'sha256=' + hmac.update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  }

  /**
   * Start webhook server
   */
  public async start(port: number = 3001): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(port, () => {
          this.logger.info(`Webhook server listening on port ${port}`);
          resolve();
        });

        this.server.on('error', (error: Error) => {
          this.logger.error('Webhook server error', error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop webhook server
   */
  public async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close((error: Error) => {
          if (error) {
            this.logger.error('Error stopping webhook server', error);
            reject(error);
          } else {
            this.logger.info('Webhook server stopped');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get Express app instance (for custom routes)
   */
  public getApp(): Express {
    return this.app;
  }

  /**
   * Register common webhook integrations
   */
  public registerDefaultWebhooks(botCore: any): void {
    // GitHub webhook
    this.registerWebhook({
      id: 'github',
      path: '/webhooks/github',
      secret: process.env.GITHUB_WEBHOOK_SECRET,
      handler: async (payload, headers) => {
        const event = headers['x-github-event'];
        this.logger.info(`Received GitHub ${event} event`);
        // Handle GitHub events (issues, PRs, etc.)
      },
    });

    // Generic webhook for external integrations
    this.registerWebhook({
      id: 'generic',
      path: '/webhooks/generic',
      handler: async (payload, headers) => {
        this.logger.info('Received generic webhook', { payload });
        // Process generic webhook
      },
    });
  }
}
