import React, { useMemo } from 'react';
import { VisualizerConfig } from '../types';

interface LyricLineProps {
    text: string;
    isActive: boolean;
    config: VisualizerConfig;
    style: React.CSSProperties;
    offset: number; // e.g. -1 for prev line, 0 for current, 1 for next line
}

export const LyricLine: React.FC<LyricLineProps> = ({ text, isActive, config, style, offset }) => {
    // Determine opacity and scale based on offset
    const getTransformAndOpacity = () => {
        const distance = Math.abs(offset);
        let translateX = 0;
        
        // Arc effect
        if (config.lyricsArcEnabled) {
            // e.g. distance 1 -> 20px, distance 2 -> 60px, distance 3 -> 120px
            const arcOffset = Math.pow(distance, 1.5) * 20; 
            if (config.lyricsArcDirection === 'left') {
                translateX = arcOffset; // Shift right to form a 'C' (opening left)
            } else {
                translateX = -arcOffset; // Shift left
            }
        }
        
        
        if (!config.performanceMode) {
            // Evaluated outside
        }

        if (isActive) {
            return {
                opacity: Math.max(0.9, config.lyricsOpacity),
                transform: `scale(1.15) translateX(${translateX}px)`,
                filter: 'none',
                fontWeight: '900', // extra bold for active
                // color is inherited from containerStyle (config.lyricsColor)
            };
        } else {
            // Sharp opacity dropoff
            const opacity = Math.max(0.05, (config.lyricsOpacity * 0.45) - (distance * 0.15));
            // Subtle scaling
            const scale = Math.max(0.6, 0.95 - (distance * 0.05));
            // Strong blur for perspective effect
            const isBlurEnabled = config.lyricsBlurEnabled !== false; // Default true for HMR
            const blur = isBlurEnabled ? `blur(${distance * 2.5}px)` : 'none';

            return {
                opacity,
                transform: `scale(${scale}) translateX(${translateX}px)`,
                filter: blur,
                // color is inherited from containerStyle (config.lyricsColor)
            };
        }
    };

    // Calculate text effects to apply directly to spans
    let textShadow: string | undefined = undefined;
    let webkitTextStroke: string | undefined = undefined;
    
    const isGlowEnabled = config.lyricsGlowEnabled !== false;
    const isStrokeEnabled = config.lyricsStrokeEnabled !== false;

    if (isGlowEnabled) {
        textShadow = `0 0 ${config.lyricsGlowRadius}px ${config.lyricsGlowColor}, 0 0 ${config.lyricsGlowRadius * 2}px ${config.lyricsGlowColor}`;
    }
    if (isStrokeEnabled) {
        webkitTextStroke = `${config.lyricsStrokeWidth}px ${config.lyricsStrokeColor}`;
    }

    const containerStyle = {
        ...style,
        ...getTransformAndOpacity(),
        transition: 'all 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
        transformOrigin: 'center center',
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        flexWrap: 'wrap' as const,
        textShadow: textShadow,
        WebkitTextStroke: webkitTextStroke,
    };

    // Split text into characters if active, else just render the text
    const renderContent = () => {
        if (!isActive) {
            return text;
        }

        // Apply word-by-word or char-by-char effect
        // Mineradio uses characters for Asian languages, words for English. 
        // We'll split by characters but preserve words for English by grouping them.
        // For simplicity and cool effects, character splitting is often best for lyrics.
        const chars = text.split('');
        
        return chars.map((char, index) => {
            // Apply delay based on character index for wave/typewriter effects
            const delay = index * 0.05; // 50ms per character
            
            // Loop animations
            let animClass = '';
            let animStyle: React.CSSProperties = {
                display: 'inline-block',
                whiteSpace: 'pre'
            };

            if (config.lyricsAnimLoop === 'wave') {
                animClass = 'animate-[wave_3s_ease-in-out_infinite]';
                animStyle.animationDelay = `${delay}s`;
            } else if (config.lyricsAnimLoop === 'bounce') {
                animClass = 'animate-[bounce_2s_infinite]';
                animStyle.animationDelay = `${delay}s`;
            } else if (config.lyricsAnimLoop === 'blink') {
                animClass = 'animate-pulse';
                animStyle.animationDelay = `${delay}s`;
            }

            // Entrance animations (simplified via CSS keyframes)
            const enterClass = config.lyricsAnimEnter ? `animate-[${config.lyricsAnimEnter}_0.5s_ease-out_forwards]` : '';

            return (
                <span 
                    key={index} 
                    className={`${animClass} ${enterClass}`}
                    style={animStyle}
                >
                    {char}
                </span>
            );
        });
    };

    return (
        <div className="lyric-line-container z-10" style={containerStyle}>
            {renderContent()}
        </div>
    );
};
