import { useSelector } from "react-redux";
import { resolveProductVariants } from "../../utils/productVariants";

export default function AdditionalInformation({ product }) {
  const reduxProduct = useSelector(
    (state) => state.clickProductDetails.Details
  );
  const detailsProduct = product || reduxProduct;
  const dims = detailsProduct?.dimensions;
  const variants = resolveProductVariants(detailsProduct);

  return (
    <section className="w-full font-jost">
      <div className="overflow-hidden">
        <div className="border-gray-200 py-2 sm:grid-cols-[220px_1fr]">
          <ul>
            {variants.sizes.length > 0 && (
              <li className="flex justify-between py-2 border-b border-gray-200">
                <span>Available {variants.sizeLabel}s</span>
                <span className="text-primary font-medium">
                  {variants.sizes.join(", ")}
                </span>
              </li>
            )}
            {variants.colors.length > 0 && (
              <li className="flex justify-between py-2 border-b border-gray-200">
                <span>Available {variants.colorLabel}s</span>
                <span className="text-primary font-medium">
                  {variants.colors.map((c) => c.name).join(", ")}
                </span>
              </li>
            )}
            <li className="flex justify-between py-2 border-b border-gray-200">
              <span>Weight</span>
              <span>{detailsProduct?.weight ?? "N/A"}</span>
            </li>
            <li className="flex justify-between py-2 border-b border-gray-200">
              <span>Dimensions</span>
              <span>
                {dims
                  ? `${dims.width} x ${dims.height} x ${dims.depth} cm`
                  : "N/A"}
              </span>
            </li>
            <li className="flex justify-between py-2 border-b border-gray-200">
              <span>Stock</span>
              <span>{detailsProduct?.stock ?? "N/A"}</span>
            </li>
            <li className="flex justify-between py-2 border-b border-gray-200">
              <span>Warranty Information</span>
              <span>
                {detailsProduct?.warrantyInformation || "Standard Warranty"}
              </span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
