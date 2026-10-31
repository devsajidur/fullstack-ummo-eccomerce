import React, { Suspense, lazy, useEffect, useState } from "react";
import ProductDetails from "../components/shopsingle/ProductDetails";

const RelatedProduct = lazy(() =>
  import("../components/shopsingle/RelatedProduct")
);

const ShopSingle = () => {
  const [showRelated, setShowRelated] = useState(false);

  useEffect(() => {
    const mount = () => setShowRelated(true);
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(mount, { timeout: 600 });
      return () => window.cancelIdleCallback?.(id);
    }
    const timer = setTimeout(mount, 250);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div>
      <ProductDetails />
      {showRelated && (
        <Suspense fallback={null}>
          <RelatedProduct />
        </Suspense>
      )}
    </div>
  );
};

export default ShopSingle;
