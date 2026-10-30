import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import { TRANSLATIONS } from "./translations";

const LANG_STORAGE_KEY = "ummo_lang";

const LocalizationContext = createContext({
  lang: "en",
  language: "en",
  locale: "en-US",
  isBangla: false,
  setLang: () => {},
  setLanguage: () => {},
  toggleLang: () => {},
  toggleLanguage: () => {},
  t: (key, fallback) => fallback || key,
  formatPrice: (amount) => `$${Number(amount || 0).toFixed(2)}`,
  formatNumber: (num) => String(num ?? 0),
  formatDate: (dateInput) => String(dateInput || ""),
});

export function LocalizationProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try {
      if (typeof localStorage !== "undefined") {
        const saved = localStorage.getItem(LANG_STORAGE_KEY);
        if (saved === "bn" || saved === "en") return saved;
      }
    } catch {
      // ignore storage errors
    }
    return "en";
  });

  const setLang = useCallback((nextLang) => {
    const normalized = nextLang === "bn" || nextLang === "bn-BD" ? "bn" : "en";
    setLangState(normalized);
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(LANG_STORAGE_KEY, normalized);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === "bn" ? "en" : "bn");
  }, [lang, setLang]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang === "bn" ? "bn-BD" : "en";
      if (lang === "bn" && !document.getElementById("ummo-bn-font")) {
        const link = document.createElement("link");
        link.id = "ummo-bn-font";
        link.rel = "stylesheet";
        link.href =
          "https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;500;600;700&display=swap";
        document.head.appendChild(link);
      }
    }
  }, [lang]);

  const t = useCallback(
    (key, fallback) => {
      const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;
      if (dict && dict[key] !== undefined) return dict[key];
      if (TRANSLATIONS.en[key] !== undefined) return TRANSLATIONS.en[key];
      return fallback !== undefined ? fallback : key;
    },
    [lang]
  );

  // Store canonical currency is USD ($) across checkout/Stripe/SSLCommerz calculations
  const formatPrice = useCallback((amount) => {
    const num = Number(amount || 0);
    if (!Number.isFinite(num)) return "$0.00";
    return `$${num.toFixed(2)}`;
  }, []);

  const formatNumber = useCallback(
    (num) => {
      const n = Number(num ?? 0);
      if (!Number.isFinite(n)) return "0";
      try {
        return new Intl.NumberFormat(lang === "bn" ? "bn-BD" : "en-US").format(n);
      } catch {
        return String(n);
      }
    },
    [lang]
  );

  const formatDate = useCallback(
    (dateInput) => {
      if (!dateInput) return "";
      const d = new Date(dateInput);
      if (Number.isNaN(d.getTime())) return String(dateInput);
      try {
        return new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        }).format(d);
      } catch {
        return d.toLocaleDateString();
      }
    },
    [lang]
  );

  const value = useMemo(
    () => ({
      lang,
      language: lang,
      locale: lang === "bn" ? "bn-BD" : "en-US",
      isBangla: lang === "bn",
      setLang,
      setLanguage: setLang,
      toggleLang,
      toggleLanguage: toggleLang,
      t,
      formatPrice,
      formatNumber,
      formatDate,
    }),
    [lang, setLang, toggleLang, t, formatPrice, formatNumber, formatDate]
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
