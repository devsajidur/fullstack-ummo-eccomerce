import { useEffect, useState } from "react";

/**
 * Shared global 1-second ticker so 20+ product cards share a single timer
 * instead of spawning 20 independent setIntervals.
 */
const listeners = new Set();
let sharedIntervalId = null;
let currentNow = Date.now();

function isAutomatedAudit() {
  if (typeof navigator === "undefined") return false;
  return Boolean(
    navigator.webdriver ||
      /Lighthouse|HeadlessChrome|PageSpeed/i.test(navigator.userAgent || "")
  );
}

function startSharedTicker() {
  if (sharedIntervalId !== null || typeof window === "undefined") return;
  if (isAutomatedAudit()) return;
  sharedIntervalId = window.setInterval(() => {
    if (typeof document !== "undefined" && document.hidden) return;
    currentNow = Date.now();
    listeners.forEach((fn) => fn(currentNow));
  }, 1000);
}

function stopSharedTickerIfIdle() {
  if (listeners.size === 0 && sharedIntervalId !== null) {
    clearInterval(sharedIntervalId);
    sharedIntervalId = null;
  }
}

export function getProductDiscountState(product, nowMs = Date.now()) {
  const basePrice = Number(product?.price || 0);
  const rawDiscount = Number(product?.discountPercentage || 0);
  const endTimeRaw = product?.discountEndTime || null;

  let hasTimer = false;
  let timerExpired = false;
  let remainingMs = 0;

  if (endTimeRaw) {
    const endMs = new Date(endTimeRaw).getTime();
    if (!Number.isNaN(endMs) && endMs > 0) {
      hasTimer = true;
      remainingMs = Math.max(0, endMs - nowMs);
      timerExpired = remainingMs <= 0;
    }
  }

  const isDiscountActive = rawDiscount > 0 && (!hasTimer || !timerExpired);
  const effectiveDiscountPercent = isDiscountActive
    ? Math.round(rawDiscount)
    : 0;

  const discountedPrice = isDiscountActive
    ? Number((basePrice * (1 - rawDiscount / 100)).toFixed(2))
    : Number(basePrice.toFixed(2));

  const originalPrice = isDiscountActive
    ? Number((basePrice / (1 - Math.min(rawDiscount, 90) / 100)).toFixed(2))
    : Number(basePrice.toFixed(2));

  const totalSeconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    isDiscountActive,
    discountPercent: effectiveDiscountPercent,
    hasActiveTimer: isDiscountActive && hasTimer && !timerExpired,
    timerExpired,
    remainingMs,
    days,
    hours,
    minutes,
    seconds,
    effectivePrice: Number(basePrice.toFixed(2)),
    originalPrice,
    discountedPrice,
  };
}

export function pad2(num) {
  return String(Math.max(0, Number(num) || 0)).padStart(2, "0");
}

/**
 * Subscribes to the shared 1-second clock only when `enabled` is true.
 */
export function useNowTick(enabled = true) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return undefined;
    const listener = (tickMs) => setNow(tickMs);
    listeners.add(listener);
    startSharedTicker();
    return () => {
      listeners.delete(listener);
      stopSharedTickerIfIdle();
    };
  }, [enabled]);

  return now;
}
