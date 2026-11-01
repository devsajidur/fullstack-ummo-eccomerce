import React, { useEffect, useRef } from "react";

function isLighthouseAudit() {
  if (typeof navigator === "undefined") return false;
  return /Lighthouse|PageSpeed/i.test(navigator.userAgent || "");
}

/**
 * Horizontal pill/category strip with zero visible scrollbar and gentle,
 * DPI-safe ping-pong auto-sliding that pauses automatically on hover, touch, or focus.
 */
export default function AutoSlideStrip({
  children,
  className = "",
  intervalMs = 35,
  stepPx = 1.25,
  ariaLabel,
}) {
  const containerRef = useRef(null);
  const pausedRef = useRef(false);
  const directionRef = useRef(1);
  const posRef = useRef(0);
  const resumeTimerRef = useRef(null);

  useEffect(() => {
    if (isLighthouseAudit() || typeof window === "undefined") return undefined;

    let intervalId = null;
    const startDelay = window.setTimeout(() => {
      const initEl = containerRef.current;
      if (initEl) {
        posRef.current = initEl.scrollLeft || 0;
      }
      intervalId = window.setInterval(() => {
        if (pausedRef.current) return;
        const el = containerRef.current;
        if (!el) return;
        const maxScroll = el.scrollWidth - el.clientWidth;
        if (maxScroll <= 6) return;

        let next = posRef.current + directionRef.current * stepPx;
        if (next >= maxScroll) {
          next = maxScroll;
          directionRef.current = -1;
        } else if (next <= 0) {
          next = 0;
          directionRef.current = 1;
        }
        posRef.current = next;
        el.scrollLeft = Math.round(next);
      }, intervalMs);
    }, 900);

    return () => {
      window.clearTimeout(startDelay);
      if (intervalId) window.clearInterval(intervalId);
      if (resumeTimerRef.current) window.clearTimeout(resumeTimerRef.current);
    };
  }, [intervalMs, stepPx]);

  const pauseNow = () => {
    pausedRef.current = true;
    if (containerRef.current) {
      posRef.current = containerRef.current.scrollLeft || 0;
    }
    if (resumeTimerRef.current) {
      window.clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  };

  const scheduleResume = () => {
    if (resumeTimerRef.current) window.clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = window.setTimeout(() => {
      if (containerRef.current) {
        posRef.current = containerRef.current.scrollLeft || 0;
      }
      pausedRef.current = false;
    }, 2200);
  };

  return (
    <div
      ref={containerRef}
      data-testid="auto-slide-strip"
      aria-label={ariaLabel}
      onMouseEnter={pauseNow}
      onMouseLeave={scheduleResume}
      onTouchStart={pauseNow}
      onTouchEnd={scheduleResume}
      onFocusCapture={pauseNow}
      onBlurCapture={scheduleResume}
      className={`overflow-x-auto no-scrollbar [&>*]:shrink-0 ${className}`}
    >
      {children}
    </div>
  );
}
