import fs from 'fs';

export type LogLevel = 'verbose' | 'info' | 'warn' | 'error';

export type LogEntry = {
  timestamp: string;
  level: LogLevel;
  name?: string;
  message: string;
  meta?: any;
};

export type LogSubscriber = (entry: LogEntry) => void;

export class Logger {
  private name: string;
  private static subscribers = new Set<LogSubscriber>();
  private static levelPriority: Record<LogLevel, number> = { verbose: 0, info: 1, warn: 2, error: 3 };
  private static minLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) ?? 'verbose';
  private static secretValues: Set<string> = new Set();

  constructor(name?: string) {
    this.name = name ?? 'root';
  }

  /**
   * Register secret values that should be redacted from logs
   * @param secrets Array of secret values or a map of secret values
   */
  static registerSecrets(secrets: string[] | Record<string, string>): void {
    const values = Array.isArray(secrets) ? secrets : Object.values(secrets);
    for (const value of values) {
      if (value && typeof value === 'string' && value.length > 0) {
        Logger.secretValues.add(value);
      }
    }
  }

  /**
   * Clear all registered secrets
   */
  static clearSecrets(): void {
    Logger.secretValues.clear();
  }

  /**
   * Redact secret values from a string or object
   */
  private static redactSecrets(value: any): any {
    if (Logger.secretValues.size === 0) {
      return value;
    }

    if (typeof value === 'string') {
      let redacted = value;
      for (const secret of Logger.secretValues) {
        if (secret.length > 0) {
          redacted = redacted.split(secret).join('[REDACTED]');
        }
      }
      return redacted;
    } else if (Array.isArray(value)) {
      return value.map((item) => Logger.redactSecrets(item));
    } else if (typeof value === 'object' && value !== null) {
      const result: Record<string, any> = {};
      for (const key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          result[key] = Logger.redactSecrets(value[key]);
        }
      }
      return result;
    }
    return value;
  }

  private emit(level: LogLevel, message: string, meta?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      name: this.name,
      message: Logger.redactSecrets(message),
      meta: Logger.redactSecrets(meta)
    };
    for (const s of Array.from(Logger.subscribers)) {
      try { s(entry); } catch { /* ignore subscriber errors */ }
    }
    return entry;
  }

  subscribe(fn: LogSubscriber): () => void {
    Logger.subscribers.add(fn);
    return () => { Logger.subscribers.delete(fn); };
  }

  static subscribe(fn: LogSubscriber): () => void {
    Logger.subscribers.add(fn);
    return () => { Logger.subscribers.delete(fn); };
  }

  static setLevel(level: LogLevel) {
    if (level in Logger.levelPriority) Logger.minLevel = level;
  }

  static getLevel(): LogLevel {
    return Logger.minLevel;
  }

  static ConsoleSubscriber(levels: LogLevel | LogLevel[] = ['verbose', 'info', 'warn', 'error']): LogSubscriber {
    // accept a single level or an array of levels; if omitted, obey minLevel priority
    let allowed: Set<LogLevel> | null = null;
    if (levels !== undefined) {
        const arr = Array.isArray(levels) ? levels : [levels];
        const mapped = arr.map(l => (l === 'info' ? 'info' : l));
        allowed = new Set<LogLevel>(mapped as LogLevel[]);
    }

    const subscriber: LogSubscriber = (entry) => {
        if (allowed) {
          if (!allowed.has(entry.level)) return;
        } else {
          const pri = Logger.levelPriority[entry.level];
          const minPri = Logger.levelPriority[Logger.minLevel];
          if (pri < minPri) return; // filtered out by minLevel
        }
        const meta = entry.meta ? ` ${JSON.stringify(entry.meta)}` : '';
        const out = `[${entry.timestamp}] [${entry.name}] ${entry.level.toUpperCase()}: ${entry.message}${meta}`;
        if (entry.level === 'error') console.error(out, entry.meta);
        else if (entry.level === 'warn') console.warn(out, entry.meta);
        else console.log(out, entry.meta);
    };
    return subscriber
  }

  static FileSubscriber(filePath: string, levels: LogLevel | LogLevel[] = ['verbose', 'info', 'warn', 'error']): LogSubscriber {
    // accept a single level or an array of levels; if omitted, obey minLevel priority
    let allowed: Set<LogLevel> | null = null;
    if (levels !== undefined) {
        const arr = Array.isArray(levels) ? levels : [levels];
        const mapped = arr.map(l => (l === 'info' ? 'info' : l));
        allowed = new Set<LogLevel>(mapped as LogLevel[]);
    }

    // Ensure the directory exists
    const dir = filePath.split('/').slice(0, -1).join('/');
    if (dir && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const subscriber: LogSubscriber = (entry) => {
        if (allowed) {
          if (!allowed.has(entry.level)) return;
        } else {
          const pri = Logger.levelPriority[entry.level];
          const minPri = Logger.levelPriority[Logger.minLevel];
          if (pri < minPri) return; // filtered out by minLevel
        }
        const meta = entry.meta ? ` ${JSON.stringify(entry.meta)}` : '';
        const out = `[${entry.timestamp}] ${entry.level.toUpperCase()} [${entry.name}]: ${entry.message}${meta}`;
        
        try {
          fs.appendFileSync(filePath, out + '\n');
        } catch (err) {
          console.error(`Failed to write to log file ${filePath}:`, err);
        }
    };
    return subscriber
  }

  verbose(message: string, meta?: any) { return this.emit('verbose', message, meta); }
  log(message: string, meta?: any) { return this.emit('info', message, meta); }
  warn(message: string, meta?: any) { return this.emit('warn', message, meta); }
  error(message: string, meta?: any) { return this.emit('error', message, meta); }
}

export default Logger;
