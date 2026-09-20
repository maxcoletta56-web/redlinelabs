"use client";

import { useEffect, useRef } from "react";

const SPEED_PX_PER_SEC = 70;

export function MarqueeBanner({
  items,
  label,
}: {
  items: string[];
  label: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    const group = groupRef.current;
    if (!track || !group) return;

    let frame = 0;
    let offset = 0;
    let last = 0;
    let paused = false;
    let distance = 0;

    const measure = () => {
      distance = group.getBoundingClientRect().width;
    };

    const tick = (now: number) => {
      if (!last) last = now;
      const delta = Math.min(now - last, 48) / 1000;
      last = now;
      if (!paused && distance > 0) {
        offset = (offset + SPEED_PX_PER_SEC * delta) % distance;
        track.style.transform = `translate3d(${-offset}px,0,0)`;
      }
      frame = window.requestAnimationFrame(tick);
    };

    measure();
    frame = window.requestAnimationFrame(tick);

    const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const pause = () => {
      paused = true;
    };
    const resume = () => {
      paused = false;
      last = 0;
    };
    if (canHover) {
      track.addEventListener("mouseenter", pause);
      track.addEventListener("mouseleave", resume);
    }

    const ro = new ResizeObserver(() => {
      const next = group.getBoundingClientRect().width;
      if (next > 0) {
        distance = next;
        offset %= distance;
      }
    });
    ro.observe(group);

    const onVisibility = () => {
      last = 0;
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("orientationchange", measure);

    return () => {
      window.cancelAnimationFrame(frame);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("orientationchange", measure);
      if (canHover) {
        track.removeEventListener("mouseenter", pause);
        track.removeEventListener("mouseleave", resume);
      }
    };
  }, [items]);

  return (
    <div className="marquee" aria-label={label}>
      <div className="marquee-track" ref={trackRef}>
        {[0, 1].map((copy) => (
          <div
            className="marquee-group"
            key={copy}
            ref={copy === 0 ? groupRef : undefined}
            aria-hidden={copy === 1 ? true : undefined}
          >
            {items.map((name) => (
              <span key={`${copy}-${name}`}>
                <span className="marquee-dot">•</span>
                {name}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
