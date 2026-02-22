"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const fs_1 = __importDefault(require("fs"));
class Logger {
    constructor(name) {
        this.name = name ?? 'root';
    }
    emit(level, message, meta) {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            name: this.name,
            message,
            meta
        };
        for (const s of Array.from(Logger.subscribers)) {
            try {
                s(entry);
            }
            catch { /* ignore subscriber errors */ }
        }
        return entry;
    }
    subscribe(fn) {
        Logger.subscribers.add(fn);
        return () => { Logger.subscribers.delete(fn); };
    }
    static subscribe(fn) {
        Logger.subscribers.add(fn);
        return () => { Logger.subscribers.delete(fn); };
    }
    static setLevel(level) {
        if (level in Logger.levelPriority)
            Logger.minLevel = level;
    }
    static getLevel() {
        return Logger.minLevel;
    }
    static ConsoleSubscriber(levels = ['verbose', 'info', 'warn', 'error']) {
        // accept a single level or an array of levels; if omitted, obey minLevel priority
        let allowed = null;
        if (levels !== undefined) {
            const arr = Array.isArray(levels) ? levels : [levels];
            const mapped = arr.map(l => (l === 'info' ? 'info' : l));
            allowed = new Set(mapped);
        }
        const subscriber = (entry) => {
            if (allowed) {
                if (!allowed.has(entry.level))
                    return;
            }
            else {
                const pri = Logger.levelPriority[entry.level];
                const minPri = Logger.levelPriority[Logger.minLevel];
                if (pri < minPri)
                    return; // filtered out by minLevel
            }
            const meta = entry.meta ? ` ${JSON.stringify(entry.meta)}` : '';
            const out = `[${entry.timestamp}] [${entry.name}] ${entry.level.toUpperCase()}: ${entry.message}${meta}`;
            if (entry.level === 'error')
                console.error(out, entry.meta);
            else if (entry.level === 'warn')
                console.warn(out, entry.meta);
            else
                console.log(out, entry.meta);
        };
        return subscriber;
    }
    static FileSubscriber(filePath, levels = ['verbose', 'info', 'warn', 'error']) {
        // accept a single level or an array of levels; if omitted, obey minLevel priority
        let allowed = null;
        if (levels !== undefined) {
            const arr = Array.isArray(levels) ? levels : [levels];
            const mapped = arr.map(l => (l === 'info' ? 'info' : l));
            allowed = new Set(mapped);
        }
        // Ensure the directory exists
        const dir = filePath.split('/').slice(0, -1).join('/');
        if (dir && !fs_1.default.existsSync(dir)) {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
        const subscriber = (entry) => {
            if (allowed) {
                if (!allowed.has(entry.level))
                    return;
            }
            else {
                const pri = Logger.levelPriority[entry.level];
                const minPri = Logger.levelPriority[Logger.minLevel];
                if (pri < minPri)
                    return; // filtered out by minLevel
            }
            const meta = entry.meta ? ` ${JSON.stringify(entry.meta)}` : '';
            const out = `[${entry.timestamp}] ${entry.level.toUpperCase()} [${entry.name}]: ${entry.message}${meta}`;
            try {
                fs_1.default.appendFileSync(filePath, out + '\n');
            }
            catch (err) {
                console.error(`Failed to write to log file ${filePath}:`, err);
            }
        };
        return subscriber;
    }
    verbose(message, meta) { return this.emit('verbose', message, meta); }
    log(message, meta) { return this.emit('info', message, meta); }
    warn(message, meta) { return this.emit('warn', message, meta); }
    error(message, meta) { return this.emit('error', message, meta); }
}
exports.Logger = Logger;
Logger.subscribers = new Set();
Logger.levelPriority = { verbose: 0, info: 1, warn: 2, error: 3 };
Logger.minLevel = process.env.LOG_LEVEL ?? 'verbose';
exports.default = Logger;
