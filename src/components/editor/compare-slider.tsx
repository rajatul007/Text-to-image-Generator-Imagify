"use client";

import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

/**
 * Before/after comparison. Drag the handle (mouse/touch/pen) or use ←/→ keys when it is focused.
 * Both images are drawn in the same box so they line up even when the edited image has a different resolution.
 */
export function CompareSlider({ before, after, beforeLabel = "Before", afterLabel = "After", aspect }: { before: string; after: string; beforeLabel?: string; afterLabel?: string; aspect: number }) {
  const [pos, setPos] = useState(50);
  const [full, setFull] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const update = useCallback((clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    setPos(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)));
  }, []);

  const onDown = (e: PointerEvent) => {
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    update(e.clientX);
  };
  const onMove = (e: PointerEvent) => dragging.current && update(e.clientX);
  const onUp = () => (dragging.current = false);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") setPos((p) => Math.max(0, p - (e.shiftKey ? 10 : 2)));
    else if (e.key === "ArrowRight") setPos((p) => Math.min(100, p + (e.shiftKey ? 10 : 2)));
    else if (e.key === "Home") setPos(0);
    else if (e.key === "End") setPos(100);
    else return;
    e.preventDefault();
  };

  const toggleFull = async () => {
    try {
      if (!document.fullscreenElement) {
        await wrap.current?.requestFullscreen();
        setFull(true);
      } else {
        await document.exitFullscreen();
        setFull(false);
      }
    } catch {
      setFull((f) => !f); // Fallback: CSS overlay when the Fullscreen API is unavailable (e.g. iOS Safari)
    }
  };

  return (
    <div ref={wrap} className={full ? "fixed inset-0 z-[70] grid place-items-center bg-black p-4" : "relative"} onKeyDown={(e) => e.key === "Escape" && full && setFull(false)}>
      <div
        ref={box}
        className="relative w-full touch-none select-none overflow-hidden rounded-xl border border-line bg-[conic-gradient(var(--panel-2)_25%,var(--panel)_0_50%,var(--panel-2)_0_75%,var(--panel)_0)] bg-[length:20px_20px]"
        style={{ aspectRatio: String(aspect), maxHeight: full ? "calc(100dvh - 2rem)" : "70vh", maxWidth: full ? `calc((100dvh - 2rem) * ${aspect})` : undefined }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={after} alt={afterLabel} draggable={false} className="absolute inset-0 h-full w-full object-contain" />
        <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={before} alt={beforeLabel} draggable={false} className="absolute inset-0 h-full w-full object-contain" />
        </div>
        <span className="glass pointer-events-none absolute left-3 top-3 rounded-md px-2 py-0.5 text-xs">{beforeLabel}</span>
        <span className="glass pointer-events-none absolute right-3 top-3 rounded-md px-2 py-0.5 text-xs">{afterLabel}</span>
        <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white/90 shadow-[0_0_12px_rgba(0,0,0,0.5)]" style={{ left: `${pos}%` }} />
        <button
          type="button"
          role="slider"
          aria-label="Comparison position"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pos)}
          aria-valuetext={`${Math.round(pos)}% before`}
          onKeyDown={onKey}
          className="absolute top-1/2 grid size-10 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize place-items-center rounded-full border-2 border-white bg-black/50 text-white backdrop-blur"
          style={{ left: `${pos}%` }}
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="m9 6-6 6 6 6M15 6l6 6-6 6" />
          </svg>
        </button>
        <button type="button" onClick={toggleFull} onPointerDown={(e) => e.stopPropagation()} className="glass absolute bottom-3 right-3 grid size-9 place-items-center rounded-lg" aria-label={full ? "Exit full screen" : "Full screen"}>
          {full ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </button>
      </div>
    </div>
  );
}
