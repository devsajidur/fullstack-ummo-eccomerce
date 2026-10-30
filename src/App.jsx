import React, { Suspense, lazy } from "react";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import Rootlayout from "./components/layout/Rootlayout";
import HomePage from "./pages/HomePage";
import ShopPage from "./pages/ShopPage";
import CategoryPage from "./pages/CategoryPage";
import DiscountsPage from "./pages/DiscountsPage";
import ShopSingle from "./pages/ShopSingle";
import ShopDynamicPage from "./pages/ShopDynamicPage";

// Route-level code splitting for secondary routes
const CartPage = lazy(() => import("./pages/CartPage"));
const WishListPage = lazy(() => import("./pages/WishListPage"));
const Register = lazy(() => import("./pages/Register"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const FAQPage = lazy(() => import("./pages/FAQPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const TermsConditionPage = lazy(() => import("./pages/TermsConditionPage"));
const BlogPage = lazy(() => import("./pages/Blogpage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const LocationPage = lazy(() => import("./pages/LocationPage"));
const ForgotPassword = lazy(() => import("./pages/ForgorPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const BillingPage = lazy(() => import("./pages/BillingPage"));
const OrderSuccessPage = lazy(() => import("./pages/OrderSuccessPage"));
const ClickProductPage = lazy(() => import("./pages/ClickProductPage"));
const AdminDashboardPage = lazy(() => import("./pages/AdminDashboardPage"));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center text-xs font-semibold uppercase tracking-widest text-gray-600">
      Loading...
    </div>
  );
}

const withSuspense = (Component) => (
  <Suspense fallback={<PageLoader />}>
    <Component />
  </Suspense>
);

const router = createBrowserRouter([
  {
    path: "/",
    Component: Rootlayout,
    children: [
      { index: true, Component: HomePage },
      { path: "shop", Component: ShopPage },
      { path: "shop/:id", Component: ShopDynamicPage },
      { path: "category/:slug", Component: CategoryPage },
      { path: "discounts", Component: DiscountsPage },
      { path: "shopsingle", Component: ShopSingle },
      { path: "cart", element: withSuspense(CartPage) },
      { path: "wish", element: withSuspense(WishListPage) },
      { path: "register", element: withSuspense(Register) },
      { path: "login", element: withSuspense(LoginPage) },
      { path: "wishlist", element: withSuspense(WishListPage) },
      { path: "blog", element: withSuspense(BlogPage) },
      { path: "journal", element: withSuspense(BlogPage) },
      { path: "collection", element: withSuspense(ShopPage) },
      { path: "lookbook", element: withSuspense(ShopPage) },
      { path: "faq", element: withSuspense(FAQPage) },
      { path: "about", element: withSuspense(AboutPage) },
      { path: "terms", element: withSuspense(TermsConditionPage) },
      { path: "contact", element: withSuspense(ContactPage) },
      { path: "location", element: withSuspense(LocationPage) },
      { path: "profile", element: withSuspense(ProfilePage) },
      { path: "dashboard", element: withSuspense(ProfilePage) },
      { path: "admin", element: withSuspense(AdminDashboardPage) },
      { path: "billing", element: withSuspense(BillingPage) },
      { path: "ordercomplete", element: withSuspense(OrderSuccessPage) },
      { path: "clickproduct", element: withSuspense(ClickProductPage) },
    ],
  },
  { path: "/forgot", element: withSuspense(ForgotPassword) },
  { path: "*", element: withSuspense(NotFoundPage) },
]);

const App = () => {
  return <RouterProvider router={router} />;
};

export default App;
