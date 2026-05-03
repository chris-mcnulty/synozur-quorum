import { useEffect, useRef, useState } from "react";

interface Section {
  key: string;
  label: string;
  offsetMs: number;
}

interface Props {
  audioUrl: string;
  durationSeconds: number;
  sections: Section[];
  voicesUsed: string[];
  bytes: number;
  onDelete?: () => void;
}

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// Stable pseudo-random pattern for the synthetic waveform.
function buildWave(buckets: number, seed: number): number[] {
  const out: number[] = [];
  let s = seed || 1;
  for (let i = 0; i < buckets; i += 1) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const r = s / 0x7fffffff;
    // shape: gentle bell with random jitter
    const t = i / buckets;
    const bell = Math.sin(t * Math.PI);
    const v = 0.18 + bell * 0.55 + r * 0.4;
    out.push(Math.max(0.05, Math.min(1, v)));
  }
  return out;
}

export function AudioPlayer({
  audioUrl,
  durationSeconds,
  sections,
  voicesUsed,
  bytes,
  onDelete,
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(durationSeconds);

  const buckets = 80;
  const wave = useRef<number[]>(buildWave(buckets, bytes || 17)).current;

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setCurrent(a.currentTime);
    const onLoaded = () => setDuration(a.duration || durationSeconds);
    const onEnded = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onLoaded);
    a.addEventListener("ended", onEnded);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onLoaded);
      a.removeEventListener("ended", onEnded);
    };
  }, [durationSeconds]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play();
      setPlaying(true);
    } else {
      a.pause();
      setPlaying(false);
    }
  };

  const seek = (sec: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(0, Math.min(sec, duration));
    setCurrent(a.currentTime);
  };

  const seekToFraction = (f: number) => seek(duration * f);

  const handleScrubberClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const f = (e.clientX - rect.left) / rect.width;
    seekToFraction(Math.max(0, Math.min(1, f)));
  };

  const progressFrac = duration > 0 ? current / duration : 0;

  return (
    <div
      className="border boa-rule rounded-sm p-5"
      style={{ background: "rgba(245,241,234,0.5)" }}
    >
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      <div className="flex items-center gap-4">
        <button
          onClick={toggle}
          className="w-11 h-11 rounded-full flex items-center justify-center transition-colors"
          style={{
            background: "var(--boa-ink)",
            color: "var(--boa-paper)",
          }}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? (
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" />
              <rect x="14" y="5" width="4" height="14" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <div className="flex-1 min-w-0">
          {/* Waveform scrubber */}
          <div
            onClick={handleScrubberClick}
            className="relative h-12 cursor-pointer"
            role="slider"
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={current}
            tabIndex={0}
          >
            <div className="absolute inset-0 flex items-end justify-between gap-[1px]">
              {wave.map((h, i) => {
                const f = (i + 0.5) / buckets;
                const past = f <= progressFrac;
                return (
                  <div
                    key={i}
                    className="flex-1"
                    style={{
                      height: `${h * 100}%`,
                      background: past
                        ? "var(--boa-brass)"
                        : "var(--boa-paper-3)",
                      transition: "background 0.15s",
                    }}
                  />
                );
              })}
            </div>
            {/* Section markers */}
            {sections.map((s, i) => {
              const totalMs = duration * 1000;
              if (totalMs <= 0) return null;
              const f = Math.max(0, Math.min(1, s.offsetMs / totalMs));
              return (
                <div
                  key={`${s.key}-${i}`}
                  className="absolute top-0 bottom-0 w-[2px] pointer-events-none"
                  style={{
                    left: `${f * 100}%`,
                    background: "var(--boa-aubergine, #4a2545)",
                    opacity: 0.5,
                  }}
                />
              );
            })}
          </div>

          <div
            className="flex justify-between mt-2 boa-mono text-[10px] uppercase tracking-[0.15em]"
            style={{ color: "var(--boa-ink-3)" }}
          >
            <span>{formatTime(current)}</span>
            <span>
              {voicesUsed.join(" · ")} · {(bytes / 1024 / 1024).toFixed(1)} MB
            </span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      {/* Section jump pills */}
      {sections.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {sections.map((s, i) => (
            <button
              key={`pill-${s.key}-${i}`}
              onClick={() => seek(s.offsetMs / 1000)}
              className="boa-mono text-[10px] uppercase tracking-[0.15em] px-2.5 py-1.5 border rounded-sm hover:bg-[color:var(--boa-paper-2)] transition-colors"
              style={{ borderColor: "var(--boa-paper-3)", color: "var(--boa-ink-2)" }}
            >
              <span style={{ color: "var(--boa-brass)" }}>↳</span>&nbsp;{s.label}
              <span className="ml-1.5" style={{ color: "var(--boa-ink-3)" }}>
                {formatTime(s.offsetMs / 1000)}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between flex-wrap gap-3">
        <div
          className="boa-mono text-[10px] uppercase tracking-[0.18em]"
          style={{ color: "var(--boa-ink-3)" }}
        >
          {voicesUsed.length} voices · {sections.length} sections
        </div>
        <div className="flex items-center gap-2">
          <a
            href={audioUrl}
            download
            className="boa-mono text-[10px] uppercase tracking-[0.18em] px-2.5 py-1.5 border rounded-sm hover:bg-[color:var(--boa-paper-2)] transition-colors"
            style={{ borderColor: "var(--boa-paper-3)", color: "var(--boa-ink-2)" }}
          >
            Download MP3
          </a>
          {onDelete && (
            <button
              onClick={onDelete}
              className="boa-mono text-[10px] uppercase tracking-[0.18em] px-2.5 py-1.5 border rounded-sm hover:bg-[color:var(--boa-paper-2)] transition-colors"
              style={{ borderColor: "var(--boa-paper-3)", color: "var(--boa-vote-no)" }}
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
