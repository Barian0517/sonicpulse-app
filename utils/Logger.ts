import { invoke } from '@tauri-apps/api/core';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
    id: string;
    timestamp: Date;
    level: LogLevel;
    message: string;
}

class Logger {
    private logs: LogEntry[] = [];
    private listeners: Set<(logs: LogEntry[]) => void> = new Set();
    private maxLogs = 1000;

    constructor() {
        // Catch global errors
        window.addEventListener('error', (e) => {
            this.error(`Uncaught Error: ${e.message} at ${e.filename}:${e.lineno}`);
        });
        window.addEventListener('unhandledrejection', (e) => {
            this.error(`Unhandled Promise Rejection: ${e.reason}`);
        });
    }

    private addLog(level: LogLevel, message: string) {
        const entry: LogEntry = {
            id: Math.random().toString(36).substring(2, 9),
            timestamp: new Date(),
            level,
            message
        };
        
        this.logs.unshift(entry); // Add to beginning
        if (this.logs.length > this.maxLogs) {
            this.logs.pop();
        }
        
        this.notifyListeners();
        
        // Write to file asynchronously without blocking
        invoke('write_log', { level, message }).catch(err => {
            console.error("Failed to write log to file:", err);
        });

        // Also output to console
        if (level === 'error') console.error(message);
        else if (level === 'warn') console.warn(message);
        else console.log(message);
    }

    info(message: string) {
        this.addLog('info', message);
    }

    warn(message: string) {
        this.addLog('warn', message);
    }

    error(message: string) {
        this.addLog('error', message);
    }

    debug(message: string) {
        this.addLog('debug', message);
    }

    getLogs() {
        return [...this.logs];
    }

    clearLogs() {
        this.logs = [];
        this.notifyListeners();
        this.info("Logs cleared");
    }

    subscribe(callback: (logs: LogEntry[]) => void) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    private notifyListeners() {
        const logsCopy = [...this.logs];
        this.listeners.forEach(callback => callback(logsCopy));
    }
}

export const AppLogger = new Logger();
