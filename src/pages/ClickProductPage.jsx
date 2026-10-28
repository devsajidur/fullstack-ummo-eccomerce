import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import Product from "../components/layout/common/Product";
import { useNavigate } from "react-router";
import { fetchCatalogProducts } from "../services/api";
import { Click } from "../slices/clickCategorySlice";

const ClickProductPage = () => {
  const Clickproduct =
    useSelector((state) => state.clickCategory.categoryProduct) || [];
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Fallback if user reloads /clickproduct directly
  useEffect(() => {
    if (Clickproduct.length === 0) {
      fetchCatalogProducts(24)
        .then((list) => {
          dispatch(Click(list));
        })
        .catch(() => {});
    }
  }, [Clickproduct.length, dispatch]);

  return (
    <div className="container px-2.5 my-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="capitalize text-sm font-medium text-gray-600">
          <span
            className="cursor-pointer hover:text-black font-semibold"
            onClick={() => navigate("/")}
          >
            Home
          </span>{" "}
          / Collection ({Clickproduct.length})
        </h2>
        <button
          type="button"
          onClick={() => navigate("/shop")}
          className="text-xs font-semibold underline cursor-pointer"
        >
          Open Full Shop Filter →
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-3.75">
        {Clickproduct.map((item) => (
          <Product key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
};

export default ClickProductPage;
