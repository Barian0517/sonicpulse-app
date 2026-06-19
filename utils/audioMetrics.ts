export interface AudioData {
  bass: number; mid: number; treble: number; energy: number;
  subBass: number; lowMid: number; highMid: number;
  presence: number; brilliance: number; air: number;
  warmth: number; brightness: number; sharpness: number;
  smoothness: number; density: number; spectralCentroid: number;
}

export type TriggerPreset = 'Auto Beat' | 'Advanced';

export class TriggerConfig {
  public enabled: boolean = false;
  public mode: TriggerPreset = 'Auto Beat';
  
  public freqIndex: number = -1;
  public threshold: number = 0.5;
  
  public sensitivity: number = 0.15;
  public cooldown: number = 60;
  public bandStart: number = 0;
  public bandEnd: number = 16;
  public pulseStrength: number = 0.2;

  public currentCooldown: number = 0;
  public beatHold: number = 0;
  public lastEvalEnergy: number = 0;
  public lastEvalThresh: number = 0;
  
  public fluxHistory: number[] = new Array(40).fill(0);
  public fluxHistoryIndex: number = 0;
  public smoothedFlux: number = 0;
  public prevSmoothedFlux: number = 0;

  constructor(public action: 'Pulse' | 'Meteor') {
      this.enabled = true;
      this.mode = 'Auto Beat';
      this.bandStart = 0;
      this.bandEnd = 16;
      if (action === 'Meteor') {
          this.bandStart = 159;
          this.bandEnd = 174;
          this.sensitivity = 0.45; 
          this.cooldown = 241; 
          this.pulseStrength = 0.50;
      }
  }

  public getTriggerRange(): [number, number] {
    if (this.mode === 'Auto Beat') return [this.bandStart, this.bandEnd];
    const c = this.freqIndex >= 0 ? this.freqIndex : Math.floor(0.2 * 512);
    return [Math.max(0, c - 2), Math.min(511, c + 2)];
  }
}

export class AudioMetricsAnalyzer {
  private prevData: number[] = new Array(512).fill(0);
  private prevBrightness: number = 0;

  private smoothedData: AudioData = {
    bass: 0, mid: 0, treble: 0, energy: 0,
    subBass: 0, lowMid: 0, highMid: 0, presence: 0, brilliance: 0, air: 0,
    warmth: 0, brightness: 0, sharpness: 0, smoothness: 0, density: 0, spectralCentroid: 0
  };

  public pulseTrigger = new TriggerConfig('Pulse');
  public meteorTrigger = new TriggerConfig('Meteor');
  
  public onFreqTrigger?: (strength: number, type: 'Kick' | 'Snare' | 'Advanced', action: 'Pulse' | 'Meteor') => void;

  private evaluateTrigger(config: TriggerConfig, fluxScore: number, isPlaying: boolean, binCount: number, dataArray: Float32Array) {
      if (!config.enabled || !isPlaying) return;
      
      let eVal = 0;
      let triggered = false;
      const [startBin, endBin] = config.getTriggerRange();

      if (config.mode === 'Advanced') {
          if (config.freqIndex >= 0 && config.freqIndex < binCount) {
             let sum = 0;
             let count = 0;
             for (let k = startBin; k <= endBin; k++) {
                sum += dataArray[k];
                count++;
             }
             eVal = sum / count;
             
             config.lastEvalThresh = config.threshold;
             if (config.currentCooldown <= 0 && eVal > config.threshold) {
                 triggered = true;
             }
          }
          config.lastEvalEnergy = eVal;
          if (triggered) {
              if (this.onFreqTrigger) this.onFreqTrigger(eVal, 'Advanced', config.action);
              config.currentCooldown = 60; // 1s
          }
      }

      if (config.currentCooldown > 0) config.currentCooldown--;

      if (config.mode === 'Auto Beat') {
         config.smoothedFlux += (fluxScore - config.smoothedFlux) * 0.4;
         config.fluxHistory[config.fluxHistoryIndex] = config.smoothedFlux;
         config.fluxHistoryIndex = (config.fluxHistoryIndex + 1) % config.fluxHistory.length;

         let avgFlux = 0, fluxVariance = 0;
         for (let i = 0; i < config.fluxHistory.length; i++) avgFlux += config.fluxHistory[i];
         avgFlux /= config.fluxHistory.length;

         for (let i = 0; i < config.fluxHistory.length; i++) {
             fluxVariance += Math.pow(config.fluxHistory[i] - avgFlux, 2);
         }
         fluxVariance /= config.fluxHistory.length;
         const fluxStdDev = Math.sqrt(fluxVariance);

         const thresholdMultiplier = Math.max(0.1, 5.0 - config.sensitivity * 4.0);
         const adaptiveThreshold = Math.max(0.05, avgFlux + fluxStdDev * thresholdMultiplier);

         const isPeak = config.prevSmoothedFlux > adaptiveThreshold && config.prevSmoothedFlux >= config.smoothedFlux;

         if (config.beatHold > 0) {
            config.beatHold--;
         } else if (isPeak && config.prevSmoothedFlux - config.smoothedFlux > 0.0001) {
            if (this.onFreqTrigger) this.onFreqTrigger(config.prevSmoothedFlux * 3.0 * config.pulseStrength, 'Kick', config.action);
            config.beatHold = config.cooldown;
         }

         config.lastEvalEnergy = config.smoothedFlux * 2.0;
         config.lastEvalThresh = adaptiveThreshold * 2.0;
         config.prevSmoothedFlux = config.smoothedFlux;
      }
  }

  public update(dataArray: Uint8Array, isPlaying: boolean): AudioData {
    let energySum = 0;
    let centroidNum = 0;
    let centroidDen = 0;

    let subBassSum = 0, bassSum = 0, lowMidSum = 0, midSum = 0;
    let highMidSum = 0, presenceSum = 0, brillianceSum = 0, airSum = 0;
    let jumpVolatilitySum = 0;
    let fluxScore = 0;

    const targetBinCount = 512;
    const binCount = dataArray.length;
    const scale = binCount / targetBinCount;

    const downsampled = new Float32Array(targetBinCount);
    for (let i = 0; i < targetBinCount; i++) {
        let maxVal = 0;
        const start = Math.floor(i * scale);
        const end = Math.floor((i + 1) * scale);
        const actualEnd = Math.max(start + 1, Math.min(end, binCount));
        for (let j = start; j < actualEnd; j++) {
            if (dataArray[j] > maxVal) {
                maxVal = dataArray[j];
            }
        }
        downsampled[i] = maxVal / 255.0;
    }

    if (isPlaying) {
      let fluxPulse = 0;
      let fluxMeteor = 0;

      for (let i = 0; i < targetBinCount; i++) {
          const val = downsampled[i];
          energySum += val;
          
          centroidNum += i * val;
          centroidDen += val;

          const prevVal = this.prevData[i] || 0;
          jumpVolatilitySum += Math.abs(val - prevVal);
          
          if (i >= this.pulseTrigger.bandStart && i <= this.pulseTrigger.bandEnd) {
             const diff = val - prevVal;
             if (diff > 0) fluxPulse += diff;
          }

          if (i >= this.meteorTrigger.bandStart && i <= this.meteorTrigger.bandEnd) {
             const diff = val - prevVal;
             if (diff > 0) fluxMeteor += diff;
          }

          this.prevData[i] = val;

          if (i <= 1) subBassSum += val;
          else if (i <= 3) bassSum += val;
          else if (i <= 7) lowMidSum += val;
          else if (i <= 18) midSum += val;
          else if (i <= 46) highMidSum += val;
          else if (i <= 93) presenceSum += val;
          else if (i <= 186) brillianceSum += val;
          else if (i <= 372) airSum += val;
      }
      
      this.evaluateTrigger(this.pulseTrigger, fluxPulse, isPlaying, targetBinCount, downsampled);
      this.evaluateTrigger(this.meteorTrigger, fluxMeteor, isPlaying, targetBinCount, downsampled);
    } else {
      for (let i = 0; i < targetBinCount; i++) {
          this.prevData[i] = 0;
      }
    }

    const energy = energySum / targetBinCount;
    
    const subBass = subBassSum / 2;
    const bass = bassSum / 2;
    const lowMid = lowMidSum / 4;
    const mid = midSum / 11;
    const highMid = highMidSum / 28;
    const presence = presenceSum / 47;
    const brilliance = brillianceSum / 93;
    const air = airSum / 186;

    const oldBass = (subBassSum + bassSum + lowMidSum) / 8;
    const oldMid = (midSum + highMidSum) / 39;
    const oldTreble = (presenceSum + brillianceSum + airSum) / 326;

    const warmth = energySum > 0 ? (subBassSum + bassSum + lowMidSum + midSum) / energySum : 0;
    const brightness = energySum > 0 ? (presenceSum + brillianceSum + airSum) / energySum : 0;
    
    const sharpness = Math.max(0, brightness - this.prevBrightness) * 10;
    this.prevBrightness = brightness;

    const smoothnessVal = Math.max(0, 1.0 - (jumpVolatilitySum / binCount) * 2.0);
    
    const activeThreshold = energy * 1.5;
    let activeBands = 0;
    if (subBass > activeThreshold) activeBands++;
    if (bass > activeThreshold) activeBands++;
    if (lowMid > activeThreshold) activeBands++;
    if (mid > activeThreshold) activeBands++;
    if (highMid > activeThreshold) activeBands++;
    if (presence > activeThreshold) activeBands++;
    if (brilliance > activeThreshold) activeBands++;
    if (air > activeThreshold) activeBands++;
    const density = activeBands / 8;

    const spectralCentroid = centroidDen > 0 ? centroidNum / centroidDen : 0;

    const hasIncomingAudio = isPlaying && energySum > 0;
    const dt = hasIncomingAudio ? 0.15 : 0.08; 
    
    
    this.smoothedData.bass += (oldBass - this.smoothedData.bass) * dt;
    this.smoothedData.mid += (oldMid - this.smoothedData.mid) * dt;
    this.smoothedData.treble += (oldTreble - this.smoothedData.treble) * dt;
    this.smoothedData.energy += (energy - this.smoothedData.energy) * dt;
    
    this.smoothedData.subBass += (subBass - this.smoothedData.subBass) * dt;
    this.smoothedData.lowMid += (lowMid - this.smoothedData.lowMid) * dt;
    this.smoothedData.highMid += (highMid - this.smoothedData.highMid) * dt;
    this.smoothedData.presence += (presence - this.smoothedData.presence) * dt;
    this.smoothedData.brilliance += (brilliance - this.smoothedData.brilliance) * dt;
    this.smoothedData.air += (air - this.smoothedData.air) * dt;
    
    this.smoothedData.warmth += (warmth - this.smoothedData.warmth) * dt;
    this.smoothedData.brightness += (brightness - this.smoothedData.brightness) * dt;
    this.smoothedData.sharpness += (sharpness - this.smoothedData.sharpness) * dt;
    this.smoothedData.smoothness += (smoothnessVal - this.smoothedData.smoothness) * dt;
    this.smoothedData.density += (density - this.smoothedData.density) * dt;
    this.smoothedData.spectralCentroid += (spectralCentroid - this.smoothedData.spectralCentroid) * dt;

    return { ...this.smoothedData };
  }
}
