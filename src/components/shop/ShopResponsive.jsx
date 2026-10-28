import { useState } from "react";
import { LuSlidersHorizontal } from "react-icons/lu";
import { useDispatch, useSelector } from "react-redux";
import { useSearchParams } from "react-router";
import { resetShopOptions, setShopOptions } from "../../slices/productSlice";
import Product from "../layout/common/Product";
import ShopFilter from "./ShopFilter";
import { GoX } from "react-icons/go";

const SORT_OPTIONS = [
  { key: "default", label: "Default Select" },
  { key: "low", label: "Price: Low to High" },
  { key: "high", label: "Price: High to Low" },
  { key: "rating", label: "Highest Rated" },
  { key: "discount", label: "Biggest Discount" },
];

const ShopResponsive = () => {
  const [, setSearchParams] = useSearchParams();
  const [Dropshowhide, setDropshowhide] = useState(false);
  const [InitialPage, setInitialPage] = useState(1);
  const [showSlide, setshowSlide] = useState(false);
  const AllProduct = useSelector((state) => state.Products.filter) || [];
  const options = useSelector((state) => state.Products.options);
  const dispatch = useDispatch();

  const ITEMS_PER_LOAD = 12;
  const visibleCount = Math.min(
    AllProduct.length,
    InitialPage * ITEMS_PER_LOAD
  );
  const progress =
    AllProduct.length > 0
      ? Math.min(100, Math.ceil((visibleCount / AllProduct.length) * 100))
      : 0;

  function pagination() {
    if (visibleCount < AllProduct.length) {
      setInitialPage((prev) => prev + 1);
    }
  }

  function handleShowSlide() {
    setshowSlide(!showSlide);
  }

  const activeSortLabel =
    SORT_OPTIONS.find((s) => s.key === options.sort)?.label || "Default Select";

  return (
    <div className="container px-2.5">
      <div className="flex items-center justify-between border-b border-neutral-200 py-4 relative">
        <button
          type="button"
          onClick={handleShowSlide}
          className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] hover:opacity-70 focus:outline-none cursor-pointer px-2.5 py-1.5 border border-gray-200 rounded"
        >
          {showSlide ? (
            <GoX className="h-4 w-4" />
          ) : (
            <LuSlidersHorizontal className="h-4 w-4" />
          )}
          Filter ({AllProduct.length})
        </button>

        {showSlide && (
          <div className="absolute left-0 top-14 bg-white border border-gray-200 rounded-lg shadow-2xl z-30 max-h-[75vh] overflow-y-auto p-3">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100">
              <span className="text-xs font-bold uppercase text-gray-500">
                Filter Products
              </span>
              <button
                type="button"
                onClick={() => setshowSlide(false)}
                className="text-xs font-semibold text-gray-700 px-2 py-0.5 border border-gray-200 rounded cursor-pointer"
              >
                Done
              </button>
            </div>
            <ShopFilter setCurrentPage={() => setInitialPage(1)} />
          </div>
        )}

        <div className="relative">
          <div
            onClick={() => setDropshowhide(!Dropshowhide)}
            className="flex cursor-pointer items-center w-40 border-b-2 justify-between pb-1"
          >
            <button
              type="button"
              className="cursor-pointer text-[12px] font-medium uppercase whitespace-nowrap font-jost truncate"
            >
              {activeSortLabel}
            </button>
            <span>
              <svg
                width="10"
                height="6"
                viewBox="0 0 10 6"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M4.64332 5.84071C4.83765 6.05309 5.16231 6.05309 5.35713 5.84071L9.85239 0.940372C10.0492 0.725269 10.0492 0.376431 9.85239 0.161873C9.65557 -0.0532294 9.33589 -0.0532294 9.13908 0.161873L5 4.67294L0.861423 0.161327C0.664109 -0.0537752 0.344925 -0.0537752 0.147611 0.161327C-0.0492043 0.37643 -0.0492044 0.725267 0.147611 0.939826L4.64332 5.84071Z"
                  fill="#222222"
                />
              </svg>
            </span>
          </div>
          {Dropshowhide && (
            <div className="bg-white border border-gray-200 shadow-lg px-3 absolute right-0 w-44 z-20 py-2 flex flex-col gap-2.5">
              {SORT_OPTIONS.map((s) => (
                <h3
                  key={s.key}
                  className="cursor-pointer text-[12px] font-medium uppercase whitespace-nowrap font-jost hover:text-[#B9A16B]"
                  onClick={() => {
                    dispatch(setShopOptions({ sort: s.key }));
                    setInitialPage(1);
                    setDropshowhide(false);
                  }}
                >
                  {s.label}
                </h3>
              ))}
            </div>
          )}
        </div>
      </div>

      {AllProduct.length === 0 ? (
        <div className="py-12 px-4 text-center border border-dashed border-gray-300 rounded-lg my-6">
          <p className="text-sm font-semibold text-gray-800">
            No products matched your current filter criteria.
          </p>
          <p className="text-xs text-gray-500 mt-1 mb-4">
            Try clearing your search keyword or adjusting the price range.
          </p>
          <button
            type="button"
            onClick={() => {
              dispatch(resetShopOptions());
              setSearchParams({});
              setInitialPage(1);
            }}
            className="bg-gray-900 text-white text-xs font-semibold uppercase px-5 py-2.5 rounded cursor-pointer"
          >
            Reset All Filters
          </button>
        </div>
      ) : (
        <>
          <div className="grid gap-x-2.5 gap-y-5 grid-cols-2 sm:grid-cols-3 mt-5">
            {AllProduct.slice(0, visibleCount).map((item) => (
              <Product item={item} key={item.id} />
            ))}
          </div>

          <div className="text-center mt-8">
            <h3 className="text-xs font-medium text-gray-600 mb-2">
              SHOWING {visibleCount} OF {AllProduct.length} ITEMS
            </h3>

            <div className="w-full sm:w-75 mx-auto h-1.5 bg-[#E4E4E4] rounded-2xl relative overflow-hidden">
              <div
                className="absolute top-0 left-0 bg-primary h-1.5"
                style={{ width: `${progress}%` }}
              />
            </div>

            {visibleCount < AllProduct.length && (
              <button
                type="button"
                onClick={pagination}
                className="text-sm font-medium relative leading-6 text-primary mt-4.25 after:content-[''] after:absolute after:h-0.5 after:w-0 after:bg-primary hover:after:w-full after:duration-300 cursor-pointer after:transition-all after:bottom-0 after:left-0 pb-1"
              >
                SHOW MORE
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ShopResponsive;
