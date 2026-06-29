import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, Trash2, FolderPlus, Save, AlertTriangle, Settings2, Upload } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { useTranslation } from '../../providers/I18nProvider';

export const MusicFreePluginManager: React.FC<{ provider: any }> = ({ provider }) => {
    const [plugins, setPlugins] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [installUrl, setInstallUrl] = useState('');
    const [isInstalling, setIsInstalling] = useState(false);
    
    // For Variables modal
    const [activePlugin, setActivePlugin] = useState<any>(null);
    const [variables, setVariables] = useState<Record<string, string>>({});
    
    // For Disabled plugins
    const [disabledPlugins, setDisabledPlugins] = useState<string[]>(() => {
        try { return JSON.parse(localStorage.getItem('sonicpulse_disabled_plugins') || '[]'); } catch { return []; }
    });
    const { t } = useTranslation();

    const togglePlugin = (id: string) => {
        const newDisabled = disabledPlugins.includes(id) 
            ? disabledPlugins.filter(p => p !== id) 
            : [...disabledPlugins, id];
        setDisabledPlugins(newDisabled);
        localStorage.setItem('sonicpulse_disabled_plugins', JSON.stringify(newDisabled));
        window.dispatchEvent(new CustomEvent('sonicpulse-disabled-plugins-changed', { detail: newDisabled }));
    };

    const loadPlugins = async () => {
        setIsLoading(true);
        try {
            const list = await provider.getPlugins();
            setPlugins(list);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadPlugins();
    }, [provider]);

    const handleInstallLocal = async () => {
        try {
            const selected = await open({
                multiple: false,
                filters: [{ name: 'Javascript', extensions: ['js'] }]
            });
            if (selected && typeof selected === 'string') {
                setIsInstalling(true);
                await provider.installLocalPlugin(selected);
                await loadPlugins();
                window.dispatchEvent(new CustomEvent('sonicpulse-toast', { detail: '安裝成功' }));
                window.dispatchEvent(new CustomEvent('sonicpulse-reload-source', { detail: 'musicfree' }));
            }
        } catch (e: any) {
            window.dispatchEvent(new CustomEvent('sonicpulse-toast', { detail: `安裝失敗: ${e.message}` }));
        } finally {
            setIsInstalling(false);
        }
    };

    const handleInstallUrl = async () => {
        if (!installUrl.trim()) return;
        setIsInstalling(true);
        try {
            const res = await provider.installNetworkPlugin(installUrl.trim());
            setInstallUrl('');
            await loadPlugins();
            if (res.installed && res.installed.length > 1) {
                window.dispatchEvent(new CustomEvent('sonicpulse-toast', { detail: `成功安裝 ${res.installed.length} 個插件` }));
            } else {
                window.dispatchEvent(new CustomEvent('sonicpulse-toast', { detail: '安裝成功' }));
            }
            window.dispatchEvent(new CustomEvent('sonicpulse-reload-source', { detail: 'musicfree' }));
        } catch (e: any) {
            window.dispatchEvent(new CustomEvent('sonicpulse-toast', { detail: `安裝失敗: ${e.message}` }));
        } finally {
            setIsInstalling(false);
        }
    };

    const handleUninstall = async (id: string) => {
        if (!confirm('確定要解除安裝此插件？')) return;
        try {
            await provider.uninstallPlugin(id);
            await loadPlugins();
            window.dispatchEvent(new CustomEvent('sonicpulse-toast', { detail: '已解除安裝' }));
            window.dispatchEvent(new CustomEvent('sonicpulse-reload-source', { detail: 'musicfree' }));
        } catch (e: any) {
            window.dispatchEvent(new CustomEvent('sonicpulse-toast', { detail: `卸載失敗: ${e.message}` }));
        }
    };

    const handleUpdate = async (p: any) => {
        if (!p.srcUrl) {
            window.dispatchEvent(new CustomEvent('sonicpulse-toast', { detail: '此插件不支援線上更新' }));
            return;
        }
        try {
            setIsInstalling(true);
            await provider.installNetworkPlugin(p.srcUrl);
            await loadPlugins();
            window.dispatchEvent(new CustomEvent('sonicpulse-toast', { detail: '更新成功' }));
        } catch (e: any) {
            window.dispatchEvent(new CustomEvent('sonicpulse-toast', { detail: `更新失敗: ${e.message}` }));
        } finally {
            setIsInstalling(false);
        }
    };

    const openVariables = (p: any) => {
        setActivePlugin(p);
        const initVars: Record<string, string> = {};
        p.userVariables.forEach((v: any) => {
            initVars[v.key] = ''; // We can't fetch current easily from the API right now, assume empty or handled by user
        });
        setVariables(initVars);
    };

    const saveVariables = async () => {
        if (!activePlugin) return;
        try {
            await provider.saveVariables(activePlugin.id, variables);
            window.dispatchEvent(new CustomEvent('sonicpulse-toast', { detail: '變數已儲存' }));
            setActivePlugin(null);
        } catch(e) {
            window.dispatchEvent(new CustomEvent('sonicpulse-toast', { detail: '儲存失敗' }));
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <h2 className="text-3xl font-black mb-6 text-white tracking-tight flex items-center gap-3">
                <Settings2 className="text-purple-400" /> {t('pluginManager.title')}
            </h2>

            <div className="flex gap-4 mb-8 bg-black/40 p-4 rounded-xl border border-white/10">
                <button 
                    onClick={handleInstallLocal}
                    disabled={isInstalling}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/40 border border-purple-500/50 rounded-lg text-purple-300 font-bold transition-colors disabled:opacity-50"
                >
                    <FolderPlus size={18} />
                    {t('pluginManager.installLocal')}
                </button>
                <div className="flex-1 flex gap-2">
                    <input 
                        type="text" 
                        placeholder="輸入插件網址 (例如 GitHub raw url)"
                        value={installUrl}
                        onChange={e => setInstallUrl(e.target.value)}
                        className="flex-1 bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50"
                    />
                    <button 
                        onClick={handleInstallUrl}
                        disabled={isInstalling || !installUrl.trim()}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/50 rounded-lg text-blue-300 font-bold transition-colors disabled:opacity-50"
                    >
                        <Download size={18} />
                        {t('pluginManager.installUrl')}
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-24">
                {isLoading ? (
                    <div className="flex items-center justify-center h-40">
                        <RefreshCw className="animate-spin text-purple-500" size={32} />
                    </div>
                ) : plugins.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                        <AlertTriangle size={48} className="mb-4 opacity-50" />
                        <p>目前沒有安裝任何插件</p>
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/10 text-gray-400 text-sm">
                                <th className="py-3 px-4 font-normal">#</th>
                                <th className="py-3 px-4 font-normal">來源 (ID)</th>
                                <th className="py-3 px-4 font-normal">版本號</th>
                                <th className="py-3 px-4 font-normal">作者</th>
                                <th className="py-3 px-4 font-normal">狀態</th>
                                <th className="py-3 px-4 font-normal">操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {plugins.map((p, idx) => (
                                <tr key={p.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                                    <td className="py-3 px-4 text-gray-500">{idx + 1}</td>
                                    <td className="py-3 px-4 text-white font-medium">
                                        {p.platform}
                                        <div className="text-xs text-gray-500 mt-1">{p.id}</div>
                                    </td>
                                    <td className="py-3 px-4 text-gray-400">{p.version || '-'}</td>
                                    <td className="py-3 px-4 text-gray-400 text-sm max-w-[150px] truncate" title={p.author}>{p.author || '-'}</td>
                                    <td className="py-3 px-4">
                                        <button 
                                            onClick={() => togglePlugin(p.id)}
                                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${disabledPlugins.includes(p.id) ? 'bg-gray-600' : 'bg-green-500'}`}
                                        >
                                            <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${disabledPlugins.includes(p.id) ? 'translate-x-1' : 'translate-x-5'}`} />
                                        </button>
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-3 opacity-50 group-hover:opacity-100 transition-opacity">
                                            {p.srcUrl && (
                                                <button onClick={() => handleUpdate(p)} className="text-blue-400 hover:text-blue-300 text-sm font-medium flex items-center gap-1">
                                                    <RefreshCw size={14} /> 更新
                                                </button>
                                            )}
                                            {p.userVariables && p.userVariables.length > 0 && (
                                                <button onClick={() => openVariables(p)} className="text-purple-400 hover:text-purple-300 text-sm font-medium flex items-center gap-1">
                                                    <Settings2 size={14} /> {t('pluginManager.variables')}
                                                </button>
                                            )}
                                            {p.hasImportMusicSheet && (
                                                <button className="text-green-400 hover:text-green-300 text-sm font-medium flex items-center gap-1" onClick={() => window.dispatchEvent(new CustomEvent('sonicpulse-toast', {detail: '匯入歌單功能尚未實作'}))}>
                                                    <Upload size={14} /> 歌單
                                                </button>
                                            )}
                                            <button onClick={() => handleUninstall(p.id)} className="text-red-400 hover:text-red-300 text-sm font-medium flex items-center gap-1 ml-2">
                                                <Trash2 size={14} /> {t('pluginManager.uninstall')}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Variables Modal */}
            {activePlugin && (
                <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-[#1e1e2e] rounded-2xl w-full max-w-md border border-white/10 shadow-2xl p-6 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-blue-500" />
                        <h3 className="text-xl font-bold text-white mb-2">{activePlugin.platform} 用戶變量</h3>
                        <p className="text-sm text-gray-400 mb-6">設定 Cookie、來源金鑰或其他插件需要的變數</p>

                        <div className="space-y-4 mb-8">
                            {activePlugin.userVariables.map((v: any) => (
                                <div key={v.key}>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">{v.name} ({v.key})</label>
                                    <input 
                                        type="text"
                                        placeholder={v.hint || ''}
                                        value={variables[v.key] || ''}
                                        onChange={(e) => setVariables({...variables, [v.key]: e.target.value})}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-purple-500 outline-none"
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setActivePlugin(null)} className="px-4 py-2 rounded-lg text-gray-400 hover:text-white transition-colors">
                                取消
                            </button>
                            <button onClick={saveVariables} className="flex items-center gap-2 px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition-colors">
                                <Save size={18} />
                                儲存變數
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
