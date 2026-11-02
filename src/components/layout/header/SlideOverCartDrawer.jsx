import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router";
import { useDispatch, useSelector } from "react-redux";
import { Minus, Plus, ShoppingBag, X } from "lucide-react";
import { MdOutlineDeleteForever } from "react-icons/md";
import {
  quentityDecrease,
  quentityIncrease,
} from "../../../slices/cartSlice";
import { resolveCartItemPricing } from "../../../utils/cartPromotions";
import { resolveProductImage } from "../../../utils/productImage";

const EMPTY_LIST = [];

export default function SlideOverCartDrawer({
  t,
  items,
  catalogProducts: propCatalog,
  totalCartItems,
  subtotalAmount,
  announcement = "",
  onDeleteItem,
  onClose,
  navigate,
}) {
  const dispatch = useDispatch();
  const closeButtonRef = useRef(null);
  const storeCatalog =
    useSelector((state) => state.AllProduct.Products) || EMPTY_LIST;
  const catalogProducts =
    Array.isArray(propCatalog) && propCatalog.length > 0
      ? propCatalog
      : storeCatalog;

  useEffect(() => {
    const btn = closeButtonRef.current;
    if (btn && typeof btn.focus === "function") {
      try {
        btn.focus({ preventScroll: true });
      } catch {
        // ignore
      }
    }
  }, []);

  const drawerUi = (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label="Shopping bag"
      data-testid="shopping-bag-drawer"
    >
      <div
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 bg-black/50 backdrop-blur-[1px]"
      />
      <aside className="fixed inset-x-0 bottom-0 sm:inset-y-0 sm:right-0 sm:left-auto z-50 w-full sm:w-[92vw] sm:max-w-[420px] max-h-[86dvh] sm:max-h-none sm:h-[100dvh] rounded-t-2xl sm:rounded-none bg-white shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 bg-gray-50 border-b border-gray-200 shrink-0">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900">
            {t("nav.cart", "Shopping Bag")} ({totalCartItems})
          </h3>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Close shopping bag"
            onClick={onClose}
            data-testid="drawer-close-btn"
            className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center rounded-lg text-gray-700 hover:bg-gray-200 cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {announcement && (
          <div className="sr-only" role="status" aria-live="polite">
            {announcement}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-3 divide-y divide-gray-100">
          {items.length > 0 ? (
            items.map((item, idx) => {
              const pricing = resolveCartItemPricing(item, catalogProducts);
              const liveMatch = Array.isArray(catalogProducts)
                ? catalogProducts.find((p) => String(p.id) === String(item.id))
                : null;
              const maxStock = Math.max(
                1,
                Number(liveMatch?.stock ?? item.stock ?? 99)
              );
              const qty = Math.max(1, Number(item.quantity || item.qun || 1));
              const atMaxStock = qty >= maxStock;
              const chosenSize = item.size || item.selectedSize || "";
              const chosenColor = item.color || item.selectedColor || "";
              const noteText = String(
                item.optionalMessage || item.specialNote || ""
              ).trim();
              const thumbSrc = resolveProductImage(item, catalogProducts);
              const linePayload = {
                cartLineId: item.cartLineId,
                id: item.id,
                size: chosenSize,
                color: chosenColor,
                optionalMessage: noteText,
                maxStock,
              };

              return (
                <div
                  key={
                    item.cartLineId ||
                    `${item.id}-${chosenSize}-${chosenColor}-${idx}`
                  }
                  data-testid="drawer-cart-item"
                  className="py-3.5 flex gap-3 items-start"
                >
                  <img
                    src={thumbSrc}
                    alt={item.title}
                    className="w-16 h-16 rounded-lg object-contain bg-gray-50 border border-gray-200 shrink-0 p-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-semibold text-gray-900 line-clamp-2">
                        {item.title}
                      </h4>
                      <button
                        type="button"
                        aria-label={`Remove ${item.title}`}
                        onClick={() => onDeleteItem(linePayload)}
                        data-testid="drawer-remove-item"
                        className="text-gray-400 hover:text-red-600 p-1 cursor-pointer shrink-0"
                      >
                        <MdOutlineDeleteForever className="text-lg" />
                      </button>
                    </div>

                    {(chosenSize || chosenColor) && (
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {[
                          chosenSize ? `Size: ${chosenSize}` : "",
                          chosenColor ? `Color: ${chosenColor}` : "",
                        ]
                          .filter(Boolean)
                          .join(" • ")}
                      </p>
                    )}

                    {noteText && (
                      <p
                        data-testid="drawer-item-note"
                        className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 mt-1 break-words"
                      >
                        Note: {noteText}
                      </p>
                    )}

                    <div className="flex items-center justify-between gap-2 mt-2.5">
                      <div className="inline-flex items-center border border-gray-300 rounded-md bg-white">
                        <button
                          type="button"
                          aria-label={
                            qty <= 1
                              ? `Remove ${item.title}`
                              : `Decrease quantity of ${item.title}`
                          }
                          data-testid="drawer-qty-decrease"
                          onClick={() => dispatch(quentityDecrease(linePayload))}
                          className="min-w-[34px] min-h-[34px] flex items-center justify-center text-gray-700 hover:bg-gray-100 cursor-pointer"
                        >
                          <Minus size={13} />
                        </button>
                        <span
                          data-testid="drawer-item-qty"
                          className="min-w-[28px] text-center text-xs font-bold text-gray-900 select-none"
                        >
                          {qty}
                        </span>
                        <button
                          type="button"
                          aria-label={`Increase quantity of ${item.title}`}
                          data-testid="drawer-qty-increase"
                          disabled={atMaxStock}
                          onClick={() => dispatch(quentityIncrease(linePayload))}
                          className="min-w-[34px] min-h-[34px] flex items-center justify-center text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <Plus size={13} />
                        </button>
                      </div>

                      <div className="text-right">
                        <span
                          data-testid="drawer-item-line-price"
                          className="block text-xs font-bold text-gray-900"
                        >
                          ${(pricing.unitPrice * qty).toFixed(2)}
                        </span>
                        {pricing.isDiscountActive && (
                          <span className="block text-[10px] text-gray-400 line-through">
                            ${(pricing.originalPrice * qty).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>

                    {atMaxStock && (
                      <p
                        data-testid="drawer-stock-cap-msg"
                        className="text-[10px] font-medium text-amber-700 mt-1"
                      >
                        Max available stock ({maxStock}) reached
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-16 text-center">
              <ShoppingBag size={36} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm font-semibold text-gray-700">
                Your shopping bag is empty
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate("/shop");
                }}
                className="mt-4 px-5 py-2.5 bg-gray-900 text-white text-xs font-bold uppercase tracking-wider rounded-lg cursor-pointer"
              >
                {t("nav.shopAll", "Explore Collection")}
              </button>
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-gray-200 bg-gray-50 shrink-0">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-600">
                Subtotal
              </span>
              <span
                data-testid="drawer-subtotal"
                className="text-base font-extrabold text-gray-900"
              >
                ${subtotalAmount.toFixed(2)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <Link
                to="/cart"
                onClick={onClose}
                data-testid="drawer-view-cart"
                className="min-h-[44px] rounded-lg border border-gray-900 bg-white text-gray-900 text-xs font-bold uppercase tracking-wider flex items-center justify-center hover:bg-gray-100 transition-colors"
              >
                View Cart
              </Link>
              <Link
                to="/billing"
                onClick={onClose}
                data-testid="drawer-checkout"
                className="min-h-[44px] rounded-lg bg-gray-900 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center hover:bg-gray-800 transition-colors"
              >
                Checkout
              </Link>
            </div>
            <button
              type="button"
              onClick={onClose}
              data-testid="drawer-continue-shopping"
              className="mt-2.5 w-full min-h-[38px] text-xs font-semibold text-gray-600 hover:text-gray-900 underline cursor-pointer"
            >
              Continue Shopping
            </button>
          </div>
        )}
      </aside>
    </div>
  );

  if (typeof document !== "undefined" && document.body) {
    return createPortal(drawerUi, document.body);
  }
  return drawerUi;
}
