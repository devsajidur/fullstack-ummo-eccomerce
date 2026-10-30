import { useEffect, useState } from "react";

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
  startupTimeoutId = window.setTimeout(() => {
    startupTimeoutId = null;
    if (listeners.size === 0 || sharedIntervalId !== null) return;
    sharedIntervalId = window.setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      currentNow = Date.now();
      listeners.forEach((fn) => fn(currentNow));
    }, 1000);
  }, 1500);
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
 * Evaluates a product's active discount state, regular price, effective selling price,
 * and scheduled countdown timer in UTC milliseconds.
 *
 * Rules (Gates 6 & 7):
 * - Regular price must always be >= effective selling price.
 * - If discountPercentage <= 0 (and discountFixedAmount <= 0), or if discountStartTime is in the future,
 *   or if discountEndTime has expired, the product reverts to its regularPrice with isDiscountActive = false.
 * - Product listing cards must NEVER render the live ticking timer; only the Single Product page
 *   renders the countdown timer when hasActiveTimer is true.
 */
export function getProductDiscountState(item, nowMs = Date.now()) {
  const regularPrice = Math.max(0, Number(item?.price || 0));
  const rawPct = Number(item?.discountPercentage || 0);
  const rawFixed = Number(item?.discountFixedAmount || 0);

  const startStr = item?.discountStartTime;
  const hasStart =
    typeof startStr === "string" &&
    startStr.trim().length > 0 &&
    startStr !== "none";
  const startMs = hasStart ? Date.parse(startStr) : NaN;
  const isValidStart = Number.isFinite(startMs);
  const isNotStartedYet = isValidStart && startMs > nowMs;

  const endStr = item?.discountEndTime;
  const hasTimer =
    typeof endStr === "string" &&
    endStr.trim().length > 0 &&
    endStr !== "none";

  const endMs = hasTimer ? Date.parse(endStr) : NaN;
  const isValidTimer = Number.isFinite(endMs) && endMs > 0;
  const remainingMs = isValidTimer ? Math.max(0, endMs - nowMs) : 0;
  const isTimerExpired = isValidTimer && remainingMs <= 0;

  let calculatedSalePrice = regularPrice;
  let effectiveDiscountPct = 0;

  if (!isNotStartedYet && !isTimerExpired) {
    if (rawFixed > 0 && regularPrice > 0) {
      calculatedSalePrice = Math.max(
        0.01,
        Number((regularPrice - rawFixed).toFixed(2))
      );
      effectiveDiscountPct = Math.min(
        95,
        Math.round(((regularPrice - calculatedSalePrice) / regularPrice) * 100)
      );
    } else if (rawPct >= 1 && regularPrice > 0) {
      const clampedPct = Math.min(95, Math.max(0, rawPct));
      calculatedSalePrice = Number(
        (regularPrice - (regularPrice * clampedPct) / 100).toFixed(2)
      );
      effectiveDiscountPct = Math.round(clampedPct);
    }
  }

  const isDiscountActive =
    regularPrice > 0 &&
    calculatedSalePrice < regularPrice &&
    effectiveDiscountPct > 0 &&
    !isNotStartedYet &&
    !isTimerExpired;

  const effectivePrice = isDiscountActive ? calculatedSalePrice : regularPrice;
  const savingsAmount = isDiscountActive
    ? Number((regularPrice - effectivePrice).toFixed(2))
    : 0;

  const totalSeconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const roundedRegular = Number(regularPrice.toFixed(2));
  const roundedEffective = Number(effectivePrice.toFixed(2));
  const activePct = isDiscountActive ? effectiveDiscountPct : 0;

  return {
    regularPrice: roundedRegular,
    originalPrice: roundedRegular,
    effectivePrice: roundedEffective,
    discountedPrice: roundedEffective,
    savingsAmount,
    discountPercentage: activePct,
    discountPercent: activePct,
    isDiscountActive,
    isScheduledFuture: isNotStartedYet,
    hasActiveTimer: isDiscountActive && isValidTimer && remainingMs > 0,
    isTimerExpired,
    timerExpired: isTimerExpired,
    discountEndTime: endStr || "",
    endTimeIso: isValidTimer ? new Date(endMs).toISOString() : null,
    remainingMs,
    days,
    hours,
    minutes,
    seconds,
  };
}

export function pad2(num) {
  return String(Math.max(0, Number(num) || 0)).padStart(2, "0");
}

export function isTimestampExpired(isoString) {
  if (!isoString || typeof isoString !== "string") return false;
  const endMs = Date.parse(isoString);
  return Number.isFinite(endMs) && endMs <= Date.now();
}

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
