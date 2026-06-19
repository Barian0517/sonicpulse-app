
import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { VisualizerConfig, VisualizerShape, VisualizerDirection, VisualizerStyle, SymmetryMode, VisualizerMaterial } from '../types';
import { ThreeVisualizer } from './ThreeGrid/ThreeVisualizer';

interface VisualizerProps {
  analyser: AnalyserNode | null;
  config: VisualizerConfig;
  isOverlay?: boolean;
}

// Helper to parse hex color to RGB
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 255, g: 255, b: 255 };
};

const Visualizer = forwardRef<HTMLCanvasElement, VisualizerProps>(({ analyser, config, isOverlay = false }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const bgImageRef = useRef<HTMLImageElement>(new Image());
  const channelRef = useRef<BroadcastChannel | null>(null);
  
  // Overlay state
  const overlayDataRef = useRef<{data: number[], bassAvg: number} | null>(null);
  const overlayConfigRef = useRef<VisualizerConfig>(config);

  useEffect(() => {
    channelRef.current = new BroadcastChannel('sonicpulse_sync');
    if (isOverlay) {
       channelRef.current.onmessage = (e) => {
           if (e.data.type === 'sync') {
               overlayDataRef.current = { data: e.data.data, bassAvg: e.data.bassAvg };
               overlayConfigRef.current = e.data.config;
           }
       };
    }
    return () => {
       channelRef.current?.close();
    };
  }, [isOverlay]);
  
  // Expose canvas ref and custom draw method to parent
  useImperativeHandle(ref, () => Object.assign(canvasRef.current!, {
      drawFrame: (data: Uint8Array) => {
          const canvas = canvasRef.current;
          if (!canvas) return;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          
          // Use temporary data array for the passed frame data
          // We need to process it through getProcessedData logic
          const width = canvas.width;
          const height = canvas.height;
          ctx.clearRect(0, 0, width, height);

          // Draw BG
          // Note: In offline render, we don't have bassAvg easily calculated unless we do it here
          // Calc Bass
          let bassAvg = 0;
          if (data.length > 0) {
              const bassSum = data.slice(0, Math.floor(data.length * 0.1)).reduce((a, b) => a + b, 0);
              bassAvg = bassSum / (Math.floor(data.length * 0.1) || 1);
          }
          drawBackground(ctx, width, height, bassAvg);

          const processedData = getProcessedData(data, config.barCount, config.symmetry, 1); // Use Average mix for export
          drawVisualizerContent(ctx, width, height, processedData);
      }
  }));
  
  // Refs for smoothing calculations
  const prevBgShakeRef = useRef<number>(0);

  // Update Background Image
  useEffect(() => {
      if (config.backgroundImage) {
          bgImageRef.current.src = config.backgroundImage;
          // Add error handling for broken data URLs
          bgImageRef.current.onerror = () => {
              console.warn("Background image failed to load, clearing source.");
              bgImageRef.current.src = "";
          };
      }
  }, [config.backgroundImage]);

  // Helper to map frequency data based on symmetry settings
  const getProcessedData = (rawBuffer: Uint8Array, count: number, symmetry: SymmetryMode, sampleMix: number): number[] => {
    const rawData = [];
    const bufferLength = rawBuffer.length;
    
    // Resize/Resample raw buffer to target count
    for (let i = 0; i < count; i++) {
        // Map output index 'i' to input buffer index
        const position = (i / count) * bufferLength;
        const index = Math.floor(position);
        
        if (count < bufferLength) {
             // Downsampling
             const bucketSize = Math.max(1, Math.floor(bufferLength / count));
             let sum = 0;
             let peak = 0;
             
             for (let j = 0; j < bucketSize; j++) {
                 if (index + j < bufferLength) {
                    const val = rawBuffer[index + j];
                    sum += val;
                    if (val > peak) peak = val;
                 }
             }
             
             const avg = sum / bucketSize;
             rawData.push(avg * sampleMix + peak * (1 - sampleMix));
        } else {
             // Upsampling
             rawData.push(rawBuffer[index] || 0);
        }
    }

    // Apply Symmetry to the RESIZED data
    if (symmetry === SymmetryMode.RightToLeft) {
      return rawData.reverse();
    } else if (symmetry === SymmetryMode.CenterOut) {
      const half = Math.floor(count / 2);
      const leftSide = rawData.slice(0, half).reverse();
      const rightSide = rawData.slice(0, half); 
      return [...leftSide, ...rightSide];
    }
    
    return rawData;
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle resize
    if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    const width = canvas.width;
    const height = canvas.height;

    // Clear
    ctx.clearRect(0, 0, width, height);

    if (isOverlay) {
        // Overlay Mode rendering
        const currentConfig = overlayConfigRef.current || config;
        const currentData = overlayDataRef.current;
        
        if (currentConfig.backgroundImage && bgImageRef.current.complete && bgImageRef.current.src) {
            drawBackground(ctx, width, height, currentData?.bassAvg || 0);
        }
        
        if (currentData && currentData.data) {
            drawVisualizerContent(ctx, width, height, currentData.data, currentData.bassAvg);
        }
        
        requestRef.current = requestAnimationFrame(draw);
        return;
    }

    if (!analyser) {
        if (config.backgroundImage && bgImageRef.current.complete && bgImageRef.current.src) {
            drawBackground(ctx, width, height, 0);
        }
        return;
    }

    if (!dataArrayRef.current || dataArrayRef.current.length !== analyser.frequencyBinCount) {
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
    }

    const dataArray = dataArrayRef.current;
    if (!dataArray) return;

    let effectiveTimeConstant = 0;
    let sampleMix = 1;

    if (config.smoothing > 0.5) {
        effectiveTimeConstant = (config.smoothing - 0.5) / 0.49 * 0.99;
        if (effectiveTimeConstant > 0.99) effectiveTimeConstant = 0.99;
        sampleMix = 1;
    } else {
        effectiveTimeConstant = 0;
        sampleMix = config.smoothing * 2;
    }

    if (config.shape === VisualizerShape.Grid3D) {
        analyser.smoothingTimeConstant = 0.8;
    } else {
        analyser.smoothingTimeConstant = effectiveTimeConstant;
    }
    analyser.getByteFrequencyData(dataArray);

    const data = getProcessedData(dataArray, config.barCount, config.symmetry, sampleMix);

    // Calculate Bass for Shake Effect
    const bassSum = data.slice(0, Math.floor(data.length * 0.1)).reduce((a, b) => a + b, 0);
    const bassAvg = bassSum / (Math.floor(data.length * 0.1) || 1);
    
    // Draw Background
    drawBackground(ctx, width, height, bassAvg);

    drawVisualizerContent(ctx, width, height, data, bassAvg);

    // Broadcast to overlay
    if (!isOverlay && channelRef.current) {
        channelRef.current.postMessage({
            type: 'sync',
            data: data,
            bassAvg: bassAvg,
            config: config
        });
    }

    requestRef.current = requestAnimationFrame(draw);
  };

  const drawVisualizerContent = (ctx: CanvasRenderingContext2D, width: number, height: number, data: number[], bassAvg?: number) => {
    // Apply Shake to Visualizer
    let offsetX = 0;
    let offsetY = 0;
    if (bassAvg !== undefined && config.shakeFactor > 0 && bassAvg > 100) {
        const shakeIntensity = ((bassAvg - 100) / 155) * config.shakeFactor;
        offsetX = (Math.random() - 0.5) * shakeIntensity;
        offsetY = (Math.random() - 0.5) * shakeIntensity;
    }

    const cx = (width * (config.centerX / 100)) + offsetX;
    const cy = (height * (config.centerY / 100)) + offsetY;

    const startRgb = hexToRgb(config.colorStart);
    const endRgb = config.colorMode === 'dual' ? hexToRgb(config.colorEnd) : startRgb;

    // Global Gradient
    let globalGradient: CanvasGradient | string;
    if (config.colorMode === 'dual') {
        globalGradient = ctx.createLinearGradient(0, height, width, 0);
        globalGradient.addColorStop(0, config.colorStart);
        globalGradient.addColorStop(1, config.colorEnd);
    } else {
        globalGradient = config.colorStart;
    }
    
    ctx.fillStyle = globalGradient;
    ctx.strokeStyle = globalGradient;

    // Reset Shadow
    ctx.shadowBlur = 0;
    
    // Material Setup for Neon
    if (config.material === VisualizerMaterial.Neon) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = config.colorStart;
    }

    // SPHERE (3D) RENDERING
    if (config.shape === VisualizerShape.Sphere) {
        drawSphere(ctx, data, cx, cy, startRgb, endRgb);
        return; 
    }

    // GRID (3D) RENDERING
    if (config.shape === VisualizerShape.Grid3D) {
        return; 
    }

    // CIRCLE & LINE (2D) RENDERING
    const angleStep = (Math.PI * 2) / data.length;
    const startRad = (config.startAngle * Math.PI) / 180;

    data.forEach((value, index) => {
      const amplitude = (value / 255) * (Math.min(width, height) / 3) * config.barLengthScale;
      
      if (amplitude < 1) return;

      let x1 = 0, y1 = 0, x2 = 0, y2 = 0;

      if (config.shape === VisualizerShape.Circle) {
        const angle = startRad + (index * angleStep);
        let startR = config.radius;
        let endR = config.radius;

        if (config.direction === VisualizerDirection.OutUp) {
            endR += amplitude;
        } else if (config.direction === VisualizerDirection.InDown) {
            endR -= amplitude;
        } else {
            startR -= amplitude / 2;
            endR += amplitude / 2;
        }

        x1 = cx + Math.cos(angle) * startR;
        y1 = cy + Math.sin(angle) * startR;
        x2 = cx + Math.cos(angle) * endR;
        y2 = cy + Math.sin(angle) * endR;

      } else {
        // LINEAR
        const totalW = (config.barWidth + config.linearGap) * data.length;
        const startX = cx - (totalW / 2);
        const x = startX + (index * (config.barWidth + config.linearGap));
        const baseX = x;
        const baseY = cy;
        
        let yStart = baseY;
        let yEnd = baseY;

        if (config.direction === VisualizerDirection.OutUp) {
             yEnd = baseY - amplitude;
        } else if (config.direction === VisualizerDirection.InDown) {
             yEnd = baseY + amplitude;
        } else {
             yStart = baseY - amplitude / 2;
             yEnd = baseY + amplitude / 2;
        }
        
        x1 = baseX;
        y1 = yStart;
        x2 = baseX;
        y2 = yEnd;
      }

      ctx.lineWidth = config.barWidth;
      ctx.lineCap = 'round';

      // Drawing based on Material and Style
      if (config.style === VisualizerStyle.Line || config.style === VisualizerStyle.Both) {
          if (config.material === VisualizerMaterial.LED) {
              // LED / Segmented Effect
              drawSegmentedLine(ctx, x1, y1, x2, y2, config.barWidth, globalGradient);
          } else {
              // Standard or Neon (Neon handled by shadowBlur context state)
              ctx.beginPath();
              ctx.moveTo(x1, y1);
              ctx.lineTo(x2, y2);
              ctx.stroke();
          }
      }

      if (config.style === VisualizerStyle.Dot || config.style === VisualizerStyle.Both) {
          const dotX = config.direction === VisualizerDirection.InDown ? x1 : x2;
          const dotY = config.direction === VisualizerDirection.InDown ? y1 : y2;
          
          ctx.fillStyle = globalGradient;
          
          if (config.shape === VisualizerShape.Line && config.direction === VisualizerDirection.Both) {
              // Draw 2 dots for both direction linear
              drawDot(ctx, x1, y1, config.barWidth);
              drawDot(ctx, x2, y2, config.barWidth);
          } else {
              drawDot(ctx, dotX, dotY, config.barWidth);
          }
      }
    });
  };

  const drawDot = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number) => {
      ctx.beginPath();
      // If LED material, make dots square for digital look
      if (config.material === VisualizerMaterial.LED) {
          ctx.fillRect(x - width/2, y - width/2, width, width);
      } else {
          ctx.arc(x, y, width / 2 + 1, 0, Math.PI * 2);
          ctx.fill();
      }
  };

  const drawSegmentedLine = (ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, width: number, fillStyle: any) => {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      const segmentHeight = width; // Square blocks
      const gap = 2; // Gap between blocks
      const step = segmentHeight + gap;
      
      const count = Math.floor(dist / step);
      
      // Normalized vector
      const nx = dx / dist;
      const ny = dy / dist;

      ctx.fillStyle = fillStyle;

      for (let i = 0; i < count; i++) {
          const px = x1 + nx * (i * step);
          const py = y1 + ny * (i * step);
          
          // Draw Rect centered at px, py rotated to alignment?
          // For simplicity in Circular, just fillRect works if width is small, but for perfection we need to rotate context.
          // Or just draw circle for round LED look? Let's do blocks.
          
          // Since we are iterating along a line, just filling a small rect at px,py is "aligned" if the line is vertical.
          // If the line is angled (Circle), we need a bit of rotation or use arcs.
          // Using arcs (circles) is easier for "LED" look in circle arrangement without rotation math overhead.
          // Let's stick to square blocks for Linear, Circles for Radial to save perf.
          
          if (config.shape === VisualizerShape.Line) {
             ctx.fillRect(px - width/2, py - width/2, width, width);
          } else {
             // For circular arrangement, "segments" look better as small circles usually, or we must rotate.
             // Let's try drawing small circles, it looks like an LED strip.
             ctx.beginPath();
             ctx.arc(px, py, width/2, 0, Math.PI * 2);
             ctx.fill();
          }
      }
  };

  const drawSphere = (ctx: CanvasRenderingContext2D, data: number[], cx: number, cy: number, startRgb: any, endRgb: any) => {
        const count = data.length;
        const time = performance.now() * 0.0005;
        const rotY = time;
        const rotX = time * 0.5;
        const offset = 2 / count;
        const increment = Math.PI * (3 - Math.sqrt(5));
        const points = [];

        for (let i = 0; i < count; i++) {
            const y_pos = ((i * offset) - 1) + (offset / 2);
            const r_pos = Math.sqrt(1 - Math.pow(y_pos, 2));
            const phi = ((i + 1) % count) * increment;

            let x = Math.cos(phi) * r_pos;
            let z = Math.sin(phi) * r_pos;
            let y = y_pos;

            const value = data[i];
            const amplitude = (value / 255);
            const r = config.radius + (amplitude * config.barLengthScale * 60);

            x *= r;
            y *= r;
            z *= r;

            let x1 = x * Math.cos(rotY) - z * Math.sin(rotY);
            let z1 = x * Math.sin(rotY) + z * Math.cos(rotY);
            let y1 = y;

            let y2 = y1 * Math.cos(rotX) - z1 * Math.sin(rotX);
            let z2 = y1 * Math.sin(rotX) + z1 * Math.cos(rotX);
            let x2 = x1;

            const fov = 400 + config.radius;
            const scale = fov / (fov - z2);

            const x2d = cx + x2 * scale;
            const y2d = cy + y2 * scale;

            let rCol = startRgb.r, gCol = startRgb.g, bCol = startRgb.b;
            if (config.colorMode === 'dual') {
                const t = i / count;
                rCol = Math.round(startRgb.r + t * (endRgb.r - startRgb.r));
                gCol = Math.round(startRgb.g + t * (endRgb.g - startRgb.g));
                bCol = Math.round(startRgb.b + t * (endRgb.b - startRgb.b));
            }

            points.push({ x: x2d, y: y2d, z: z2, scale, r: rCol, g: gCol, b: bCol, val: value });
        }

        points.sort((a, b) => a.z - b.z);

        points.forEach(p => {
            const size = Math.max(0.5, (config.barWidth * 0.8) * p.scale + (p.val / 255 * 2));
            drawParticle3D(ctx, p.x, p.y, size, p.r, p.g, p.b);
        });
  };



  const drawParticle3D = (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, r: number, g: number, b: number) => {
        if (radius <= 0.1 || !isFinite(x) || !isFinite(y)) return;
        
        if (config.material === VisualizerMaterial.Neon) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = `rgb(${r}, ${g}, ${b})`;
            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            return;
        }

        if (config.material === VisualizerMaterial.LED) {
            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            ctx.fillRect(x - radius, y - radius, radius*2, radius*2);
            return;
        }

        // Standard 3D Sphere Look
        if (config.barCount > 1500 && radius < 4) {
             ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
             ctx.beginPath();
             ctx.arc(x, y, radius, 0, Math.PI * 2);
             ctx.fill();
             return;
        }
        
        const grad = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, 0, x, y, radius);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        grad.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, 1)`);
        grad.addColorStop(1, `rgba(${Math.floor(r * 0.1)}, ${Math.floor(g * 0.1)}, ${Math.floor(b * 0.1)}, 1)`);

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
  };

  const drawBackground = (ctx: CanvasRenderingContext2D, width: number, height: number, bassAvg: number) => {
     if (!config.backgroundImage || !bgImageRef.current.complete || !bgImageRef.current.src) return;

     ctx.save();
     
     const time = performance.now() * 0.001;
     let floatX = 0;
     let floatY = 0;
     if (config.bgFloatSpeed > 0) {
         floatX = Math.sin(time * config.bgFloatSpeed) * 20;
         floatY = Math.cos(time * (config.bgFloatSpeed * 0.8)) * 15;
     }

     let shakeScale = 0;
     const shakeThreshold = 20; 

     if (config.bgShakeIntensity > 0 && bassAvg > shakeThreshold) {
         const normalizedBass = Math.max(0, (bassAvg - shakeThreshold) / (255 - shakeThreshold));
         const bassForce = Math.pow(normalizedBass, 2);
         const targetShake = bassForce * (config.bgShakeIntensity / 100) * 0.5;
         
         const attack = 0.2;
         const decay = config.bgShakeSmoothing || 0.5; 

         if (targetShake > prevBgShakeRef.current) {
             prevBgShakeRef.current = prevBgShakeRef.current * (1 - attack) + targetShake * attack;
         } else {
             prevBgShakeRef.current = prevBgShakeRef.current * decay + targetShake * (1 - decay);
         }
         
         shakeScale = prevBgShakeRef.current;
     } else {
         const decay = config.bgShakeSmoothing || 0.5;
         prevBgShakeRef.current = prevBgShakeRef.current * decay;
         shakeScale = prevBgShakeRef.current;
     }

     const currentScale = config.bgScale + shakeScale;
     const centerX = width * (config.bgPositionX / 100);
     const centerY = height * (config.bgPositionY / 100);
     
     ctx.translate(centerX + floatX, centerY + floatY);
     if (config.bgRotation !== 0) {
         ctx.rotate((config.bgRotation * Math.PI) / 180);
     }
     ctx.scale(currentScale, currentScale);

     const img = bgImageRef.current;
     
     // Robustness check for zero-size image
     if (img.width === 0 || img.height === 0) {
         ctx.restore();
         return;
     }

     let drawW = width;
     let drawH = width * (img.height / img.width);
     if (drawH < height) {
         drawH = height;
         drawW = height * (img.width / img.height);
     }

     ctx.drawImage(img, -drawW/2, -drawH/2, drawW, drawH);
     
     ctx.restore();

     if (config.bgVignette > 0) {
         ctx.globalCompositeOperation = 'source-over'; 
         const gradient = ctx.createRadialGradient(width/2, height/2, width * 0.3, width/2, height/2, width * 0.9);
         const intensity = config.bgVignette / 100;
         gradient.addColorStop(0, `rgba(0,0,0,0)`);
         gradient.addColorStop(1, `rgba(0,0,0,${intensity})`);
         
         ctx.fillStyle = gradient;
         ctx.fillRect(0, 0, width, height);
     }
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(draw);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [analyser, config]);

  return (
    <>
      <canvas 
        ref={canvasRef} 
        className="absolute top-0 left-0 w-full h-full pointer-events-none z-10"
      />
      {config.shape === VisualizerShape.Grid3D && (
        <div className="absolute top-0 left-0 w-full h-full z-10">
           <ThreeVisualizer analyser={analyser} config={config} />
        </div>
      )}
    </>
  );
});

Visualizer.displayName = 'Visualizer';

export default Visualizer;
