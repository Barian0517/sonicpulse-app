import React, { useEffect, useState, useRef, useMemo } from 'react';
import { VisualizerConfig } from '@/types';
import { Track } from '@/providers/MusicProvider';
import { parseLrc, LyricLine as ParsedLyricLine } from '@/utils/lyricsParser';
import { NavidromeProvider } from '@/providers/NavidromeProvider';
import { LocalProvider } from '@/providers/LocalProvider';
import { NeteaseProvider } from '@/providers/NeteaseProvider';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { LyricLine } from './LyricLine';
import * as OpenCC from 'opencc-js/core';
import * as Locale from 'opencc-js/preset';

interface LyricsOverlayProps {
    track: Track | null;
    currentTime: number;
    config: VisualizerConfig;
    subtitlePreference?: 'original' | 'tw' | 'cn';
}

export const LyricsOverlay: React.FC<LyricsOverlayProps> = ({ track, currentTime, config, subtitlePreference = 'original' }) => {
    const [lyrics, setLyrics] = useState<ParsedLyricLine[]>([]);
    const [activeIndex, setActiveIndex] = useState(-1);
    
    // Providers for fetching lyrics
    const naviProvider = useMemo(() => new NavidromeProvider(), []);
    const localProvider = useMemo(() => new LocalProvider(), []);
    const neteaseProvider = useMemo(() => new NeteaseProvider(), []);

    useEffect(() => {
        if (!track) {
            setLyrics([]);
            return;
        }

        let isActive = true;

        // Clear lyrics immediately while fetching the new track's lyrics
        setLyrics([]);

        const fetchLyrics = async () => {
            let lrcText: string | null = null;
            if (track.source === 'navidrome') {
                lrcText = await naviProvider.getLyrics(track);
            } else if (track.source === 'local') {
                lrcText = await localProvider.getLyrics(track);
            } else if (track.source === 'netease') {
                try {
                    lrcText = await neteaseProvider.getLyrics(track);
                } catch (e) {
                    console.error("Failed to fetch exact Netease lyrics:", e);
                }
            }
            
            // LRCLIB Fallback
            if (!lrcText && track.title && track.artist) {
                try {
                    const params = new URLSearchParams();
                    params.append('artist_name', track.artist);
                    params.append('track_name', track.title);
                    if (track.album) params.append('album_name', track.album);
                    if (track.duration) params.append('duration', Math.round(track.duration).toString());
                    
                    const lrclibRes = await tauriFetch(`https://lrclib.net/api/get?${params.toString()}`);
                    if (lrclibRes.ok) {
                        const data = await lrclibRes.json();
                        lrcText = data.syncedLyrics || data.plainLyrics || null;
                    }

                    // If exact match failed, try fuzzy search
                    if (!lrcText) {
                        const searchParams = new URLSearchParams();
                        const cleanArtist = track.artist.split('/')[0].trim();
                        searchParams.append('q', `${cleanArtist} ${track.title}`);
                        
                        const searchRes = await tauriFetch(`https://lrclib.net/api/search?${searchParams.toString()}`);
                        if (searchRes.ok) {
                            const data = await searchRes.json();
                            if (Array.isArray(data) && data.length > 0) {
                                const match = data.find((d: any) => d.syncedLyrics) || data[0];
                                lrcText = match.syncedLyrics || match.plainLyrics || null;
                            }
                        }
                    }
                } catch (e) {
                    console.error("LRCLIB fallback failed", e);
                }
            }

            // Netease Cloud Music Fallback (For Chinese songs)
            if (!lrcText && track.title) {
                try {
                    const cleanArtist = track.artist ? track.artist.split('/')[0].trim() : '';
                    const query = encodeURIComponent(`${track.title} ${cleanArtist}`.trim());
                    // Search for the song ID
                    const searchRes = await tauriFetch(`https://music.163.com/api/search/get/web?s=${query}&type=1&limit=1`);
                    if (searchRes.ok) {
                        const searchData = await searchRes.json();
                        const songs = searchData.result?.songs;
                        if (songs && songs.length > 0) {
                            const songId = songs[0].id;
                            // Fetch lyrics using the song ID
                            const lyricRes = await tauriFetch(`https://music.163.com/api/song/lyric?id=${songId}&lv=1`);
                            if (lyricRes.ok) {
                                const lyricData = await lyricRes.json();
                                if (lyricData.lrc && lyricData.lrc.lyric) {
                                    lrcText = lyricData.lrc.lyric;
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.error("Netease fallback failed", e);
                }
            }
            
            if (!isActive) return;

            if (lrcText) {
                // Apply Subtitle Translation
                if (subtitlePreference === 'tw') {
                    try {
                        const converter = OpenCC.ConverterFactory(Locale.from.cn, Locale.to.tw);
                        lrcText = converter(lrcText);
                    } catch (e) {
                        console.error('Subtitle conversion to TW failed', e);
                    }
                } else if (subtitlePreference === 'cn') {
                    try {
                        const converter = OpenCC.ConverterFactory(Locale.from.tw, Locale.to.cn);
                        lrcText = converter(lrcText);
                    } catch (e) {
                        console.error('Subtitle conversion to CN failed', e);
                    }
                }

                const parsed = parseLrc(lrcText);
                if (parsed.length > 0) {
                    setLyrics(parsed);
                } else if (lrcText.trim().length > 0) {
                    // Static lyrics (no timestamps)
                    setLyrics([{ time: 0, text: lrcText.trim() }]);
                } else {
                    setLyrics([]);
                }
            } else {
                setLyrics([]);
            }
        };
        fetchLyrics();

        return () => {
            isActive = false;
        };
    }, [track, naviProvider, localProvider, neteaseProvider, subtitlePreference]);

    useEffect(() => {
        if (lyrics.length === 0) {
            setActiveIndex(-1);
            return;
        }

        // Find the current line
        let newIndex = -1;
        for (let i = 0; i < lyrics.length; i++) {
            if (currentTime >= lyrics[i].time) {
                newIndex = i;
            } else {
                break;
            }
        }
        
        // Minor optimization to not trigger renders constantly
        setActiveIndex(prev => prev !== newIndex ? newIndex : prev);
    }, [currentTime, lyrics]);

    if (!config.lyricsEnabled || lyrics.length === 0 || activeIndex === -1) {
        return null;
    }

    // Reduce render window to prevent wall of text on wrapping lines
    const renderWindow = 3;
    const startIdx = Math.max(0, activeIndex - renderWindow);
    const endIdx = Math.min(lyrics.length - 1, activeIndex + renderWindow);
    
    const visibleLines = lyrics.slice(startIdx, endIdx + 1).map((line, idx) => {
        const actualIndex = startIdx + idx;
        const offset = actualIndex - activeIndex;
        return { line, offset, index: actualIndex };
    });

    const containerStyle: React.CSSProperties = {
        fontFamily: config.lyricsFontFamily,
        fontSize: `${config.lyricsFontSize}px`,
        fontWeight: config.lyricsFontWeight,
        fontStyle: config.lyricsFontStyle,
        letterSpacing: `${config.lyricsLetterSpacing}px`,
        color: config.lyricsColor,
        textAlign: 'center',
        padding: config.lyricsBgEnabled ? `${config.lyricsBgPadding}px 32px` : '0px 32px',
        backgroundColor: config.lyricsBgEnabled && config.lyricsBgColor !== 'transparent' ? config.lyricsBgColor : undefined,
        borderRadius: config.lyricsBgEnabled ? `${config.lyricsBgRadius}px` : undefined,
        whiteSpace: 'pre-wrap',
        lineHeight: '1.5',
    };

    return (
        <div 
            className={`absolute inset-0 z-30 pointer-events-none flex flex-col items-center justify-center p-8 overflow-hidden bg-gradient-to-b from-black/80 via-transparent to-black/80 ${config.lyricsBgBlurEnabled !== false ? 'backdrop-blur-sm' : ''}`}
            style={{ WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 25%, black 75%, transparent 100%)', maskImage: 'linear-gradient(to bottom, transparent 0%, black 25%, black 75%, transparent 100%)' }}
        >
            <div 
                className="relative flex flex-col items-center justify-center w-full max-w-4xl h-full gap-6 transition-transform duration-500 ease-out"
                style={{ transform: `translate(${config.lyricsPositionX}%, ${config.lyricsPositionY}%)` }}
            >
                {visibleLines.map(({ line, offset, index }) => (
                    <LyricLine 
                        key={`${line.time}-${index}`} // unique key based on time to ensure clean mounts
                        text={line.text}
                        isActive={offset === 0}
                        config={config}
                        style={containerStyle}
                        offset={offset}
                    />
                ))}
            </div>
        </div>
    );
};
