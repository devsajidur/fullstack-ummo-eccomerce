import React, { useEffect, useState } from "react";
import Title from "../common/Title";
import treadydata from "../../../api/treadydata.json";
import Product from "../common/Product";
import { useDispatch, useSelector } from "react-redux";
import { Allitem } from "../../../slices/AllProductSlice";
import { fetchCatalogProducts } from "../../../services/api";

const TrendyProducts = () => {
  const [activeCategory, setActiveCategory] = useState("all");
  const reduxProducts = useSelector((state) => state.AllProduct.Products);
  const [localProducts, setLocalProducts] = useState([]);
  const [showAllProducts, setShowAllProducts] = useState(false);
  const dispatch = useDispatch();

  useEffect(() => {
    fetchCatalogProducts(200)
      .then((list) => {
        setLocalProducts(list);
        dispatch(Allitem(list));
      })
      .catch((err) => {
        console.error(err);
      });
  }, [dispatch]);

  const products = reduxProducts?.length ? reduxProducts : localProducts;

  const filterProducts =
    activeCategory === "all"
      ? []
      : products.filter((item) => item.category === activeCategory);

  function handleTabs(category) {
    setActiveCategory(category);
  }

  function handleProductShow() {
    setShowAllProducts(!showAllProducts);
  }

  return (
    <section className="mt-9 mb-12 md:mt-20 md:mb-24 px-4 sm:px-6 xl:px-0 overflow-x-hidden">
      <div className="container mx-auto">
        <Title name="our trendy" namebold="products" />

        <ul className="flex justify-center flex-wrap gap-x-4 sm:gap-x-8 md:gap-x-12 gap-y-2 mb-5 lg:mb-10 mt-3 lg:mt-7">
          {treadydata.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => handleTabs(item.name)}
                className={`text-[13px] sm:text-sm md:text-base after:bg-primary relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:duration-300 after:content-[""] hover:after:w-[70%] font-medium cursor-pointer uppercase whitespace-nowrap ${
                  item.name === activeCategory ? "text-primary" : "text-gray"
                }`}
              >
                {item.name}
              </button>
            </li>
          ))}
        </ul>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5 justify-center">
          {activeCategory !== "all"
            ? filterProducts
                .slice(0, 8)
                .map((item) => <Product item={item} key={item.id} />)
            : !showAllProducts
            ? products
                .slice(0, 8)
                .map((item) => <Product item={item} key={item.id} />)
            : products
                .slice(0, 20)
                .map((item) => <Product item={item} key={item.id} />)}
        </div>

        {activeCategory === "all" && (
          <div className="text-center">
            <button
              onClick={handleProductShow}
              className='font-medium text-xs sm:text-sm relative leading-6 text-primary after:absolute after:bottom-0 after:left-0 after:h-0.5 after:bg-primary after:w-0 after:duration-300 after:content-[""] mt-6 md:mt-10 hover:after:w-[70%] cursor-pointer'
            >
              {showAllProducts ? "SEE LESS PRODUCT" : "SEE ALL PRODUCT"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default TrendyProducts;
