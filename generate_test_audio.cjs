const fs = require('fs');

const sampleRate = 44100;
const durationSeconds = 12;
const numSamples = sampleRate * durationSeconds;
const numChannels = 1;
const bytesPerSample = 2; // 16-bit

const buffer = Buffer.alloc(44 + numSamples * bytesPerSample);

// Write WAV header
buffer.write('RIFF', 0);
buffer.writeUInt32LE(36 + numSamples * bytesPerSample, 4);
buffer.write('WAVE', 8);
buffer.write('fmt ', 12);
buffer.writeUInt32LE(16, 16); // Subchunk1Size
buffer.writeUInt16LE(1, 20); // AudioFormat (PCM)
buffer.writeUInt16LE(numChannels, 22);
buffer.writeUInt32LE(sampleRate, 24);
buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28); // ByteRate
buffer.writeUInt16LE(numChannels * bytesPerSample, 32); // BlockAlign
buffer.writeUInt16LE(bytesPerSample * 8, 34); // BitsPerSample
buffer.write('data', 36);
buffer.writeUInt32LE(numSamples * bytesPerSample, 40);

// Write audio data
const frequency = 50; // 50 Hz Deep Bass
let offset = 44;
for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    
    // Pulse every 2 seconds for 0.2 seconds
    const isPulse = (t % 2.0) < 0.2;
    
    let sample = 0;
    if (isPulse) {
        // Sine wave with envelope to avoid harsh clicking sounds (pop)
        const pulseT = t % 2.0;
        let envelope = 1.0;
        if (pulseT < 0.05) envelope = pulseT / 0.05; // Fade in
        else if (pulseT > 0.15) envelope = (0.2 - pulseT) / 0.05; // Fade out
        
        sample = Math.sin(2 * Math.PI * frequency * t) * 0.9 * envelope;
    }
    
    // Convert float to 16-bit PCM integer
    const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
    buffer.writeInt16LE(intSample, offset);
    offset += 2;
}

fs.writeFileSync('test_bass.wav', buffer);
console.log('test_bass.wav generated successfully.');
