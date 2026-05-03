import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface AuroraProps {
  intensity?: "low" | "medium" | "high";
  className?: string;
}

const INTENSITY_MAP = {
  low: { opacity: 0.25, scale: 1.0 },
  medium: { opacity: 0.40, scale: 1.1 },
  high: { opacity: 0.55, scale: 1.2 },
};

/**
 * Aurora — Constellation SCDP animated background.
 * Renders two animated gradient blobs that shift between --primary and
 * --secondary. In dark mode a subtle particle layer is also drawn on canvas.
 */
export function Aurora({ intensity = "medium", className }: AuroraProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const { opacity } = INTENSITY_MAP[intensity];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isDark = document.documentElement.classList.contains("dark");
    if (!isDark) return;

    const dpr = window.devicePixelRatio || 1;

    function resize() {
      if (!canvas) return;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      if (ctx) ctx.scale(dpr, dpr);
    }
    resize();

    const stars: { x: number; y: number; r: number; alpha: number; speed: number }[] = [];
    const N = 80;
    for (let i = 0; i < N; i++) {
      stars.push({
        x: Math.random() * canvas.offsetWidth,
        y: Math.random() * canvas.offsetHeight,
        r: Math.random() * 1.2 + 0.3,
        alpha: Math.random(),
        speed: Math.random() * 0.005 + 0.002,
      });
    }

    let t = 0;
    function draw() {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      t += 0.016;
      for (const s of stars) {
        s.alpha = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * s.speed * 40 + s.x));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(220, 200, 255, ${s.alpha * 0.7})`;
        ctx.fill();
      }
      rafRef.current = requestAnimationFrame(draw);
    }
    draw();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, []);

  return (
    <div
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      aria-hidden="true"
    >
      {/* Blob 1 — primary */}
      <div
        className="aurora-blob"
        style={{
          background: "radial-gradient(ellipse at center, hsl(var(--primary) / 1) 0%, transparent 70%)",
          opacity,
          top: "10%",
          left: "15%",
          width: "55%",
          height: "55%",
          animationDelay: "0s",
        }}
      />
      {/* Blob 2 — secondary */}
      <div
        className="aurora-blob"
        style={{
          background: "radial-gradient(ellipse at center, hsl(var(--secondary) / 1) 0%, transparent 70%)",
          opacity: opacity * 0.75,
          top: "35%",
          right: "5%",
          width: "48%",
          height: "48%",
          animationDelay: "-4s",
        }}
      />
      {/* Canvas — star particles (dark mode only) */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
}
