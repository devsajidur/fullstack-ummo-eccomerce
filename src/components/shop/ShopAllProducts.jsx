import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import Breadcrumb from "../layout/common/Breadcrumb";
import Product from "../layout/common/Product";
import { useDispatch, useSelector } from "react-redux";
import {
  addProduct,
  resetShopOptions,
  setShopOptions,
} from "../../slices/productSlice";
import ResponsivePagination from "react-responsive-pagination";
import "react-responsive-pagination/themes/classic-light-dark.css";
import { fetchCatalogProducts } from "../../services/api";

const SORT_LABELS = {
  default: "Default Select",
  low: "Price: Low to High",
  high: "Price: High to Low",
  rating: "Highest Rated",
  discount: "Biggest Discount",
};

const ShopAllProducts = ({ currentPage, setCurrentPage }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setview] = useState(3);
  const [loading, setloading] = useState(true);
  const FilterProduct = useSelector((state) => state.Products.filter);
  const [Dropshowhide, setDropshowhide] = useState(false);
  const options = useSelector((state) => state.Products.options);
  const dispatch = useDispatch();

  // Sync URL query params (?q=...&category=...&sort=...) into Redux filter options
  useEffect(() => {
    const qParam = searchParams.get("q");
    const catParam = searchParams.get("category");
    const sortParam = searchParams.get("sort");

    const updates = {};
    if (qParam !== null) updates.searchQuery = qParam;
    if (catParam !== null) updates.category = catParam;
    if (sortParam !== null) updates.sort = sortParam;

    if (Object.keys(updates).length > 0) {
      dispatch(setShopOptions(updates));
    }
  }, [searchParams, dispatch]);

  useEffect(() => {
    fetchCatalogProducts(200)
      .then((products) => {
        dispatch(addProduct(products));
        setloading(false);
      })
      .catch((err) => {
        setloading(false);
        console.error(err);
      });
  }, [dispatch]);

  const displayProducts = FilterProduct || [];
  const totalPages = Math.max(1, Math.ceil(displayProducts.length / 12));
  const fasttidx = (currentPage - 1) * 12;
  const lastidx = fasttidx + 12;

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages, setCurrentPage]);

  function handleview(hup) {
    setview(hup);
  }

  if (loading) {
    return (
      <div className="grid grid-cols-3 2xl:grid-cols-4 gap-5 content-start w-full">
        {Array.from({ length: 8 }, (_, idx) => (
          <div
            key={idx}
            role="status"
            className="h-75 p-4 border border-gray-200 rounded-2xl shadow-xs animate-pulse md:p-6"
          >
            <div className="flex items-center justify-center h-40 w-full bg-gray-100 rounded mb-4" />
            <div className="h-2.5 bg-gray-200 rounded-full w-32 mb-4" />
            <div className="h-2 bg-gray-200 rounded-full mb-2.5" />
            <div className="h-2 bg-gray-200 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="w-full px-2">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-3">
          <Breadcrumb />
          <span className="text-xs text-gray-500 hidden sm:inline">
            ({displayProducts.length} items)
          </span>
        </div>

        <div className="flex items-center">
          {/* Dropdown sorting */}
          <div className="relative">
            <div
              onClick={() => setDropshowhide(!Dropshowhide)}
              className="flex cursor-pointer items-center w-44 border-b-2 justify-between pb-1"
            >
              <button
                type="button"
                className="cursor-pointer text-xs sm:text-sm font-medium uppercase whitespace-nowrap font-jost"
              >
                {SORT_LABELS[options.sort] || "Default Select"}
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
              <div className="bg-white border border-gray-200 shadow-lg px-3 absolute w-full z-20 py-2 flex flex-col gap-2">
                {Object.entries(SORT_LABELS).map(([key, label]) => (
                  <h3
                    key={key}
                    className="cursor-pointer text-xs font-medium uppercase whitespace-nowrap font-jost hover:text-[#B9A16B]"
                    onClick={() => {
                      dispatch(setShopOptions({ sort: key }));
                      setCurrentPage(1);
                      setDropshowhide(false);
                    }}
                  >
                    {label}
                  </h3>
                ))}
              </div>
            )}
          </div>

          <div className="border-l-4 ml-3 xl:ml-7.5 border-[#e4e4e4] xl:pl-7.5 pl-3 hidden xl:block">
            <ul className="flex font-medium text-sm text-primary uppercase gap-2.75">
              <li>view</li>
              {[2, 3, 4].map((cols) => (
                <li
                  key={cols}
                  onClick={() => handleview(cols)}
                  className={`cursor-pointer ${
                    view === cols ? "font-bold underline" : ""
                  }`}
                >
                  {cols}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {displayProducts.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-gray-300 rounded-lg my-6">
          <p className="text-base font-semibold text-gray-800">
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
              setCurrentPage(1);
            }}
            className="bg-gray-900 text-white text-xs font-semibold uppercase px-5 py-2.5 rounded cursor-pointer hover:bg-gray-800"
          >
            Reset All Filters
          </button>
        </div>
      ) : (
        <>
          <div
            style={
              view === 2
                ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }
                : view === 4
                ? {
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr 1fr",
                    columnGap: "20px",
                  }
                : {
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    columnGap: "12px",
                  }
            }
          >
            {displayProducts.slice(fasttidx, lastidx).map((item) => (
              <Product item={item} key={item.id} />
            ))}
          </div>

          <div className="mt-10 text-center">
            <ResponsivePagination
              current={currentPage}
              total={totalPages}
              onPageChange={setCurrentPage}
              previousLabel={
                <span className="flex items-center uppercase text-sm font-medium gap-2.5 mr-5">
                  Prev
                </span>
              }
              nextLabel={
                <span className="flex items-center gap-2.5 uppercase ml-5">
                  Next
                </span>
              }
            />
          </div>
        </>
      )}
    </div>
  );
};

export default ShopAllProducts;
