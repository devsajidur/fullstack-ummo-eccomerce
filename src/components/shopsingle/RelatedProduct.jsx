import React from "react";
import { useSelector } from "react-redux";
import { useParams, useSearchParams } from "react-router";
import Product from "../layout/common/Product";
import { getInitialCatalogSnapshot } from "../../services/api";

export default function RelatedProduct() {
  const detailsProduct = useSelector(
    (state) => state.clickProductDetails.Details
  );
  const catalogProducts = useSelector((state) => state.AllProduct.Products);
  const { id: routeParamId } = useParams();
  const [searchParams] = useSearchParams();
  const targetId =
    searchParams.get("id") || routeParamId || detailsProduct?.id || 1;

  const Products =
    catalogProducts && catalogProducts.length > 0
      ? catalogProducts
      : getInitialCatalogSnapshot();
  const activeProduct =
    Products.find((p) => String(p.id) === String(targetId)) ||
    detailsProduct ||
    Products[0];

  const FilterPro = Products.filter(
    (item) =>
      item.category === activeProduct?.category &&
      String(item.id) !== String(activeProduct?.id)
  );

  return (
    <section className="bg-white font-jost text-primary">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <h2 className="text-xl sm:text-2xl">
          RELATED <span className="font-semibold">PRODUCTS</span>
        </h2>

        <div className="mt-8 grid justify-center grid-cols-1 xs:grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {FilterPro.slice(0, 4).map((product) => (
            <Product key={product.id} item={product} />
          ))}
        </div>
      </div>
    </section>
  );
}
