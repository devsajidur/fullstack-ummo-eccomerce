import { useEffect, useState } from "react";

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
    if (!Number.isNaN(endMs)) {
      hasTimer = true;
      remainingMs = endMs - nowMs;
      if (remainingMs <= 0) {
        timerExpired = true;
        remainingMs = 0;
      }
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
    savingsAmount,
    remainingMs,
    days,
    hours,
    minutes,
    seconds,
    discountEndTime: endTimeRaw || "",
  };
}

/**
 * Shared 1-second tick hook for components displaying live product countdowns.
 */
export function useNowTick(enabled = true) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [enabled]);

  return now;
}

export function pad2(num) {
  return String(Math.max(0, Number(num) || 0)).padStart(2, "0");
}
