import React, { Suspense, lazy, useEffect, useState } from "react";
import Banner from "../components/layout/home/Banner";
import Category from "../components/layout/home/Category";

// Below-the-fold sections are code-split and mounted after first paint so the
// above-the-fold hero/category LCP element is not delayed by main-thread work.
const BestDealsSection = lazy(() =>
  import("../components/layout/home/BestDealsSection")
);
const TrendyProducts = lazy(() =>
  import("../components/layout/home/TrendyProducts")
);
const SpringCollection = lazy(() =>
  import("../components/layout/home/SpringCollection")
);
const Starting = lazy(() => import("../components/layout/home/Starting"));
const LimitedEdition = lazy(() =>
  import("../components/layout/home/LimitedEdition")
);
const Sponcer = lazy(() => import("../components/layout/home/Sponcer"));
const Services = lazy(() => import("../components/layout/home/Services"));

const HomePage = () => {
  const [showRest, setShowRest] = useState(false);

  useEffect(() => {
    const mount = () => setShowRest(true);
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(mount, { timeout: 600 });
      return () => window.cancelIdleCallback?.(id);
    }
    const t = setTimeout(mount, 250);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <Banner />
      <Category />
      {showRest && (
        <Suspense fallback={null}>
          <BestDealsSection />
          <TrendyProducts />
          <SpringCollection />
          <Starting />
          <LimitedEdition />
          <Sponcer />
          <Services />
        </Suspense>
      )}
    </>
  );
};

export default HomePage;
