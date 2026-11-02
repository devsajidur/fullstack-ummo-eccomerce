import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { Gift, MessageSquare, Minus, Plus, X } from "lucide-react";
import Image from "../../layout/common/Image";
import {
  quentityDecrease,
  quentityIncrease,
  updateItemMessage,
  RemoveItem,
  sanitizeClientProductMessage,
} from "../../../slices/cartSlice";
import {
  evaluateCartItemFreeGift,
  resolveCartItemPricing,
} from "../../../utils/cartPromotions";

const EMPTY_LIST = [];

const CartProduct = (props) => {
  const dispatch = useDispatch();
  const catalogProducts =
    useSelector((state) => state.AllProduct.Products) || EMPTY_LIST;

  const liveMatch = catalogProducts.find(
    (p) => String(p.id) === String(props.id)
  );
  const maxStock = Math.max(1, Number(liveMatch?.stock ?? props.stock ?? 99));
  const qty = Math.max(1, Number(props.quantity || 1));
  const atMaxStock = qty >= maxStock;

  const chosenSize = String(props.size ?? props.selectedSize ?? "").trim();
  const chosenColor = String(props.color ?? props.selectedColor ?? "").trim();
  const itemMsg = props.optionalMessage || "";

  const lineTarget = {
    cartLineId: props.cartLineId,
    id: props.id,
    size: chosenSize,
    color: chosenColor,
    optionalMessage: itemMsg,
    maxStock,
  };

  const handleIncrease = () => {
    dispatch(quentityIncrease(lineTarget));
  };

  const handleDecrease = () => {
    dispatch(quentityDecrease(lineTarget));
  };

  const handleRemove = () => {
    dispatch(RemoveItem(lineTarget));
  };

  const handleMessageChange = (e) => {
    dispatch(
      updateItemMessage({
        ...lineTarget,
        optionalMessage: sanitizeClientProductMessage(e.target.value),
      })
    );
  };

  const freeGiftState = evaluateCartItemFreeGift(props, catalogProducts);
  const pricing = resolveCartItemPricing(props, catalogProducts);
  const variantLabelParts = [
    chosenSize ? `Size: ${chosenSize}` : "",
    chosenColor ? `Color: ${chosenColor}` : "",
  ].filter(Boolean);

  return (
    <div
      data-testid="cart-page-item"
      className="py-5 sm:py-6 border-b border-[#E4E4E4] grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_96px_124px_100px_36px] gap-4 sm:items-center"
    >
      {/* Product Info + Variant + Optional Message */}
      <div className="flex items-start gap-3.5 sm:gap-5 min-w-0">
        <Image
          className="h-22 w-22 sm:h-26 sm:w-26 object-contain shrink-0 bg-gray-50 rounded-lg border border-gray-100 p-1"
          item={props}
          src={props.image || props.thumbnail}
          alt={props.title}
          width={104}
          height={104}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-medium text-primary break-words">
                {props.title}
              </h2>
              {variantLabelParts.length > 0 && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {variantLabelParts.join(" • ")}
                </p>
              )}
            </div>
            {/* Mobile remove button */}
            <button
              type="button"
              aria-label={`Remove ${props.title}`}
              onClick={handleRemove}
              className="sm:hidden min-w-[36px] min-h-[36px] -mr-1.5 -mt-1 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-gray-100 cursor-pointer shrink-0"
            >
              <X size={16} />
            </button>
          </div>

          {/* Mobile unit price */}
          <div className="flex sm:hidden items-center gap-2 mt-1">
            <span
              className={`text-xs font-semibold ${
                pricing.isDiscountActive ? "text-[#D6001C]" : "text-gray-700"
              }`}
            >
              Unit: ${pricing.unitPrice.toFixed(2)}
            </span>
            {pricing.isDiscountActive && (
              <span className="text-[11px] text-gray-400 line-through">
                ${pricing.originalPrice.toFixed(2)}
              </span>
            )}
          </div>

          {/* Product-Specific Optional Message Editor */}
          <div className="mt-2.5 max-w-md">
            <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
              <label
                htmlFor={`cart-msg-${props.cartLineId || props.id}`}
                className="inline-flex items-center gap-1 font-medium text-gray-600"
              >
                <MessageSquare size={11} /> Message for this product (optional)
              </label>
              <span className="font-mono text-[10px]">{itemMsg.length}/500</span>
            </div>
            <input
              id={`cart-msg-${props.cartLineId || props.id}`}
              type="text"
              maxLength={500}
              value={itemMsg}
              onChange={handleMessageChange}
              data-testid="cart-item-message-input"
              placeholder="Add note for this item (e.g. gift wrap, pack separately)..."
              className="w-full border border-gray-200 rounded px-2.5 py-1.5 text-xs text-primary bg-gray-50/70 focus:bg-white focus:border-primary outline-none transition-colors"
            />
          </div>

          {/* Per-Product Free Gift Status */}
          {freeGiftState.hasFreeGiftRule && freeGiftState.unlocked && (
            <div className="mt-2 inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-2.5 py-1 rounded-md text-xs">
              <Gift size={13} className="text-emerald-600 shrink-0" />
              <span className="font-semibold">
                FREE GIFT: {freeGiftState.earnedGiftQty}×{" "}
                {freeGiftState.giftName}{" "}
                <strong className="text-emerald-700">($0.00)</strong>
              </span>
            </div>
          )}

          {freeGiftState.hasFreeGiftRule &&
            !freeGiftState.unlocked &&
            !atMaxStock && (
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

      {/* Desktop Unit Price */}
      <div className="hidden sm:block text-right">
        <span
          className={`text-sm font-semibold ${
            pricing.isDiscountActive ? "text-[#D6001C]" : "text-gray-700"
          }`}
        >
          ${pricing.unitPrice.toFixed(2)}
        </span>
        {pricing.isDiscountActive && (
          <div className="flex items-center justify-end gap-1 mt-0.5">
            <span className="text-xs text-gray-400 line-through">
              ${pricing.originalPrice.toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {/* Quantity Stepper + Mobile Subtotal Row */}
      <div className="flex items-center justify-between sm:justify-center gap-3">
        <div className="flex flex-col items-start sm:items-center">
          <div className="inline-flex items-center border-2 border-[#E4E4E4] rounded-md bg-white">
            <button
              type="button"
              aria-label={
                qty <= 1
                  ? `Remove ${props.title}`
                  : `Decrease quantity of ${props.title}`
              }
              data-testid="cart-qty-decrease"
              className="min-w-[38px] min-h-[38px] flex items-center justify-center cursor-pointer text-gray-700 hover:bg-gray-100"
              onClick={handleDecrease}
            >
              <Minus size={14} />
            </button>
            <span
              data-testid="cart-item-qty"
              className="min-w-[32px] text-center text-sm font-bold text-primary select-none"
            >
              {qty}
            </span>
            <button
              type="button"
              aria-label={`Increase quantity of ${props.title}`}
              data-testid="cart-qty-increase"
              disabled={atMaxStock}
              className="min-w-[38px] min-h-[38px] flex items-center justify-center cursor-pointer text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={handleIncrease}
            >
              <Plus size={14} />
            </button>
          </div>
          {atMaxStock && (
            <span
              data-testid="cart-stock-cap-msg"
              className="text-[10px] font-medium text-amber-700 mt-1"
            >
              Max stock ({maxStock})
            </span>
          )}
        </div>

        {/* Mobile line total */}
        <span className="sm:hidden text-sm font-bold text-primary">
          ${(qty * pricing.unitPrice).toFixed(2)}
        </span>
      </div>

      {/* Desktop Line Subtotal */}
      <div className="hidden sm:block text-right">
        <span
          data-testid="cart-item-subtotal"
          className="text-base font-semibold text-primary"
        >
          ${(qty * pricing.unitPrice).toFixed(2)}
        </span>
      </div>

      {/* Desktop Remove Action */}
      <div className="hidden sm:flex justify-end">
        <button
          type="button"
          aria-label={`Remove ${props.title}`}
          data-testid="cart-remove-item"
          className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-gray-100 cursor-pointer transition-colors"
          onClick={handleRemove}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default CartProduct;
