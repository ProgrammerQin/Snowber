"use client";

/* eslint-disable @next/next/no-img-element -- photos come from short-lived signed URLs */
import { useState } from "react";

export function BeforeAfterSlider({ beforeUrl, afterUrl }: { beforeUrl: string; afterUrl: string }) {
  const [position, setPosition] = useState(50);
  return (
    <figure className="grid gap-2">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-muted select-none">
        <img src={afterUrl} alt="After clearing" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
        <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
          <img src={beforeUrl} alt="Before clearing" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
        </div>
        <div aria-hidden className="absolute inset-y-0 w-1 -translate-x-1/2 bg-white shadow-[0_0_6px_rgba(0,0,0,0.5)]" style={{ left: `${position}%` }} />
        <span className="absolute top-3 left-3 rounded bg-black/60 px-2 py-0.5 text-xs font-medium text-white">Before</span>
        <span className="absolute top-3 right-3 rounded bg-black/60 px-2 py-0.5 text-xs font-medium text-white">After</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={position}
        onChange={(e) => setPosition(Number(e.target.value))}
        aria-label="Slide to compare before and after"
        className="w-full accent-primary"
      />
    </figure>
  );
}
