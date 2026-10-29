import React, { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router";
import { onUserChanged, saveLocalOrder } from "../../services/authSession";
import toast, { Toaster } from "react-hot-toast";
import { EmptyCart, removeCoupon } from "../../slices/cartSlice";
import {
  SHIPPING_OPTIONS,
  computeCouponDiscount,
} from "../cart/cartfirstTotalbox/CartFirstTotalBox";
import {
  computeCartPromotions,
  evaluateCouponClientEligibility,
  getStoredCartRules,
  initCartRulesSync,
  resolveCartItemPricing,
} from "../../utils/cartPromotions";
import {
  fetchUserAddressesFromMongo,
  submitBackendOrder,
} from "../../services/api";
import BillingOrderSummary from "./BillingOrderSummary";

const COUNTRIES = [
  "Turkey",
  "United States",
  "United Kingdom",
  "Germany",
  "France",
  "Bangladesh",
];

const EMPTY_LIST = [];

const BillingInformation = () => {
  const ORDER_ITEMS = useSelector((state) => state.cart.products);
  const catalogProducts =
    useSelector((state) => state.AllProduct.Products) || EMPTY_LIST;
  const shippingMethodId = useSelector(
    (state) => state.cart.shippingMethod || "flat"
  );
  const appliedCoupon = useSelector((state) => state.cart.appliedCoupon);
  const giftWrap = useSelector((state) => Boolean(state.cart.giftWrap));
  const giftNote = useSelector((state) => state.cart.giftNote || "");
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [cartRules, setCartRules] = useState(() => getStoredCartRules());

  const [firstName, setfirstName] = useState("");
  const [lastName, setlastName] = useState("");
  const [company, setcompany] = useState("");
  const [country, setcountry] = useState("Bangladesh");
  const [streetAddress, setstreetAddress] = useState("");
  const [apartment, setapartment] = useState("");
  const [city, setcity] = useState("");
  const [postcode, setpostcode] = useState("");
  const [province, setprovince] = useState("");
  const [phone, setphone] = useState("");
  const [email, setemail] = useState("");
  const [orderNotes, setorderNotes] = useState("");

  const [user, setuser] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("bank-transfer");
  const [submitting, setSubmitting] = useState(false);

  function applySavedAddress(addr) {
    if (!addr) return;
    if (addr.firstName) setfirstName(addr.firstName);
    if (addr.lastName) setlastName(addr.lastName);
    if (addr.country) setcountry(addr.country);
    if (addr.streetAddress) setstreetAddress(addr.streetAddress);
    if (addr.apartment) setapartment(addr.apartment);
    if (addr.city) setcity(addr.city);
    if (addr.province) setprovince(addr.province);
    if (addr.postcode) setpostcode(addr.postcode);
    if (addr.phone) setphone(addr.phone);
  }

  // Auto-fill from localStorage default address or Firebase Address Book
  useEffect(() => {
    try {
      const savedAddr = localStorage.getItem("ummo_default_address");
      if (savedAddr) {
        applySavedAddress(JSON.parse(savedAddr));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onUserChanged((currentUser) => {
      if (currentUser) {
        setuser(currentUser);
        if (currentUser.email) setemail((prev) => prev || currentUser.email);
        if (currentUser.displayName) {
          const parts = currentUser.displayName.split(" ");
          setfirstName((prev) => prev || parts[0] || "");
          setlastName((prev) => prev || parts.slice(1).join(" ") || "");
        }
        fetchUserAddressesFromMongo(currentUser.uid)
          .then((list) => {
            if (!Array.isArray(list) || list.length === 0) return;
            const def = list.find((a) => a.isDefault) || list[0];
            if (def) applySavedAddress(def);
          })
          .catch(() => {});
      } else {
        setuser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubRules = initCartRulesSync((rules) => setCartRules(rules));
    return () => {
      if (typeof unsubRules === "function") unsubRules();
    };
  }, []);

  const pricedOrderItems = (ORDER_ITEMS || []).map((item) => {
    const pricing = resolveCartItemPricing(item, catalogProducts);
    return {
      ...item,
      quantity: Math.max(1, Number(item.quantity || 1)),
      price: pricing.unitPrice,
      originalPrice: pricing.originalPrice,
      discountPercent: pricing.discountPercent,
    };
  });

  const promotions = computeCartPromotions(
    pricedOrderItems,
    cartRules,
    catalogProducts
  );
  const subtotal = promotions.subtotal;
  const tieredDiscount = promotions.tieredDiscount;
  const discount = computeCouponDiscount(
    Math.max(0, subtotal - tieredDiscount),
    appliedCoupon,
    subtotal
  );
  const rawShippingCost =
    SHIPPING_OPTIONS.find((o) => o.id === shippingMethodId)?.price || 0;
  const shippingCost = promotions.freeShippingUnlocked ? 0 : rawShippingCost;
  const giftWrapCost =
    giftWrap && pricedOrderItems.length > 0 ? promotions.giftWrapFee : 0;
  const vat = pricedOrderItems.length > 0 ? 19 : 0;
  const total = Math.max(
    0,
    subtotal -
      tieredDiscount -
      discount +
      shippingCost +
      giftWrapCost +
      vat
  );

  async function handlePlaceOrder(e) {
    e.preventDefault();

    if (!user) {
      toast.error("Please log in before placing your order.");
      setTimeout(() => navigate("/login"), 1200);
      return;
    }

    if (pricedOrderItems.length === 0) {
      toast.error("Your cart is empty. Please add products first.");
      return;
    }

    if (appliedCoupon) {
      const couponCheck = evaluateCouponClientEligibility(appliedCoupon, {
        subtotal,
        eligibleAmount: Math.max(0, subtotal - tieredDiscount),
        userUid: user.uid,
        userEmail: email.trim() || user.email || "",
        userPhone: phone.trim(),
      });
      if (!couponCheck.valid) {
        dispatch(removeCoupon());
        toast.error(
          couponCheck.reason || "Applied coupon is no longer valid for this order."
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const orderPayload = {
        username: `${firstName} ${lastName}`.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        id: user.uid,
        userUid: user.uid,
        OrderItems: pricedOrderItems,
        freeGifts: promotions.unlockedFreeGifts || [],
        subtotal: Number(subtotal.toFixed(2)),
        tieredDiscount: Number(tieredDiscount.toFixed(2)),
        discount: Number(discount.toFixed(2)),
        couponCode: discount > 0 && appliedCoupon?.code ? appliedCoupon.code : null,
        shipping: shippingCost,
        freeShippingUnlocked: promotions.freeShippingUnlocked,
        shippingMethod: shippingMethodId,
        giftWrap,
        giftWrapCost: Number(giftWrapCost.toFixed(2)),
        giftNote: giftNote.trim(),
        vat,
        total: Number(total.toFixed(2)),
        paymentMethod,
        status: "PENDING",
        date: new Date().toISOString(),
        billing: {
          company: company.trim(),
          country,
          streetAddress: streetAddress.trim(),
          apartment: apartment.trim(),
          city: city.trim(),
          postcode: postcode.trim(),
          province: province.trim(),
          phone: phone.trim(),
          orderNotes: orderNotes.trim(),
        },
      };

      const generatedOrderId = `ORD-${Date.now()}`;
      const fullOrder = {
        ...orderPayload,
        id: generatedOrderId,
        orderId: generatedOrderId,
        userUid: user.uid,
      };

      let finalOrder = fullOrder;
      try {
        const res = await submitBackendOrder(fullOrder);
        const serverOrder = res?.order || res?.data;
        if (serverOrder?.orderId) {
          finalOrder = {
            ...fullOrder,
            ...serverOrder,
            id: serverOrder.orderId,
            orderId: serverOrder.orderId,
          };
        }
      } catch (apiErr) {
        const status = apiErr?.response?.status;
        if (status && status >= 400 && status < 500) {
          const errMsg =
            apiErr?.response?.data?.error ||
            "Order validation failed. Please review your cart.";
          if (/coupon/i.test(errMsg)) {
            dispatch(removeCoupon());
          }
          toast.error(errMsg);
          return;
        }
        // Only fall back to local order saving when offline / network unreachable
      }

      saveLocalOrder(finalOrder);
      dispatch(EmptyCart());
      toast.success("Order placed successfully!");
      navigate(`/ordercomplete?orderId=${finalOrder.orderId}`);
    } catch (error) {
      console.error("Error placing order: ", error);
      toast.error("Could not place your order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-white px-4 sm:px-6 lg:px-10 py-10">
      <Toaster position="top-center" reverseOrder={false} />
      <form
        onSubmit={handlePlaceOrder}
        className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16"
      >
        <div>
          <h2 className="text-base font-medium font-jost text-gray-900 mb-6">
            BILLING DETAILS
          </h2>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input
                className="w-full border border-gray-300 rounded-md px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                placeholder="First Name *"
                value={firstName}
                type="text"
                onChange={(v) => setfirstName(v.target.value)}
                required
              />
              <input
                type="text"
                required
                value={lastName}
                onChange={(v) => setlastName(v.target.value)}
                className="w-full border border-gray-300 rounded-md px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                placeholder="Last Name *"
              />
            </div>

            <input
              type="text"
              placeholder="Company Name (optional)"
              value={company}
              onChange={(v) => setcompany(v.target.value)}
              className="w-full border border-gray-300 rounded-md px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
            />
            <div className="relative">
              <label className="block text-xs text-primary px-1 mb-1 absolute left-5 -top-1.5 z-10 bg-white">
                Country / Region *
              </label>
              <div className="relative">
                <select
                  value={country}
                  onChange={(e) => setcountry(e.target.value)}
                  required
                  className="w-full appearance-none border border-gray-300 rounded-md px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 bg-white"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                />
              </div>
            </div>

            <input
              type="text"
              required
              placeholder="Street Address *"
              className="w-full border border-gray-300 rounded-md px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
              value={streetAddress}
              onChange={(v) => setstreetAddress(v.target.value)}
            />

            <input
              type="text"
              placeholder="Apartment, suite, unit, etc. (optional)"
              className="w-full border border-gray-300 rounded-md px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
              value={apartment}
              onChange={(v) => setapartment(v.target.value)}
            />

            <input
              type="text"
              required
              placeholder="Town / City *"
              className="w-full border border-gray-300 rounded-md px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
              value={city}
              onChange={(v) => setcity(v.target.value)}
            />

            <input
              type="text"
              required
              placeholder="Postcode / ZIP *"
              className="w-full border border-gray-300 rounded-md px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
              value={postcode}
              onChange={(v) => setpostcode(v.target.value)}
            />

            <input
              type="text"
              required
              placeholder="Province *"
              className="w-full border border-gray-300 rounded-md px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
              value={province}
              onChange={(v) => setprovince(v.target.value)}
            />

            <input
              type="tel"
              required
              placeholder="Phone *"
              className="w-full border border-gray-300 rounded-md px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
              value={phone}
              onChange={(v) => setphone(v.target.value)}
            />

            <input
              type="email"
              required
              placeholder="Your E-mail *"
              className="w-full border border-gray-300 rounded-md px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
              value={email}
              onChange={(v) => setemail(v.target.value)}
            />

            <textarea
              placeholder="Order Notes (optional)"
              value={orderNotes}
              onChange={(e) => setorderNotes(e.target.value)}
              rows={4}
              className="w-full border border-gray-300 rounded-md px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 resize-none"
            />
          </div>
        </div>

        <BillingOrderSummary
          orderItems={pricedOrderItems}
          subtotal={subtotal}
          promotions={promotions}
          tieredDiscount={tieredDiscount}
          discount={discount}
          appliedCoupon={appliedCoupon}
          shippingCost={shippingCost}
          giftWrapCost={giftWrapCost}
          giftNote={giftNote}
          vat={vat}
          total={total}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          submitting={submitting}
        />
      </form>
    </div>
  );
};

export default BillingInformation;
