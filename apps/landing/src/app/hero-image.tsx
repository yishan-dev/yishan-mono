"use client";

import { useEffect, useRef, useState } from "react";

export function HeroImage() {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1.2);

  useEffect(() => {
    const handleScroll = () => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      // Calculate progress: 0 when element top is at viewport bottom, 1 when fully scrolled past
      const progress = Math.max(0, Math.min(1, 1 - rect.top / windowHeight));

      // Interpolate from 1.2 to 0.9 as user scrolls
      const newScale = 1.2 - progress * 0.3;
      setScale(newScale);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      ref={ref}
      className="mt-16 transition-transform duration-100 ease-out will-change-transform origin-[center_30%]"
      style={{ transform: `scale(${scale})` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/app.png"
        alt="Yishan desktop app screenshot"
        className="h-auto w-full rounded-lg shadow-[0_32px_100px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.04)]"
      />
    </div>
  );
}
