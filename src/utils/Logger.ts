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

  constructor(name?: string) {
    this.name = name ?? 'root';
  }

  private emit(level: LogLevel, message: string, meta?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      name: this.name,
      message,
      meta
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

  verbose(message: string, meta?: any) { return this.emit('verbose', message, meta); }
  log(message: string, meta?: any) { return this.emit('info', message, meta); }
  warn(message: string, meta?: any) { return this.emit('warn', message, meta); }
  error(message: string, meta?: any) { return this.emit('error', message, meta); }
}

export default Logger;
