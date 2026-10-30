# UMMO ECOMMERCE — BANGLA (`bn-BD`) & ENGLISH (`en`) LOCALIZATION REPORT (GATE 10)

**Branch:** `feature/ummo-mobile-enterprise-transformation`  
**Audit Date:** 2026-10-30

---

## 1. Architecture & Typography

- **Font Stack (`index.html`, `src/index.css`):**
  - Added Google Fonts `Noto Sans Bengali:wght@400;500;600;700` alongside `Jost`.
  - Updated `--font-jost: "Jost", "Noto Sans Bengali", sans-serif;` so Bengali script renders with crisp glyph shaping, proper matra alignment, and comfortable line height across Android, iOS, and desktop browsers.
- **Localization Provider (`src/i18n/LocalizationContext.jsx`, `src/i18n/translations.js`):**
  - Provides `language` / `lang` (`"en"` | `"bn"`), `setLanguage`, `toggleLanguage` / `toggleLang`, and `t(key, fallback)`.
  - Persists user selection in `localStorage` (`ummo_lang`) and updates `<html lang="bn">` / `<html lang="en">` dynamically.

---

## 2. Bilingual Dictionary Parity Verification

- **Automated Test Verification (`tests/security-and-mongodb.test.mjs`):**
  - Verified 100% key parity between `TRANSLATIONS.en` and `TRANSLATIONS.bn`.
- **Covered Surfaces:**
  - Desktop Header & Slide-Out Mobile Navigation Drawer (`English` / `বাংলা` switcher in both header and drawer).
  - Mobile Bottom Navigation (`হোম | শপ | কার্ট | উইশলিস্ট | অ্যাকাউন্ট`).
  - Department & Category Pages (`/category/:slug`) and All Discounts Page (`/discounts`).
  - Homepage "Best Deals for You" section (`আপনার জন্য সেরা ডিল`).
  - Dedicated Admin Login & Mobile-First Admin Control Center (`ওভারভিউ`, `অর্ডারসমূহ`, `পণ্যসমূহ`, `ক্যাটাগরি`, `ইনভেন্টরি`, `ডিসকাউন্ট`, `কুপন`, `গ্রাহকবৃন্দ`, `পেমেন্ট ও রিফান্ড`, `ব্যানার ও সিএমএস`).
