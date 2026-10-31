# UMMO LIGHTHOUSE CLI AUDIT (Final Pure-English Release Verification)

Branch: `main` — Lighthouse `13.6.0`, executed `2026-10-31T07:07:04.922Z`. Raw JSON: `verification-evidence/lighthouse/lh-*.json`

| Page | Route | Mode | Perf | A11y | BP | SEO | FCP | LCP | TBT | CLS |
|---|---|---|--:|--:|--:|--:|---|---|---|---|
| home | `/` | mobile | 93 | 100 | 100 | 100 | 1.1 s | 2.6 s | 230 ms | 0.001 |
| home | `/` | desktop | 100 | 100 | 100 | 100 | 0.3 s | 0.6 s | 0 ms | 0.011 |
| shop | `/shop` | mobile | 95 | 100 | 100 | 100 | 1.1 s | 2.4 s | 190 ms | 0 |
| shop | `/shop` | desktop | 100 | 100 | 100 | 100 | 0.3 s | 0.6 s | 50 ms | 0.003 |
| category-women | `/category/women` | mobile | 96 | 100 | 100 | 100 | 1.1 s | 1.1 s | 240 ms | 0.001 |
| category-women | `/category/women` | desktop | 100 | 100 | 100 | 100 | 0.3 s | 0.8 s | 10 ms | 0.003 |
| discounts | `/discounts` | mobile | 95 | 100 | 100 | 100 | 1.1 s | 1.1 s | 260 ms | 0.001 |
| discounts | `/discounts` | desktop | 100 | 100 | 100 | 100 | 0.3 s | 0.3 s | 10 ms | 0.003 |
| product-1 | `/shop/1` | mobile | 89 (up to 96) | 100 | 100 | 100 | 1.1 s | 2.6–3.0 s | 280 ms | 0 |
| product-1 | `/shop/1` | desktop | 99–100 | 100 | 100 | 100 | 0.3 s | 0.7–0.9 s | 0 ms | 0.003 |

## Summary
- **Accessibility, Best Practices & SEO:** `100 / 100 / 100` across all 10 mobile and desktop audits.
- **Desktop Performance:** `99–100` across all 5 routes (`LCP 0.3s–0.9s`, `CLS 0.003–0.011`).
- **Mobile Performance:** `93–96` on `/`, `/shop`, `/category/women`, and `/discounts`; `89–96` on `/shop/1` across simulated 4G runs (`CLS 0–0.001`).
