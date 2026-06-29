import React from 'react';
import { Youtube, Facebook, Github, Globe, Gamepad2, Server, X } from 'lucide-react';
import { open } from '@tauri-apps/plugin-shell';

interface AuthorCardProps {
    onClose: () => void;
}

export const AuthorCard: React.FC<AuthorCardProps> = ({ onClose }) => {
    const handleLinkClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        try {
            await open(e.currentTarget.href);
        } catch (err) {
            console.error("Failed to open link via Tauri shell plugin:", err);
            window.open(e.currentTarget.href, "_blank");
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            {/* Close Overlay */}
            <div className="absolute inset-0 cursor-pointer" onClick={onClose}></div>
            
            <div className="relative flex flex-col md:flex-row w-full max-w-4xl bg-[#1a2233]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-8 md:p-12 overflow-hidden shadow-2xl">
                <button onClick={onClose} className="absolute top-4 right-4 z-50 p-2 text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-all">
                    <X size={24} />
                </button>
                <div className="absolute inset-0 bg-gradient-to-br from-[#00bfff]/5 via-transparent to-[#ff00ff]/5 pointer-events-none"></div>
                <div className="absolute top-0 left-0 w-32 h-32 border-t-2 border-l-2 border-[#00bfff]/50 rounded-tl-2xl pointer-events-none"></div>
                <div className="absolute bottom-0 right-0 w-32 h-32 border-b-2 border-r-2 border-[#ff00ff]/50 rounded-br-2xl pointer-events-none"></div>
                
                <div className="flex-shrink-0 mb-8 md:mb-0 md:mr-12 flex flex-col items-center">
                    <div className="relative group">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-[#00bfff] to-[#ff00ff] rounded-2xl opacity-75 blur group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-pulse"></div>
                        <img src="https://home.barian.moe/avatar.jpg" alt="Avatar" className="relative w-[200px] h-[200px] md:w-[280px] md:h-[280px] object-cover rounded-xl shadow-2xl border-2 border-white/10" />
                    </div>
                </div>
                
                <div className="flex-1 text-left relative z-10">
                    <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 tracking-wider">
                        <div className="relative inline-block group">
                            <span className="relative z-10">幽影櫻</span>
                            <span className="absolute top-0 left-0 -z-10 w-full h-full text-[#ff00ff] opacity-0 group-hover:opacity-70 animate-pulse translate-x-[2px]">幽影櫻</span>
                            <span className="absolute top-0 left-0 -z-10 w-full h-full text-[#00bfff] opacity-0 group-hover:opacity-70 animate-pulse -translate-x-[2px]">幽影櫻</span>
                        </div>
                    </h1>
                    
                    <div className="space-y-4 text-gray-300 mb-8 text-lg leading-relaxed">
                        <p className="border-l-2 border-[#00bfff] pl-4">喜歡打遊戲，玩玩 Apex。</p>
                        <p className="border-l-2 border-[#ff00ff] pl-4">最近在研究 ai 相關的內容，寫一些小程序。</p>
                    </div>
                    
                    <div className="flex gap-4 mb-8">
                        <a href="https://www.youtube.com/@barian0517" onClick={handleLinkClick} className="p-3 bg-white/5 rounded-full border border-white/10 hover:border-[#00bfff] transition-colors shadow-[0_0_10px_transparent] hover:shadow-[0_0_15px_#00bfff]" style={{ color: "rgb(255, 0, 0)" }}>
                            <Youtube size={20} />
                        </a>
                        <a href="https://www.facebook.com/barian0517/" onClick={handleLinkClick} className="p-3 bg-white/5 rounded-full border border-white/10 hover:border-[#00bfff] transition-colors shadow-[0_0_10px_transparent] hover:shadow-[0_0_15px_#00bfff]" style={{ color: "rgb(24, 119, 242)" }}>
                            <Facebook size={20} />
                        </a>
                        <a href="https://github.com/Barian0517" onClick={handleLinkClick} className="p-3 bg-white/5 rounded-full border border-white/10 hover:border-[#00bfff] transition-colors shadow-[0_0_10px_transparent] hover:shadow-[0_0_15px_#00bfff]" style={{ color: "rgb(255, 255, 255)" }}>
                            <Github size={20} />
                        </a>
                    </div>
                    
                    <div className="h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent mb-8"></div>
                    
                    <div>
                        <p className="text-[#00bfff] text-sm mb-4 tracking-widest uppercase font-bold">System Links</p>
                        <div className="flex flex-wrap gap-3">
                            <a href="https://home.barian.moe" onClick={handleLinkClick} className="flex items-center gap-2 px-6 py-3 bg-[#1a2233] border border-[#00bfff]/30 rounded-lg text-white font-bold hover:bg-[#00bfff] hover:text-black transition-all duration-300 shadow-[0_0_10px_rgba(0,191,255,0.1)] hover:shadow-[0_0_20px_rgba(0,191,255,0.6)] cursor-pointer">
                                <Globe size={16} />我的主頁
                            </a>
                            <a href="https://barian.moe" onClick={handleLinkClick} className="flex items-center gap-2 px-6 py-3 bg-[#1a2233] border border-[#00bfff]/30 rounded-lg text-white font-bold hover:bg-[#00bfff] hover:text-black transition-all duration-300 shadow-[0_0_10px_rgba(0,191,255,0.1)] hover:shadow-[0_0_20px_rgba(0,191,255,0.6)] cursor-pointer">
                                <Globe size={16} />自我介紹
                            </a>
                            <a href="https://ygoproweb.barian.moe/" onClick={handleLinkClick} className="flex items-center gap-2 px-6 py-3 bg-[#1a2233] border border-[#00bfff]/30 rounded-lg text-white font-bold hover:bg-[#00bfff] hover:text-black transition-all duration-300 shadow-[0_0_10px_rgba(0,191,255,0.1)] hover:shadow-[0_0_20px_rgba(0,191,255,0.6)] cursor-pointer">
                                <Gamepad2 size={16} />ygopro伺服器官網
                            </a>
                            <a href="https://mcweb.barian.moe" onClick={handleLinkClick} className="flex items-center gap-2 px-6 py-3 bg-[#1a2233] border border-[#00bfff]/30 rounded-lg text-white font-bold hover:bg-[#00bfff] hover:text-black transition-all duration-300 shadow-[0_0_10px_rgba(0,191,255,0.1)] hover:shadow-[0_0_20px_rgba(0,191,255,0.6)] cursor-pointer">
                                <Server size={16} />MC伺服器官網
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
