export interface LyricLine {
    time: number; // in seconds
    text: string;
}

export function parseLrc(lrcContent: string): LyricLine[] {
    const lines = lrcContent.split('\n');
    const lyrics: LyricLine[] = [];
    
    // Regular expression to match LRC time tags [mm:ss.xx]
    const timeRegex = /\[(\d{2,}):(\d{2})(?:\.(\d{1,3}))?\]/g;
    
    for (const line of lines) {
        const text = line.replace(timeRegex, '').trim();
        
        // Find all time tags in this line (sometimes multiple time tags share the same text)
        let match;
        const timeTags: number[] = [];
        
        while ((match = timeRegex.exec(line)) !== null) {
            const minutes = parseInt(match[1], 10);
            const seconds = parseInt(match[2], 10);
            const milliseconds = match[3] ? parseInt(match[3].padEnd(3, '0'), 10) : 0;
            
            const totalSeconds = (minutes * 60) + seconds + (milliseconds / 1000);
            timeTags.push(totalSeconds);
        }
        
        // If there are time tags and text is not empty (or even if it is, to clear screen)
        if (timeTags.length > 0) {
            for (const time of timeTags) {
                lyrics.push({ time, text });
            }
        }
    }
    
    // Sort by time just in case tags are out of order
    lyrics.sort((a, b) => a.time - b.time);
    
    return lyrics;
}
