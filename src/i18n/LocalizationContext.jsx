import React, { createContext, useContext, useEffect, useMemo, useCallback } from "react";
import { TRANSLATIONS } from "./translations";

const LocalizationContext = createContext({
  lang: "en",
  language: "en",
  locale: "en-US",
  t: (key, fallback) => fallback || key,
  formatPrice: (amount) => `$${Number(amount || 0).toFixed(2)}`,
  formatNumber: (num) => String(num ?? 0),
  formatDate: (dateInput) => String(dateInput || ""),
});

export function LocalizationProvider({ children }) {
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = "en";
    }
  }, []);

  const t = useCallback((key, fallback) => {
    if (TRANSLATIONS.en[key] !== undefined) return TRANSLATIONS.en[key];
    return fallback !== undefined ? fallback : key;
  }, []);

  // Store canonical currency is USD ($) across checkout/Stripe/SSLCommerz calculations
  const formatPrice = useCallback((amount) => {
    const num = Number(amount || 0);
    if (!Number.isFinite(num)) return "$0.00";
    return `$${num.toFixed(2)}`;
  }, []);

  const formatNumber = useCallback((num) => {
    const n = Number(num ?? 0);
    if (!Number.isFinite(n)) return "0";
    try {
      return new Intl.NumberFormat("en-US").format(n);
    } catch {
      return String(n);
    }
  }, []);

  const formatDate = useCallback((dateInput) => {
    if (!dateInput) return "";
    const d = new Date(dateInput);
    if (Number.isNaN(d.getTime())) return String(dateInput);
    try {
      return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(d);
    } catch {
      return d.toLocaleDateString("en-US");
    }
  }, []);

  const value = useMemo(
    () => ({
      lang: "en",
      language: "en",
      locale: "en-US",
      t,
      formatPrice,
      formatNumber,
      formatDate,
    }),
    [t, formatPrice, formatNumber, formatDate]
  );

  return (
    <LocalizationContext.Provider value={value}>
      {children}
    </LocalizationContext.Provider>
  );
}

export function useLocalization() {
  return useContext(LocalizationContext);
}
