import { useDispatch, useSelector } from "react-redux";
import Image from "../../layout/common/Image";
import {
  quentityDecrease,
  quentityIncrease,
  RemoveItem,
} from "../../../slices/cartSlice";
import { Gift } from "lucide-react";
import { evaluateCartItemFreeGift } from "../../../utils/cartPromotions";

const EMPTY_LIST = [];

const CartProduct = (props) => {
  const dispatch = useDispatch();
  const catalogProducts =
    useSelector((state) => state.AllProduct.Products) || EMPTY_LIST;

  const handleIncrease = () => {
    dispatch(quentityIncrease(props));
  };
  const handleDecrease = () => {
    dispatch(quentityDecrease(props));
  };
  const handleRemove = () => {
    dispatch(RemoveItem(props));
  };

  const freeGiftState = evaluateCartItemFreeGift(props, catalogProducts);

  return (
    <>
      {/* Desktop / Tablet cart row */}
      <div className="sm:flex lg:gap-15 gap-7 hidden w-full lg:w-150 xl:w-230 items-center py-7.5 border-b border-[#E4E4E4]">
        <div className="flex items-center gap-4 xl:gap-7.5">
          <Image
            className="h-30 w-30 object-contain shrink-0"
            src={props.image}
            alt={props.title}
          />
          <div className="xl:w-70">
            <h2 className="text-[16px] font-normal text-primary">
              {props.title}
            </h2>
            {(props.size || props.color) && (
              <p className="text-xs text-gray-400 mt-1">
                Size: {props.size || "M"} | Color: {props.color || "Default"}
              </p>
            )}

            {/* Per-Product Free Gift Status (Only if Admin enabled a Free Gift on this product) */}
            {freeGiftState.hasFreeGiftRule && freeGiftState.unlocked && (
              <div className="mt-2 inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-2.5 py-1.5 rounded-md text-xs">
                {freeGiftState.giftImage ? (
                  <img
                    src={freeGiftState.giftImage}
                    alt={freeGiftState.giftName}
                    className="w-6 h-6 rounded object-contain bg-white border border-emerald-200 shrink-0"
                  />
                ) : (
                  <Gift size={13} className="text-emerald-600 shrink-0" />
                )}
                <span className="font-semibold">
                  FREE GIFT: {freeGiftState.earnedGiftQty}×{" "}
                  {freeGiftState.giftName}{" "}
                  <strong className="text-emerald-700">($0.00)</strong>
                </span>
              </div>
            )}

            {freeGiftState.hasFreeGiftRule && !freeGiftState.unlocked && (
              <button
                type="button"
                onClick={handleIncrease}
                className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-1 rounded cursor-pointer transition-colors"
              >
                <Gift size={12} /> Buy {freeGiftState.minBuyQty} to get{" "}
                {freeGiftState.giftQtyPerBundle}× {freeGiftState.giftName} FREE
                (+ Add {freeGiftState.qtyNeededToUnlock} more)
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center w-2/4 justify-between">
          <h3 className="xl:mr-15 text-[16px] font-normal text-gray">
            ${Number(props.price || 0).toFixed(2)}
          </h3>
          <div className="xl:h-12.5 xl:w-27.5 h-10 w-20 xl:mr-20.5 leading-12.5 flex justify-between items-center lg:px-3.75 border-3 border-[#E4E4E4]">
            <button
              type="button"
              className="px-2 cursor-pointer text-[16px] text-gray font-normal"
              onClick={handleDecrease}
            >
              -
            </button>
            <span className="text-[16px] text-gray font-normal">
              {props.quantity}
            </span>
            <button
              type="button"
              className="px-2 cursor-pointer text-[16px] text-gray font-normal"
              onClick={handleIncrease}
            >
              +
            </button>
          </div>
          <h3 className="text-[16px] font-medium text-primary">
            $
            {(Number(props.quantity || 1) * Number(props.price || 0)).toFixed(
              2
            )}
          </h3>

          <h2 className="xl:ml-15">
            <button
              type="button"
              aria-label="Remove item"
              className="cursor-pointer p-1"
              onClick={handleRemove}
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M0.259435 8.85506L9.11449 0L10 0.885506L1.14494 9.74056L0.259435 8.85506Z"
                  fill="#767676"
                />
                <path
                  d="M0.885506 0.0889838L9.74057 8.94404L8.85506 9.82955L0 0.97449L0.885506 0.0889838Z"
                  fill="#767676"
                />
              </svg>
            </button>
          </h2>
        </div>
      </div>

      {/* Mobile responsive cart row (< 640px) */}
      <div className="flex sm:hidden gap-3.5 w-full items-start py-5 border-b border-[#E4E4E4]">
        <Image
          className="h-20 w-20 object-contain bg-gray-50 rounded shrink-0"
          src={props.image}
          alt={props.title}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-sm font-medium text-primary truncate">
                {props.title}
              </h2>
              {(props.size || props.color) && (
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Size: {props.size || "M"} • Color: {props.color || "Default"}
                </p>
              )}
            </div>
            <button
              type="button"
              aria-label="Remove item"
              className="cursor-pointer p-1.5 text-gray-400 hover:text-red-500 shrink-0"
              onClick={handleRemove}
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M0.259435 8.85506L9.11449 0L10 0.885506L1.14494 9.74056L0.259435 8.85506Z"
                  fill="currentColor"
                />
                <path
                  d="M0.885506 0.0889838L9.74057 8.94404L8.85506 9.82955L0 0.97449L0.885506 0.0889838Z"
                  fill="currentColor"
                />
              </svg>
            </button>
          </div>

          <p className="text-xs text-gray mt-1">
            Unit: ${Number(props.price || 0).toFixed(2)}
          </p>

          {freeGiftState.hasFreeGiftRule && freeGiftState.unlocked && (
            <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded">
              <Gift size={10} /> Free Gift: {freeGiftState.earnedGiftQty}×{" "}
              {freeGiftState.giftName} ($0.00)
            </span>
          )}

          {freeGiftState.hasFreeGiftRule && !freeGiftState.unlocked && (
            <button
              type="button"
              onClick={handleIncrease}
              className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-1 rounded cursor-pointer"
            >
              <Gift size={11} /> + Add {freeGiftState.qtyNeededToUnlock} more for
              FREE {freeGiftState.giftName}
            </button>
          )}

          <div className="flex items-center justify-between mt-3">
            <div className="px-2.5 h-8 w-22 flex justify-between items-center border-2 border-[#E4E4E4]">
              <button
                type="button"
                className="cursor-pointer text-sm text-gray font-medium px-1"
                onClick={handleDecrease}
              >
                -
              </button>
              <span className="text-sm text-primary font-medium">
                {props.quantity}
              </span>
              <button
                type="button"
                className="cursor-pointer text-sm text-gray font-medium px-1"
                onClick={handleIncrease}
              >
                +
              </button>
            </div>
            <h3 className="text-sm font-semibold text-primary">
              $
              {(Number(props.quantity || 1) * Number(props.price || 0)).toFixed(
                2
              )}
            </h3>
          </div>
        </div>
      </div>
    </>
  );
};

export default CartProduct;
