import { useState } from "react";
import { LuSlidersHorizontal } from "react-icons/lu";
import { useDispatch, useSelector } from "react-redux";
import { setShopOptions } from "../../slices/productSlice";
import Product from "../layout/common/Product";
import ShopFilter from "./ShopFilter";
import { GoX } from "react-icons/go";

const ShopResponsive = () => {
  const [Dropshowhide, setDropshowhide] = useState(false);
  const [InitialPage, setInitialPage] = useState(1);
  const [showSlide, setshowSlide] = useState(false);
  const AllProduct = useSelector((state) => state.Products.filter) || [];
  const options = useSelector((state) => state.Products.options);
  const dispatch = useDispatch();

  const ITEMS_PER_LOAD = 12;
  const visibleCount = Math.min(AllProduct.length, InitialPage * ITEMS_PER_LOAD);
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

  return (
    <div className="container px-2.5">
      <div className="flex items-center justify-between border-b border-neutral-200 py-4 relative">
        <button
          type="button"
          onClick={handleShowSlide}
          className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.15em] hover:opacity-70 focus:outline-none cursor-pointer"
        >
          {showSlide ? (
            <GoX className="h-4 w-4" />
          ) : (
            <LuSlidersHorizontal className="h-4 w-4" />
          )}
          Filter
        </button>

        <div
          className={`absolute bg-white border border-gray-200 shadow-xl z-30 top-13 ${
            showSlide ? "left-0" : "-left-full"
          } duration-300 transition-all h-120 overflow-auto p-2`}
        >
          <ShopFilter setCurrentPage={() => setInitialPage(1)} />
        </div>

        <div className="relative">
          <div
            onClick={() => setDropshowhide(!Dropshowhide)}
            className="flex cursor-pointer items-center w-36 border-b-2 justify-between"
          >
            <button
              type="button"
              className="cursor-pointer text-[12px] font-medium uppercase whitespace-nowrap font-jost"
            >
              {options.sort === "low"
                ? "Low to High"
                : options.sort === "high"
                ? "High to Low"
                : options.sort === "rating"
                ? "Top Rated"
                : "Default Select"}
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
            <div className="bg-white border border-gray-200 shadow-lg px-2 absolute w-full z-20 py-2 flex flex-col gap-2.5">
              {[
                { key: "default", label: "Default Select" },
                { key: "low", label: "Low to High" },
                { key: "high", label: "High to Low" },
                { key: "rating", label: "Top Rated" },
              ].map((s) => (
                <h3
                  key={s.key}
                  className="cursor-pointer text-[12px] font-medium uppercase whitespace-nowrap font-jost"
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

      <div className="grid gap-x-2 gap-y-4 grid-cols-2 sm:grid-cols-3 mt-5">
        {AllProduct.slice(0, visibleCount).map((item) => (
          <Product item={item} key={item.id} />
        ))}
      </div>

      <div className="text-center mt-6">
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
    </div>
  );
};

export default ShopResponsive;
