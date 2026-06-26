export class BeatDetector {
    private analyser: AnalyserNode;
    private dataArray: Uint8Array;
    
    // Beat history for calculating energy threshold
    private energyHistory: number[] = [];
    private historySize = 43; // ~1 second at 60fps
    
    private beatTimer = 0;
    private readonly BEAT_COOLDOWN = 15; // Frames to wait before firing another beat
    
    // Configurable thresholds
    private sensitivity: number = 1.2; // Energy multiplier threshold for a beat
    private minEnergy: number = 20; // Minimum energy to be considered a beat
    
    public onBeat?: (impact: number) => void;
    public currentImpact: number = 0;

    constructor(analyser: AnalyserNode) {
        this.analyser = analyser;
        // We only need the lower frequencies for beat detection (bass/kick)
        // A smaller array is fine since we just average the lower bins.
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    }

    public setSensitivity(sensitivity: number) {
        // lower value = more sensitive. Typically 1.1 to 1.5
        this.sensitivity = sensitivity;
    }

    public update() {
        this.analyser.getByteFrequencyData(this.dataArray as any);
        
        // Calculate current energy in the low frequency bands (e.g., first 5% of bins)
        // Assumes 44.1kHz / 32768 fftSize = ~1.3Hz per bin.
        // We want roughly 20Hz - 150Hz for kicks.
        const startBin = Math.floor(20 / (this.analyser.context.sampleRate / this.analyser.fftSize));
        const endBin = Math.floor(150 / (this.analyser.context.sampleRate / this.analyser.fftSize));
        
        let currentEnergy = 0;
        let validBins = 0;
        
        // Ensure we have valid bin range
        const safeStart = Math.max(0, startBin);
        const safeEnd = Math.min(this.dataArray.length, Math.max(10, endBin));

        for (let i = safeStart; i < safeEnd; i++) {
            currentEnergy += this.dataArray[i];
            validBins++;
        }
        
        if (validBins > 0) {
            currentEnergy /= validBins; // Average energy
        }

        // Calculate average local energy
        let localAverageEnergy = 0;
        if (this.energyHistory.length > 0) {
            localAverageEnergy = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length;
        }

        // Beat detection logic
        if (currentEnergy > this.minEnergy && currentEnergy > localAverageEnergy * this.sensitivity) {
            if (this.beatTimer <= 0) {
                // Detected a beat!
                const impact = currentEnergy / 255; // 0.0 to 1.0
                this.currentImpact = impact;
                if (this.onBeat) {
                    this.onBeat(impact);
                }
                this.beatTimer = this.BEAT_COOLDOWN;
            }
        }

        // Update history
        this.energyHistory.push(currentEnergy);
        if (this.energyHistory.length > this.historySize) {
            this.energyHistory.shift();
        }

        if (this.beatTimer > 0) {
            this.beatTimer--;
        }
        
        // Decay current impact
        this.currentImpact = Math.max(0, this.currentImpact - 0.05);
    }
}
