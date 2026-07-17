import React, { useEffect, useState } from 'react';
import { AppLogger, LogEntry } from '@/utils/Logger';
import { Trash2, X, Terminal, AlertTriangle, Info, Bug } from 'lucide-react';

export const LogViewer: React.FC = () => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [filter, setFilter] = useState<'all' | 'error' | 'warn' | 'info'>('all');

    useEffect(() => {
        setLogs(AppLogger.getLogs());
        const unsubscribe = AppLogger.subscribe((newLogs) => {
            setLogs(newLogs);
        });
        return unsubscribe;
    }, []);

    const filteredLogs = logs.filter(log => filter === 'all' || log.level === filter);

    const getIcon = (level: string) => {
        switch(level) {
            case 'error': return <AlertTriangle size={14} className="text-red-500" />;
            case 'warn': return <AlertTriangle size={14} className="text-yellow-500" />;
            case 'info': return <Info size={14} className="text-blue-400" />;
            default: return <Bug size={14} className="text-gray-400" />;
        }
    };

    const getColor = (level: string) => {
        switch(level) {
            case 'error': return 'text-red-400 bg-red-500/10 border-red-500/20';
            case 'warn': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
            case 'info': return 'text-blue-300 bg-blue-500/10 border-blue-500/20';
            default: return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#0d0d14]/90 rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/40">
                <div className="flex items-center gap-3">
                    <Terminal className="text-purple-400" size={20} />
                    <h3 className="font-bold text-lg">系統日誌 (Debug Logs)</h3>
                    <div className="flex bg-black/50 p-1 rounded-lg ml-4">
                        {(['all', 'error', 'warn', 'info'] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${filter === f ? 'bg-purple-600/80 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                            >
                                {f.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>
                <button
                    onClick={() => AppLogger.clearLogs()}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors text-sm font-bold"
                >
                    <Trash2 size={16} /> 清空
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar font-mono text-sm flex flex-col gap-2">
                {filteredLogs.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        目前沒有紀錄
                    </div>
                ) : (
                    filteredLogs.map(log => (
                        <div key={log.id} className={`flex items-start gap-3 p-3 rounded-lg border ${getColor(log.level)} transition-colors`}>
                            <div className="mt-0.5">{getIcon(log.level)}</div>
                            <div className="flex flex-col gap-1 min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs opacity-60">
                                        {log.timestamp.toLocaleTimeString('zh-TW', { hour12: false, fractionalSecondDigits: 3 })}
                                    </span>
                                    <span className={`text-[10px] font-bold px-1.5 rounded bg-black/40 uppercase`}>
                                        {log.level}
                                    </span>
                                </div>
                                <div className="break-words whitespace-pre-wrap leading-relaxed opacity-90">
                                    {log.message}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
