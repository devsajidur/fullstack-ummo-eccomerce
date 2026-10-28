# 🛍️ Ummo E-Commerce — Enterprise Full-Stack Platform

A modern, high-performance, enterprise-grade full-stack e-commerce platform built with **React 19, Vite, Tailwind CSS v4, Redux Toolkit**, and a secure **Node.js + Express + PostgreSQL (Prisma ORM)** backend architecture.

---

## ✨ Key Features

### 🖥️ Storefront & Customer Experience
- **Modern Responsive UI:** Built with React 19, Tailwind CSS v4, and Swiper.js carousels.
- **Advanced Catalog Filtering:** Filter by Category, Brand search, Dynamic Price Range slider, and Price Sorting (`low-to-high`, `high-to-low`).
- **Global Instant Search:** Real-time product search in desktop & mobile navigation.
- **Persistent Cart & Wishlist:** Redux Toolkit state synchronized with `localStorage` and server-side checkout validation.
- **Customer Profile & Order History:** Real-time order tracking and printable digital invoices (`/ordercomplete?orderId=...`).

### 🛡️ Enterprise Backend & Security Architecture (`/backend`)
- **PostgreSQL + Prisma ORM Schema:** Relational schema supporting `Users`, `RefreshTokens`, `Categories`, `Products`, `ProductVariants` (SKU-level stock locking), `Coupons`, `Orders`, `OrderItems`, `Payments`, and `AuditLogs`.
- **Zero-Trust Auth & RBAC:**
  - Cryptographic `scrypt` password hashing with constant-time verification (`crypto.timingSafeEqual`).
  - Short-lived JWT Access Tokens (`15m`) + `HttpOnly, Secure, SameSite=Strict` Refresh Token Rotation (`7d`).
  - Role-Based Access Control (`CUSTOMER`, `STAFF`, `SUPER_ADMIN`).
- **Anti-Tampering Checkout Engine:**
  - Server-side price, shipping, and VAT calculation (prevents client-side price manipulation).
  - Atomic stock verification & deduction with `Idempotency-Key` support to prevent duplicate charges.
- **API Hardening:** `Helmet` HTTP security headers, strict `CORS`, `Zod` schema validation, `X-Request-Id` audit tracing, and multi-tier `express-rate-limit` brute-force protection.
- **Payment Webhooks:** Ready-to-use cryptographic webhook verification endpoints for **Stripe** and **SSLCommerz**.

---

## 📂 Project Structure

```text
Ummo-Ecommerce/
├── src/                        # React 19 + Vite Storefront
│   ├── app/store.js            # Redux Toolkit Store
│   ├── components/             # Modular UI Components (Home, Shop, Cart, Billing, etc.)
│   ├── pages/                  # 19 Application Pages
│   ├── services/api.js         # Centralized Axios API Client with fallback
│   └── slices/                 # Redux State Slices
└── backend/                    # Enterprise Node.js + Express + Prisma API
    ├── prisma/
    │   ├── schema.prisma       # PostgreSQL Enterprise Schema
    │   └── seed.js             # Catalog Database Seeder
    └── src/
        ├── middlewares/        # Helmet, Rate Limiter, JWT Auth, RBAC Guards
        ├── routes/             # Auth, Products, Checkout Orders, Payment Webhooks
        ├── utils/crypto.js     # Password KDF, Token Hashing, Order Number Generator
        └── server.js           # Express Application Entrypoint
```

---

## 🚀 Quick Start

### 1. Frontend Setup
```bash
cp .env.example .env
npm install
npm run dev
```

### 2. Enterprise Backend Setup
```bash
cd backend
cp .env.example .env
npm install
npx prisma generate
npm run dev
```
