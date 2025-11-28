
import React, { useRef, useEffect } from 'react';
import { VisualizerParticleEffect } from '../types';

interface ParticleOverlayProps {
    effect: VisualizerParticleEffect;
    count: number;
    speed: number;
    size: number;
}

interface Particle {
    x: number;
    y: number;
    speedX: number;
    speedY: number;
    size: number;
    rotation: number;
    rotationSpeed: number;
    opacity: number;
    typeData: any; // For Sakura petal variance
}

const ParticleOverlay: React.FC<ParticleOverlayProps> = ({ effect, count, speed, size }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const particlesRef = useRef<Particle[]>([]);
    const requestRef = useRef<number>();

    const initParticle = (width: number, height: number, type: VisualizerParticleEffect): Particle => {
        const baseSpeed = speed;
        const baseSize = size;
        
        let p: Particle = {
            x: Math.random() * width,
            y: Math.random() * height - height, // Start above
            speedX: 0,
            speedY: 0,
            size: 0,
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 2,
            opacity: Math.random() * 0.5 + 0.3,
            typeData: {}
        };

        if (type === VisualizerParticleEffect.Snow) {
            p.speedY = (Math.random() * 1 + 1) * baseSpeed;
            p.speedX = (Math.random() - 0.5) * baseSpeed * 0.5;
            p.size = (Math.random() * 2 + 1) * baseSize;
            p.y = Math.random() * height; // Distribute initially
        } else if (type === VisualizerParticleEffect.Rain) {
            p.speedY = (Math.random() * 5 + 10) * baseSpeed;
            p.speedX = (Math.random() * 0.5 - 0.25) * baseSpeed; // Slight angle
            p.size = (Math.random() * 10 + 10) * baseSize; // Length of rain drop
            p.opacity = Math.random() * 0.3 + 0.1;
            p.y = Math.random() * height;
        } else if (type === VisualizerParticleEffect.Sakura) {
            p.speedY = (Math.random() * 1 + 0.5) * baseSpeed;
            p.speedX = (Math.random() - 0.5) * baseSpeed * 1.5;
            p.size = (Math.random() * 5 + 5) * baseSize;
            p.rotationSpeed = (Math.random() - 0.5) * 3;
            p.y = Math.random() * height;
            // 0 = full pink, 1 = white-ish pink
            p.typeData = { colorVar: Math.random() > 0.7 ? 1 : 0 }; 
        }

        return p;
    };

    // Initialize particles array
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const width = canvas.width = window.innerWidth;
        const height = canvas.height = window.innerHeight;

        if (effect === VisualizerParticleEffect.None) {
            particlesRef.current = [];
            return;
        }

        const newParticles = [];
        for (let i = 0; i < count; i++) {
            newParticles.push(initParticle(width, height, effect));
        }
        particlesRef.current = newParticles;

    }, [effect, count]);

    const draw = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const width = canvas.width;
        const height = canvas.height;

        ctx.clearRect(0, 0, width, height);

        if (effect === VisualizerParticleEffect.None) return;

        particlesRef.current.forEach((p, index) => {
            // Update
            p.y += p.speedY;
            p.x += p.speedX;
            p.rotation += p.rotationSpeed;

            // Swaying logic for Snow and Sakura
            if (effect === VisualizerParticleEffect.Snow) {
                p.x += Math.sin(p.y * 0.01) * 0.2 * speed;
            } else if (effect === VisualizerParticleEffect.Sakura) {
                p.x += Math.sin(p.y * 0.02 + index) * 0.5 * speed;
                p.rotation += Math.cos(p.y * 0.01) * 1;
            }

            // Reset if out of bounds
            if (p.y > height + 20) {
                p.y = -20;
                p.x = Math.random() * width;
            }
            if (p.x > width + 20) p.x = -20;
            if (p.x < -20) p.x = width + 20;

            // Draw
            ctx.save();
            ctx.globalAlpha = p.opacity;

            if (effect === VisualizerParticleEffect.Snow) {
                ctx.beginPath();
                ctx.fillStyle = "#ffffff";
                // Radial gradient for soft snow
                const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
                grad.addColorStop(0, "rgba(255, 255, 255, 1)");
                grad.addColorStop(1, "rgba(255, 255, 255, 0)");
                ctx.fillStyle = grad;
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            } 
            else if (effect === VisualizerParticleEffect.Rain) {
                ctx.beginPath();
                ctx.strokeStyle = "rgba(173, 216, 230, 0.6)";
                ctx.lineWidth = 1.5;
                ctx.lineCap = "round";
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x + p.speedX * 2, p.y + p.size);
                ctx.stroke();
            } 
            else if (effect === VisualizerParticleEffect.Sakura) {
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rotation * Math.PI) / 180);
                
                // Draw petal shape
                ctx.beginPath();
                const color = p.typeData.colorVar === 0 ? "#ffb7c5" : "#ffe4e1"; // Pink vs MistyRose
                ctx.fillStyle = color;
                
                // Simple petal shape (oval with a pinch)
                ctx.moveTo(0, 0);
                ctx.bezierCurveTo(p.size/2, -p.size/2, p.size, -p.size/4, p.size, 0);
                ctx.bezierCurveTo(p.size, p.size/4, p.size/2, p.size/2, 0, 0);
                ctx.fill();
                
                // Add a little shading
                ctx.strokeStyle = "rgba(255, 105, 180, 0.4)";
                ctx.lineWidth = 1;
                ctx.stroke();

                ctx.restore();
            }

            ctx.restore();
        });

        requestRef.current = requestAnimationFrame(draw);
    };

    // Handle Resize
    useEffect(() => {
        const handleResize = () => {
            if (canvasRef.current) {
                canvasRef.current.width = window.innerWidth;
                canvasRef.current.height = window.innerHeight;
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Animation Loop
    useEffect(() => {
        requestRef.current = requestAnimationFrame(draw);
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [effect, count, speed, size]);

    return (
        <canvas 
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full pointer-events-none z-20" 
        />
    );
};

export default ParticleOverlay;
