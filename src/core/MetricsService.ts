import { Logger } from './Logger';
import { Express, Request, Response } from 'express';

export interface Metric {
  name: string;
  type: 'counter' | 'gauge' | 'histogram';
  help: string;
  labels?: Record<string, string>;
  value: number;
}

export class MetricsService {
  private logger: Logger;
  private metrics: Map<string, Metric>;
  private counters: Map<string, number>;
  private gauges: Map<string, number>;
  private histograms: Map<string, number[]>;

  constructor() {
    this.logger = new Logger('Metrics');
    this.metrics = new Map();
    this.counters = new Map();
    this.gauges = new Map();
    this.histograms = new Map();

    // Initialize default metrics
    this.initializeDefaultMetrics();
  }

  private initializeDefaultMetrics(): void {
    // Bot metrics
    this.registerMetric({
      name: 'autoguild_messages_total',
      type: 'counter',
      help: 'Total number of messages processed',
      value: 0,
    });

    this.registerMetric({
      name: 'autoguild_commands_total',
      type: 'counter',
      help: 'Total number of commands executed',
      value: 0,
    });

    this.registerMetric({
      name: 'autoguild_errors_total',
      type: 'counter',
      help: 'Total number of errors encountered',
      value: 0,
    });

    this.registerMetric({
      name: 'autoguild_active_guilds',
      type: 'gauge',
      help: 'Number of active guilds/servers',
      value: 0,
    });

    this.registerMetric({
      name: 'autoguild_active_users',
      type: 'gauge',
      help: 'Number of active users',
      value: 0,
    });

    this.registerMetric({
      name: 'autoguild_command_duration_ms',
      type: 'histogram',
      help: 'Command execution duration in milliseconds',
      value: 0,
    });

    this.registerMetric({
      name: 'autoguild_uptime_seconds',
      type: 'gauge',
      help: 'Bot uptime in seconds',
      value: 0,
    });
  }

  public registerMetric(metric: Metric): void {
    this.metrics.set(metric.name, metric);

    switch (metric.type) {
      case 'counter':
        this.counters.set(metric.name, metric.value);
        break;
      case 'gauge':
        this.gauges.set(metric.name, metric.value);
        break;
      case 'histogram':
        this.histograms.set(metric.name, []);
        break;
    }
  }

  public incrementCounter(name: string, value: number = 1, labels?: Record<string, string>): void {
    const key = this.getMetricKey(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
  }

  public setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getMetricKey(name, labels);
    this.gauges.set(key, value);
  }

  public observeHistogram(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getMetricKey(name, labels);
    const values = this.histograms.get(key) || [];
    values.push(value);
    this.histograms.set(key, values);

    // Keep only last 1000 values to prevent memory issues
    if (values.length > 1000) {
      values.shift();
    }
  }

  private getMetricKey(name: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return name;
    }
    const labelStr = Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return `${name}{${labelStr}}`;
  }

  /**
   * Get metrics in Prometheus format
   */
  public getPrometheusMetrics(): string {
    let output = '';

    // Counters
    for (const [key, value] of this.counters.entries()) {
      const metric = Array.from(this.metrics.values()).find(m => key.startsWith(m.name));
      if (metric) {
        output += `# HELP ${metric.name} ${metric.help}\n`;
        output += `# TYPE ${metric.name} counter\n`;
      }
      output += `${key} ${value}\n\n`;
    }

    // Gauges
    for (const [key, value] of this.gauges.entries()) {
      const metric = Array.from(this.metrics.values()).find(m => key.startsWith(m.name));
      if (metric) {
        output += `# HELP ${metric.name} ${metric.help}\n`;
        output += `# TYPE ${metric.name} gauge\n`;
      }
      output += `${key} ${value}\n\n`;
    }

    // Histograms (simplified - just count and sum)
    for (const [key, values] of this.histograms.entries()) {
      const metric = Array.from(this.metrics.values()).find(m => key.startsWith(m.name));
      if (metric) {
        output += `# HELP ${metric.name} ${metric.help}\n`;
        output += `# TYPE ${metric.name} histogram\n`;
      }
      const sum = values.reduce((a, b) => a + b, 0);
      const count = values.length;
      output += `${key}_sum ${sum}\n`;
      output += `${key}_count ${count}\n\n`;
    }

    return output;
  }

  /**
   * Get metrics as JSON
   */
  public getMetricsJSON(): any {
    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: Object.fromEntries(
        Array.from(this.histograms.entries()).map(([k, v]) => [
          k,
          {
            count: v.length,
            sum: v.reduce((a, b) => a + b, 0),
            avg: v.length > 0 ? v.reduce((a, b) => a + b, 0) / v.length : 0,
            min: v.length > 0 ? Math.min(...v) : 0,
            max: v.length > 0 ? Math.max(...v) : 0,
          },
        ])
      ),
    };
  }

  /**
   * Register metrics endpoint on Express app
   */
  public registerEndpoint(app: Express): void {
    app.get('/metrics', (req: Request, res: Response) => {
      const format = req.query.format as string;

      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(this.getMetricsJSON(), null, 2));
      } else {
        res.setHeader('Content-Type', 'text/plain');
        res.send(this.getPrometheusMetrics());
      }
    });

    this.logger.info('Metrics endpoint registered at /metrics');
  }

  /**
   * Track command execution
   */
  public trackCommand(commandName: string, durationMs: number, success: boolean): void {
    this.incrementCounter('autoguild_commands_total', 1, {
      command: commandName,
      status: success ? 'success' : 'error',
    });
    this.observeHistogram('autoguild_command_duration_ms', durationMs, { command: commandName });
  }

  /**
   * Track message processing
   */
  public trackMessage(platform: string): void {
    this.incrementCounter('autoguild_messages_total', 1, { platform });
  }

  /**
   * Track error
   */
  public trackError(type: string): void {
    this.incrementCounter('autoguild_errors_total', 1, { type });
  }

  /**
   * Update uptime metric
   */
  public updateUptime(startTime: Date): void {
    const uptimeSeconds = Math.floor((Date.now() - startTime.getTime()) / 1000);
    this.setGauge('autoguild_uptime_seconds', uptimeSeconds);
  }
}
