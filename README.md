# Ummo-Ecommerce (Enterprise Full-Stack Edition)

A complete, production-ready Full-Stack E-Commerce application featuring a modern **React 19 + Redux Toolkit + Tailwind CSS v4** storefront, a full **Admin Control Panel (`/admin`)**, an interactive **Customer Dashboard (`/profile` / `/dashboard`)**, and an **Enterprise Node.js + Express + Prisma + PostgreSQL** backend architecture.

---

## ✨ Key E-Commerce Features Included

### 1. 🛡️ Full Admin Panel (`/admin`)
- **Executive Analytics Overview**: Real-time KPIs for Total Revenue, Total Orders, Average Order Value (AOV), Registered Users, Store Catalog Size, and Active Promo Coupons.
- **Order Fulfillment Pipeline**: Live breakdown and management of orders across `PENDING`, `PROCESSING`, `SHIPPED`, `DELIVERED`, and `CANCELLED` states—updating an order status immediately reflects in the customer's live order tracker.
- **Product Catalog CRUD**: Add new products, edit existing products (title, category, price, discount %, stock, thumbnail), or delete products directly from the Admin Panel. Custom products sync instantaneously with the storefront (`/shop`).
- **Promo Coupon Engine**: Create, view, and delete percentage or fixed-amount discount codes with minimum order rules (includes built-in `WELCOME10`, `UMMO20`, and `VIP25` coupons).
- **Customer, Inquiry & Newsletter Hub**: View registered customers, read contact form messages, and inspect newsletter subscribers in real time.

### 2. 👤 Customer Dashboard (`/profile` & `/dashboard`)
- **Personal KPI Overview**: Total orders, active shipments in progress, lifetime spend, and saved wishlist counter.
- **4-Step Visual Order Tracking**: Interactive progress bar (`Order Placed` → `Processing` → `Shipped` → `Delivered`) with live updates from the Admin Panel, item-level size/color breakdown, invoice link, and self-service **Cancel Order** action for pending orders.
- **Exclusive Promo Coupons**: One-click copy for active store discount codes to apply in the cart or checkout.
- **Saved Address Book**: Add, manage, delete, and set a **Default Shipping Address** that automatically pre-fills the checkout billing form.
- **Account & Security Settings**: Update display name, phone number, bio, and trigger secure password reset emails.

### 3. 🛍️ Complete Storefront & Checkout Experience
- **Product Variants & Direct Buy**: Select **Size (`XS`–`XL`)**, **Color Swatches**, and **Quantity (`- / +`)** on the single product page, with both **Add to Cart** and **Buy Now** (instant checkout redirect) actions.
- **Interactive Customer Reviews**: Submit verified customer reviews with 1–5 star ratings and comments on any product page.
- **Promo Coupon Cart Calculation**: Apply promo codes directly in `/cart` with automatic discount calculation carried through `/billing` and `/ordercomplete`.
- **Printable Order Invoice**: View order status badge, itemized variant details, coupon discount breakdown, and print-ready invoice at `/ordercomplete`.
- **Connected Contact & Newsletter Forms**: Contact page inquiries and footer newsletter signups persist in real time with instant toast feedback.

---

## 🏗️ Project Structure

```text
Ummo-Ecommerce/
├── src/                          # React 19 + Vite 8 + Tailwind v4 Frontend
│   ├── api/                      # Navigation & static config
│   ├── components/               # Storefront, Cart, Billing, Reviews, Invoice UI
│   ├── pages/
│   │   ├── AdminDashboardPage.jsx # Full 5-Tab Admin Control Center (/admin)
│   │   ├── ProfilePage.jsx        # Full 4-Tab Customer Dashboard (/profile, /dashboard)
│   │   └── ...                    # Home, Shop, ShopSingle, Cart, Billing, Blog, Contact, Auth
│   ├── services/api.js           # Unified Product, Coupon, Order & API Service Layer
│   ├── slices/                   # Redux Toolkit (cartSlice with Coupons, wishListSlice)
│   └── store/                    # Redux Store
└── backend/                      # Enterprise Node.js + Express + Prisma + PostgreSQL API
    ├── prisma/
    │   ├── schema.prisma         # 12-Table Relational Schema with ACID & AuditLog
    │   └── seed.js               # Automated Catalog, Admin & Coupon Seeder
    └── src/
        ├── middlewares/          # Helmet, Rate-Limiting, JWT Auth & RBAC (ADMIN/CUSTOMER)
        ├── routes/               # /auth, /products, /orders, /admin, /webhooks
        ├── utils/crypto.js       # scrypt KDF, SHA-256 Token Hashing & Order Generator
        └── server.js             # Express API Entrypoint
```

---

## 🚀 Quick Start

### 1. Frontend Setup
```bash
npm install
npm run dev
```
- **Storefront**: `http://localhost:5173`
- **Customer Dashboard**: `http://localhost:5173/profile` (or `/dashboard`)
- **Admin Panel**: `http://localhost:5173/admin`

### 2. Enterprise Backend Setup (Optional PostgreSQL Mode)
```bash
cd backend
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```
- **API Healthcheck**: `http://localhost:5000/api/v1/health`
