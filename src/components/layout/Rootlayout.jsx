import React from "react";
import { Outlet, useLocation } from "react-router";
import Header from "./Header";
import Footer from "../Footer";
import ScrollToTop from "./scrolltotop/ScrollToTop";
import MobileBottomNav from "./MobileBottomNav";

const Rootlayout = () => {
  const location = useLocation();
  const isAdminRoute = (location.pathname || "").startsWith("/admin");

  return (
    <main
      className={`overflow-x-hidden w-full min-h-screen ${
        isAdminRoute ? "" : "pb-16 lg:pb-0"
      }`}
    >
      <ScrollToTop />
      {!isAdminRoute && <Header />}
      <Outlet />
      {!isAdminRoute && <Footer />}
      {!isAdminRoute && <MobileBottomNav />}
    </main>
  );
};

export default Rootlayout;
