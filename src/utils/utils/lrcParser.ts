export interface LyricLine {
    time: number; // in seconds
    text: string;
}

export function parseLRC(lrcText: string): LyricLine[] {
    const lines = lrcText.split('\n');
    const result: LyricLine[] = [];

    // Regex to match time tags [mm:ss.xx]
    const timeRegex = /\[(\d{2,}):(\d{2})(?:\.(\d{2,3}))?\]/g;

    for (const line of lines) {
        let match;
        const times: number[] = [];
        
        // Extract all time tags in the line (a line might have multiple tags for repeated lyrics)
        while ((match = timeRegex.exec(line)) !== null) {
            const minutes = parseInt(match[1], 10);
            const seconds = parseInt(match[2], 10);
            const milliseconds = match[3] ? parseInt(match[3], 10) : 0;
            // Handle 2 or 3 digit milliseconds
            const msMultiplier = match[3] && match[3].length === 3 ? 1 : 10;
            
            const totalSeconds = (minutes * 60) + seconds + (milliseconds * msMultiplier / 1000);
            times.push(totalSeconds);
        }

        if (times.length > 0) {
            // Remove all time tags to get the actual text
            const text = line.replace(/\[\d{2,}:\d{2}(?:\.\d{2,3})?\]/g, '').trim();
            if (text) {
                for (const time of times) {
                    result.push({ time, text });
                }
            }
        }
    }

    // Sort by time
    result.sort((a, b) => a.time - b.time);
    return result;
}
