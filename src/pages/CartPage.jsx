import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router";
import { ArrowLeft, ShoppingBag, Trash2 } from "lucide-react";
import CartProduct from "../components/cart/cartproductDesign/CartProduct";
import CartFirstTotalBox from "../components/cart/cartfirstTotalbox/CartFirstTotalBox";
import CartCrossSell from "../components/cart/CartCrossSell";
import { EmptyCart } from "../slices/cartSlice";

const CartPage = () => {
  const cartData = useSelector((state) => state.cart.products) || [];
  const dispatch = useDispatch();
  const navigate = useNavigate();

  return (
    <div className="container mt-5 sm:mt-16.25 mb-25 px-3 sm:px-4 xl:px-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[25px] sm:text-[35px] font-bold text-primary uppercase">
          Cart
        </h2>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate("/shop")}
            data-testid="cart-continue-shopping"
            className="inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 text-xs font-bold uppercase tracking-wider border border-gray-300 rounded-lg text-gray-800 hover:bg-gray-50 cursor-pointer transition-colors"
          >
            <ArrowLeft size={14} /> Continue Shopping
          </button>
          {cartData.length > 0 && (
            <button
              type="button"
              onClick={() => dispatch(EmptyCart())}
              data-testid="cart-empty-all"
              className="inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 text-xs font-bold uppercase tracking-wider border border-red-200 rounded-lg text-red-600 hover:bg-red-50 cursor-pointer transition-colors"
            >
              <Trash2 size={14} /> Clear Cart
            </button>
          )}
        </div>
      </div>

      <div className="mt-12 pb-2.5 lg:flex hidden">
        <div className="flex gap-2.5 w-117.5 relative before:absolute before:-bottom-2.5 before:left-0 before:h-0.5 before:w-full before:bg-primary">
          <h3 className="text-[18px] font-medium text-primary">01</h3>
          <div>
            <h3 className="text-[18px] font-medium text-primary">
              SHOPPING BAG
            </h3>
            <h4 className="text-[14px] font-normal leading-7.5 text-gray">
              Manage Your Items List
            </h4>
          </div>
        </div>

        <div className="flex gap-2.5 w-117.5 relative before:absolute before:-bottom-2.5 before:left-0 before:h-0.5 before:w-full before:bg-[#E4E4E4]">
          <h3 className="text-[18px] font-medium text-gray">02</h3>
          <div>
            <h3 className="text-[18px] font-medium text-gray">
              SHIPPING AND CHECKOUT
            </h3>
            <h4 className="text-[14px] font-normal leading-7.5 text-gray">
              Checkout Your Items List
            </h4>
          </div>
        </div>

        <div className="flex gap-2.5 w-117.5 relative before:absolute before:-bottom-2.5 before:left-0 before:h-0.5 before:w-full before:bg-[#E4E4E4]">
          <h3 className="text-[18px] font-medium text-gray">03</h3>
          <div>
            <h3 className="text-[18px] font-medium text-gray">CONFIRMATION</h3>
            <h4 className="text-[14px] font-normal leading-7.5 text-gray">
              Review And Submit Your Order
            </h4>
          </div>
        </div>
      </div>

      {/* Responsive cart top */}
      <div className="mt-5 pb-2.5 lg:hidden">
        <div className="flex gap-2.5 w-full justify-center relative before:absolute before:-bottom-2.5 before:left-0 before:h-0.5 before:w-full before:bg-primary">
          <h3 className="text-[18px] font-medium text-primary">01</h3>
          <div>
            <h3 className="text-[18px] font-medium text-primary">
              SHOPPING BAG
            </h3>
            <h4 className="text-[14px] font-normal leading-7.5 text-gray">
              Manage Your Items List
            </h4>
          </div>
        </div>
      </div>

      <div className="flex mt-10 sm:mt-12.5 gap-10 lg:gap-14.5 flex-col lg:flex-row">
        <div className="flex-1 min-w-0">
          <div className="hidden sm:grid sm:grid-cols-[minmax(0,1fr)_96px_124px_100px_36px] items-center gap-4 border-b border-[#E4E4E4] pb-2.5 text-xs font-semibold uppercase tracking-wider text-gray-600">
            <span>Product</span>
            <span className="text-right">Price</span>
            <span className="text-center">Quantity</span>
            <span className="text-right">Subtotal</span>
            <span className="sr-only">Actions</span>
          </div>

          <div className="w-full" data-testid="cart-items-list">
            {cartData.length === 0 ? (
              <div
                data-testid="empty-cart-state"
                className="flex flex-col items-center justify-center gap-4 py-16 px-4 border border-dashed border-gray-200 rounded-xl mt-4 text-center"
              >
                <ShoppingBag size={40} className="text-gray-300" />
                <h3 className="text-lg font-medium text-primary">
                  Your shopping bag is currently empty.
                </h3>
                <p className="text-xs text-gray-500 max-w-sm">
                  Browse our latest collections and add your favorite items to
                  get started.
                </p>
                <button
                  type="button"
                  className="min-h-[44px] bg-primary text-white text-xs font-bold uppercase tracking-wider py-3 px-6 rounded-lg cursor-pointer hover:opacity-90"
                  onClick={() => navigate("/shop")}
                >
                  Continue Shopping
                </button>
              </div>
            ) : (
              cartData.map((item, idx) => (
                <CartProduct
                  key={
                    item.cartLineId ||
                    `${item.id}-${item.size || ""}-${item.color || ""}-${idx}`
                  }
                  {...item}
                />
              ))
            )}
          </div>
        </div>

        <CartFirstTotalBox />
      </div>

      <CartCrossSell />
    </div>
  );
};

export default CartPage;
