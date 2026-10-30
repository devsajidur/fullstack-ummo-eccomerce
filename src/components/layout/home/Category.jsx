import React from "react";
import categorydata from "../../../api/categorydata.json";
import Image from "../common/Image";
import { useNavigate } from "react-router";

const Category = () => {
  const navigate = useNavigate();

  function handleNavigateDepartment(id) {
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (Number(id) === 1) {
      navigate("/category/women");
    } else if (Number(id) === 2) {
      navigate("/category/men");
    } else if (Number(id) === 3) {
      navigate("/category/kids");
    } else {
      navigate("/discounts");
    }
  }

  return (
    <div className="xl:mt-20 lg:mt-10 mt-4 px-3 xl:px-0 mb-3">
      <div className="container">
        <div className="flex flex-col md:grid md:grid-cols-4 gap-3.75 md:gap-3 lg:gap-7.5">
          {categorydata.map((item) => (
            <div
              key={item.id}
              onClick={() => handleNavigateDepartment(item.id)}
              className={`h-64 sm:h-71.25 md:h-auto lg:h-auto w-full relative rounded-lg overflow-hidden cursor-pointer group ${
                item.id == 1
                  ? "col-span-2 row-span-2"
                  : item.id == 2
                    ? "col-span-2"
                    : ""
              }`}
            >
              <Image
                className="h-full w-full object-cover object-[80%] transition-transform duration-500 group-hover:scale-105"
                src={item.image}
                alt={`${item.name} collection`}
                width={480}
                height={320}
                loading={item.id == 1 ? "eager" : "lazy"}
                fetchPriority={item.id == 1 ? "high" : "auto"}
              />
              <div className="absolute bottom-6 left-6 sm:bottom-10 sm:left-10 md:bottom-3 pr-2 md:left-3 lg:left-5 lg:bottom-5 xl:bottom-10 xl:left-10">
                <h3 className="uppercase text-xs md:text-[12px] lg:text-sm leading-6 font-semibold tracking-wider text-primary">
                  hot list
                </h3>
                <h2 className="uppercase font-medium text-[20px] sm:text-[22px] md:text-[16px] lg:text-[18px] xl:text-[26px] text-primary">
                  <span className="font-bold block lg:inline">{item.name}</span>{" "}
                  collection
                </h2>
                {item.id == 4 && (
                  <p className="text-[13px] lg:text-sm md:text-[12px] leading-5 lg:leading-6 md:leading-4 font-normal text-primary max-w-53.25 xl:mt-2 mb-3 xl:mb-4 md:mb-1">
                    Surprise someone with the gift they really want.
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNavigateDepartment(item.id);
                    }}
                    className='uppercase text-primary font-bold text-xs lg:text-sm cursor-pointer md:text-[12px] leading-6 after:content-[""] after:w-8 group-hover:after:w-14 after:duration-300 after:h-0.5 after:bg-primary after:absolute after:bottom-0 relative after:left-0'
                  >
                    {item.id == 4 ? "DISCOVER DEALS" : "SHOP NOW"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Category;
