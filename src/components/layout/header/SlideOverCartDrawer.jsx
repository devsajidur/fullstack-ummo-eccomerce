import React from "react";
import { Link } from "react-router";
import { ShoppingBag, X } from "lucide-react";
import { MdOutlineDeleteForever } from "react-icons/md";
import { getProductDiscountState } from "../../../utils/discountTimer";

export default function SlideOverCartDrawer({
  t,
  items,
  totalCartItems,
  subtotalAmount,
  onDeleteItem,
  onClose,
  navigate,
}) {
  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label="Shopping bag"
    >
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/50 backdrop-blur-[1px]"
      />
      <aside className="fixed top-0 right-0 bottom-0 z-50 w-[90vw] max-w-[400px] h-[100dvh] bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 bg-gray-50 border-b border-gray-200 shrink-0">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900">
            {t("nav.cart", "Shopping Bag")} ({totalCartItems})
          </h3>
          <button
            type="button"
            aria-label="Close shopping bag"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center rounded-lg text-gray-700 hover:bg-gray-200 cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 divide-y divide-gray-100">
          {items.length > 0 ? (
            items.map((item) => {
              const ds = getProductDiscountState(item);
              const qty = Math.max(1, Number(item.quantity || item.qun || 1));
              return (
                <div
                  key={
                    item.cartLineId ||
                    `${item.id}-${item.selectedSize || ""}-${item.selectedColor || ""}`
                  }
                  className="py-3.5 flex gap-3 items-start"
                >
                  <img
                    src={item.thumbnail || item.image}
                    alt={item.title}
                    className="w-16 h-16 rounded-lg object-cover bg-gray-100 border border-gray-200 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-semibold text-gray-900 line-clamp-1">
                        {item.title}
                      </h4>
                      <button
                        type="button"
                        aria-label={`Remove ${item.title}`}
                        onClick={() => onDeleteItem(item)}
                        className="text-gray-400 hover:text-red-600 p-1 cursor-pointer"
                      >
                        <MdOutlineDeleteForever className="text-lg" />
                      </button>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Qty: <strong className="text-gray-800">{qty}</strong>
                      {item.selectedSize ? ` • Size: ${item.selectedSize}` : ""}
                      {item.selectedColor
                        ? ` • Color: ${item.selectedColor}`
                        : ""}
                    </p>
                    {(item.optionalMessage || item.specialNote) && (
                      <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 mt-1 line-clamp-1">
                        Note: {item.optionalMessage || item.specialNote}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-xs font-bold text-gray-900">
                        ${(ds.effectivePrice * qty).toFixed(2)}
                      </span>
                      {ds.isDiscountActive && (
                        <span className="text-[11px] text-gray-400 line-through">
                          ${(ds.regularPrice * qty).toFixed(2)}
                        </span>
                      )}
                    </div>
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
          <div className="p-4 border-t border-gray-200 bg-gray-50 shrink-0 safe-area-bottom">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-600">
                Subtotal
              </span>
              <span className="text-base font-extrabold text-gray-900">
                ${subtotalAmount.toFixed(2)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <Link
                to="/cart"
                onClick={onClose}
                className="min-h-[44px] rounded-lg border border-gray-900 bg-white text-gray-900 text-xs font-bold uppercase tracking-wider flex items-center justify-center hover:bg-gray-100 transition-colors"
              >
                View Cart
              </Link>
              <Link
                to="/billing"
                onClick={onClose}
                className="min-h-[44px] rounded-lg bg-gray-900 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center hover:bg-gray-800 transition-colors"
              >
                Checkout
              </Link>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
