import React from "react";
import { Outlet } from "react-router";
import Header from "./Header";
import Footer from "../Footer";
import ScrollToTop from "./scrolltotop/ScrollToTop";

const Rootlayout = () => {
  return (
    <main className="overflow-x-hidden w-full">
      <ScrollToTop />
      <Header />
      <Outlet />
      <Footer />
    </main>
  );
};

export default Rootlayout;
