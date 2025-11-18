import { Logger } from './Logger';

export interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  backoffMultiplier?: number;
  maxDelayMs?: number;
  retryableErrors?: string[];
}

export class RetryHandler {
  private logger: Logger;
  private defaultOptions: Required<RetryOptions>;

  constructor() {
    this.logger = new Logger('RetryHandler');
    this.defaultOptions = {
      maxAttempts: parseInt(process.env.MAX_RETRY_ATTEMPTS || '3'),
      delayMs: parseInt(process.env.RETRY_DELAY_MS || '1000'),
      backoffMultiplier: 2,
      maxDelayMs: 30000, // 30 seconds max
      retryableErrors: [
        'ECONNRESET',
        'ETIMEDOUT',
        'ENOTFOUND',
        'ECONNREFUSED',
        'EHOSTUNREACH',
        'ENETUNREACH',
        'EAI_AGAIN',
      ],
    };
  }

  /**
   * Execute a function with retry logic
   */
  public async executeWithRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {},
    context: string = 'operation'
  ): Promise<T> {
    const opts = { ...this.defaultOptions, ...options };
    let lastError: Error | undefined;
    let delay = opts.delayMs;

    for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
      try {
        const result = await fn();
        if (attempt > 1) {
          this.logger.info(`${context} succeeded on attempt ${attempt}`);
        }
        return result;
      } catch (error: any) {
        lastError = error;

        // Check if error is retryable
        const isRetryable = this.isRetryableError(error, opts.retryableErrors);

        if (!isRetryable || attempt >= opts.maxAttempts) {
          this.logger.error(
            `${context} failed after ${attempt} attempt(s)${!isRetryable ? ' (non-retryable error)' : ''}`,
            error
          );
          throw error;
        }

        this.logger.warn(
          `${context} failed on attempt ${attempt}/${opts.maxAttempts}, retrying in ${delay}ms...`,
          { error: error.message }
        );

        // Wait before retrying
        await this.sleep(delay);

        // Exponential backoff
        delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
      }
    }

    throw lastError || new Error(`${context} failed after ${opts.maxAttempts} attempts`);
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: any, retryableErrors: string[]): boolean {
    if (!error) return false;

    // Check error code
    if (error.code && retryableErrors.includes(error.code)) {
      return true;
    }

    // Check error message
    if (error.message) {
      const message = error.message.toLowerCase();
      return (
        message.includes('timeout') ||
        message.includes('network') ||
        message.includes('connection') ||
        message.includes('econnreset') ||
        message.includes('rate limit')
      );
    }

    // Check HTTP status codes (if applicable)
    if (error.status || error.statusCode) {
      const status = error.status || error.statusCode;
      // Retry on 429 (rate limit), 500, 502, 503, 504
      return [429, 500, 502, 503, 504].includes(status);
    }

    return false;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Retry with exponential backoff for API calls
   */
  public async retryAPICall<T>(
    fn: () => Promise<T>,
    apiName: string = 'API'
  ): Promise<T> {
    return this.executeWithRetry(fn, {}, `${apiName} call`);
  }
}
