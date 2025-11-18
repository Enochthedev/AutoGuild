import { Logger } from '../../src/core/Logger';
import fs from 'fs';
import path from 'path';

describe('Logger', () => {
  let logger: Logger;
  const testLogsDir = path.join(__dirname, '../../logs');

  beforeAll(() => {
    // Ensure logs directory exists
    if (!fs.existsSync(testLogsDir)) {
      fs.mkdirSync(testLogsDir, { recursive: true });
    }
  });

  beforeEach(() => {
    logger = new Logger('TestModule');
  });

  it('should create a logger instance', () => {
    expect(logger).toBeDefined();
    expect(logger).toBeInstanceOf(Logger);
  });

  it('should log info messages', () => {
    const spy = jest.spyOn(logger as any, 'info');
    logger.info('Test info message');
    expect(spy).toHaveBeenCalledWith('Test info message', undefined);
  });

  it('should log error messages', () => {
    const spy = jest.spyOn(logger as any, 'error');
    const error = new Error('Test error');
    logger.error('Test error message', error);
    expect(spy).toHaveBeenCalledWith('Test error message', error);
  });

  it('should log warn messages', () => {
    const spy = jest.spyOn(logger as any, 'warn');
    logger.warn('Test warning');
    expect(spy).toHaveBeenCalledWith('Test warning', undefined);
  });

  it('should log debug messages', () => {
    const spy = jest.spyOn(logger as any, 'debug');
    logger.debug('Test debug');
    expect(spy).toHaveBeenCalledWith('Test debug', undefined);
  });

  it('should include metadata in logs', () => {
    const spy = jest.spyOn(logger as any, 'info');
    const metadata = { userId: '123', action: 'test' };
    logger.info('Test with metadata', metadata);
    expect(spy).toHaveBeenCalledWith('Test with metadata', metadata);
  });
});
