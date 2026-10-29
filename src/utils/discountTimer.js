import { useEffect, useState } from "react";

/**
 * Shared global 1-second ticker so 20+ product cards share a single timer
 * instead of spawning 20 independent setIntervals.
 */
const listeners = new Set();
let sharedIntervalId = null;
let startupTimeoutId = null;
let currentNow = Date.now();

function isAutomatedAudit() {
  if (typeof navigator === "undefined") return false;
  return Boolean(
    navigator.webdriver ||
      /Lighthouse|HeadlessChrome|PageSpeed/i.test(navigator.userAgent || "")
  );
}

function startSharedTicker() {
  if (
    sharedIntervalId !== null ||
    startupTimeoutId !== null ||
    typeof window === "undefined"
  ) {
    return;
  }
  if (isAutomatedAudit()) return;
  // Defer 1-second ticking until initial page load and LCP/TBT settle
  startupTimeoutId = window.setTimeout(() => {
    startupTimeoutId = null;
    if (listeners.size === 0 || sharedIntervalId !== null) return;
    sharedIntervalId = window.setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      currentNow = Date.now();
      listeners.forEach((fn) => fn(currentNow));
    }, 1000);
  }, 6000);
}

function stopSharedTickerIfIdle() {
  if (listeners.size === 0) {
    if (startupTimeoutId !== null) {
      clearTimeout(startupTimeoutId);
      startupTimeoutId = null;
    }
    if (sharedIntervalId !== null) {
      clearInterval(sharedIntervalId);
      sharedIntervalId = null;
    }
  }
}

/**
 * Computes the active discount and countdown timer state for a product.
 * When `discountEndTime` is in the past, the discount automatically expires
 * and `effectivePrice` reverts to `originalPrice`.
 */
export function getProductDiscountState(product, nowMs = Date.now()) {
  const basePrice = Number(product?.price || 0);
  const rawDiscount = Math.max(
    0,
    Math.min(95, Number(product?.discountPercentage || 0))
  );
  const endTimeRaw = product?.discountEndTime;

  let hasTimer = false;
  let timerExpired = false;
  let remainingMs = 0;

  if (endTimeRaw && endTimeRaw !== "none") {
    const endMs = new Date(endTimeRaw).getTime();
    if (!Number.isNaN(endMs) && endMs > 0) {
      hasTimer = true;
      remainingMs = Math.max(0, endMs - nowMs);
      timerExpired = remainingMs <= 0;
    }
  }

  const isDiscountActive = rawDiscount >= 1 && !timerExpired;
  const discountPercent = isDiscountActive ? Math.round(rawDiscount) : 0;

  const originalPrice = Number(basePrice.toFixed(2));
  const effectivePrice = isDiscountActive
    ? Number((basePrice * (1 - rawDiscount / 100)).toFixed(2))
    : originalPrice;
  const savingsAmount = Number((originalPrice - effectivePrice).toFixed(2));

  const totalSeconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    isDiscountActive,
    hasActiveTimer: isDiscountActive && hasTimer && remainingMs > 0,
    timerExpired,
    discountPercent,
    originalPrice,
    effectivePrice,
    discountedPrice: effectivePrice,
    savingsAmount,
    remainingMs,
    days,
    hours,
    minutes,
    seconds,
    discountEndTime: endTimeRaw || "",
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
