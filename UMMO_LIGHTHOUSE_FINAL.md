# UMMO LIGHTHOUSE CLI AUDIT (Pre-Merge Gate, real runs)

Branch: feature/ummo-mobile-enterprise-transformation. Lighthouse 13.6.0, executed 2026-10-30T13:06:46.473Z. Raw JSON: verification-evidence/lighthouse/lh-*.json

| Page | Route | Mode | Perf | A11y | BP | SEO | FCP | LCP | TBT | CLS |
|---|---|---|--:|--:|--:|--:|---|---|---|---|
| home | `/` | mobile | 96 | 100 | 100 | 100 | 1.1 s | 2.5 s | 130 ms | 0 |
| home | `/` | desktop | 100 | 100 | 100 | 100 | 0.3 s | 0.6 s | 0 ms | 0.011 |
| shop | `/shop` | mobile | 90 | 100 | 100 | 100 | 1.1 s | 3.1 s | 230 ms | 0.001 |
| shop | `/shop` | desktop | 100 | 100 | 100 | 100 | 0.3 s | 0.6 s | 50 ms | 0.003 |
| category-women | `/category/women` | mobile | 96 | 100 | 100 | 100 | 1.1 s | 1.1 s | 230 ms | 0.001 |
| category-women | `/category/women` | desktop | 100 | 100 | 100 | 100 | 0.3 s | 0.8 s | 0 ms | 0.003 |
| discounts | `/discounts` | mobile | 94 | 100 | 100 | 100 | 1.1 s | 1.1 s | 270 ms | 0.001 |
| discounts | `/discounts` | desktop | 100 | 100 | 100 | 100 | 0.3 s | 0.3 s | 10 ms | 0.003 |
| product-1 | `/shop/1` | mobile | 86 | 100 | 100 | 100 | 1.1 s | 3.0 s | 350 ms | 0.001 |
| product-1 | `/shop/1` | desktop | 100 | 100 | 100 | 100 | 0.3 s | 0.6 s | 0 ms | 0.003 |

## Honest status
- Mobile Perf >= 90 on 4/5 routes; **/shop/1 mobile = 86 (LCP 3.0 s)** is still below target. Run-to-run variance is large (same build scored 84-96 on this route across runs).
- Mobile Home LCP 2.5 s (target met), Discounts mobile LCP 1.1 s, Discounts desktop CLS 0.003 (target <= 0.1 met).
- /shop mobile LCP 3.1 s (Perf 90) remains above the 2.5 s LCP goal.
- Scores are from local vite preview with Lighthouse simulated throttling, not production.

