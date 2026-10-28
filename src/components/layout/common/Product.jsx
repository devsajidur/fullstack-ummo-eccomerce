import React from "react";
import Image from "./Image";
import { useDispatch, useSelector } from "react-redux";
import { addToCart } from "../../../slices/cartSlice";
import {
  addWishList,
  deleteWishEndevisual,
} from "../../../slices/wishListSlice";
import { productDetail } from "../../../slices/ProductDetailsSlice";
import { useNavigate } from "react-router";
import toast from "react-hot-toast";

const Product = ({ item }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const wishList = useSelector((state) => state.wishList.wishProduct) || [];
  const isWished = wishList.some((w) => String(w.id) === String(item?.id));

  function handleAddtoCart(Citem) {
    dispatch(
      addToCart({
        id: Citem.id,
        title: Citem.title,
        price: Citem.price,
        image: Citem.thumbnail,
      })
    );
    toast.success(`"${Citem.title}" added to cart!`);
  }

  const handleToggleWish = () => {
    if (isWished) {
      dispatch(deleteWishEndevisual(item));
      toast("Removed from wishlist", { icon: "🗑️" });
    } else {
      dispatch(addWishList(item));
      toast.success("Saved to wishlist ❤️");
    }
  };

  const handleProductDetails = (dtail) => {
    dispatch(productDetail(dtail));
    navigate(`/shopsingle?id=${dtail.id}`);
  };

  return (
    <div className="max-w-82.5 group relative">
      <div
        onClick={() => handleProductDetails(item)}
        className="cursor-pointer relative overflow-hidden"
      >
        <Image
          className="md:h-80 md:w-50 h-40 w-30 block mx-auto object-contain transition-transform duration-300 group-hover:scale-105"
          src={item?.thumbnail}
          alt={item?.title}
        />
        {Number(item?.discountPercentage) >= 10 && (
          <span className="absolute top-2 left-2 bg-[#D6001C] text-white text-[10px] font-bold px-2 py-0.5 rounded-sm">
            -{Math.round(Number(item.discountPercentage))}%
          </span>
        )}
      </div>
      <div className="mt-3.2">
        <div className="flex justify-between items-center h-5">
          <h4 className="text-[12px] md:text-sm text-gray font-normal uppercase truncate pr-2">
            {item?.category}
          </h4>
          <button
            type="button"
            aria-label="Toggle Wishlist"
            className="cursor-pointer shrink-0"
            onClick={handleToggleWish}
          >
            {isWished ? (
              <span className="text-[15px]">❤️</span>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <g clipPath="url(#clip0_31_61)">
                  <path
                    d="M14.7145 2.64647C12.9744 0.906815 10.1436 0.906815 8.40393 2.64647L7.99986 3.0503L7.59603 2.64647C5.85637 0.906579 3.02531 0.906579 1.28565 2.64647C-0.418689 4.35081 -0.429756 7.05236 1.25998 8.93071C2.80114 10.6433 7.34643 14.3432 7.53928 14.4998C7.6702 14.6063 7.82773 14.6581 7.98432 14.6581C7.9895 14.6581 7.99468 14.6581 7.99963 14.6578C8.16163 14.6654 8.32481 14.6098 8.45997 14.4998C8.65282 14.3432 13.1986 10.6433 14.7402 8.93048C16.4297 7.05236 16.4186 4.35081 14.7145 2.64647ZM13.69 7.98554C12.4884 9.32042 9.18546 12.0735 7.99963 13.0505C6.8138 12.0738 3.51155 9.32089 2.31018 7.98577C1.13142 6.67561 1.12035 4.80974 2.28452 3.64557C2.87908 3.05125 3.6599 2.75385 4.44072 2.75385C5.22154 2.75385 6.00236 3.05101 6.59693 3.64557L7.48512 4.53377C7.59085 4.6395 7.72412 4.7026 7.86399 4.72474C8.09099 4.77348 8.33729 4.71014 8.51389 4.53401L9.40256 3.64557C10.5919 2.45668 12.5266 2.45692 13.7152 3.64557C14.8794 4.80974 14.8683 6.67561 13.69 7.98554Z"
                    fill="#767676"
                  />
                </g>
                <defs>
                  <clipPath id="clip0_31_61">
                    <rect width="16" height="16" fill="white" />
                  </clipPath>
                </defs>
              </svg>
            )}
          </button>
        </div>
        <h3
          onClick={() => handleProductDetails(item)}
          className="cursor-pointer clamp font-medium text-sm text-primary hover:underline"
        >
          {item?.title}
        </h3>
        <div className="flex items-center justify-between mt-0.5">
          <h5 className="md:text-base text-[14px] text-primary font-semibold uppercase">
            ${item?.price}
          </h5>
          {item?.rating && (
            <span className="text-[11px] text-amber-600 font-medium">
              ★ {Number(item.rating).toFixed(1)}
            </span>
          )}
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={() => handleAddtoCart(item)}
          className="absolute md:invisible md:group-hover:visible cursor-pointer bottom-18 md:bottom-25 left-[50%] translate-[-50%] w-[90%] md:w-77.5 shadow-xl shadow-[#3333335b] font-medium text-[12px] md:text-sm bg-white hover:bg-black hover:text-white transition-colors text-black h-7 md:h-12.5 text-center"
        >
          ADD TO CART
        </button>
      </div>
    </div>
  );
};

export default Product;
