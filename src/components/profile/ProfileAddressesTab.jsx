import React, { useState } from "react";
import { MapPin, Plus, Star, Trash2 } from "lucide-react";

export default function ProfileAddressesTab({
  addresses,
  onAddAddress,
  onSetDefaultAddress,
  onDeleteAddress,
}) {
  const [form, setForm] = useState({
    label: "Home",
    streetAddress: "",
    apartment: "",
    city: "",
    province: "",
    postcode: "",
    country: "United States",
    phone: "",
  });

  function handleSubmit(e) {
    e.preventDefault();
    onAddAddress(form);
    setForm({
      label: "Home",
      streetAddress: "",
      apartment: "",
      city: "",
      province: "",
      postcode: "",
      country: "United States",
      phone: "",
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 mb-4">
          Add Shipping Address
        </h3>
        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-gray-600 mb-1">
              Label (Home / Office)
            </label>
            <input
              type="text"
              required
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block font-semibold text-gray-600 mb-1">
              Street Address *
            </label>
            <input
              type="text"
              required
              value={form.streetAddress}
              onChange={(e) =>
                setForm({ ...form, streetAddress: e.target.value })
              }
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-semibold text-gray-600 mb-1">
                City *
              </label>
              <input
                type="text"
                required
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-600 mb-1">
                State / Province *
              </label>
              <input
                type="text"
                required
                value={form.province}
                onChange={(e) => setForm({ ...form, province: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-semibold text-gray-600 mb-1">
                Postcode *
              </label>
              <input
                type="text"
                required
                value={form.postcode}
                onChange={(e) => setForm({ ...form, postcode: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-600 mb-1">
                Phone *
              </label>
              <input
                type="text"
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-1.5 bg-gray-900 text-white font-semibold uppercase tracking-wider py-2.5 rounded cursor-pointer hover:bg-gray-800"
          >
            <Plus size={14} /> Save Address
          </button>
        </form>
      </div>

      <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-6 shadow-xs">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 mb-4">
          Saved Addresses ({addresses.length})
        </h3>
        {addresses.length === 0 ? (
          <p className="text-xs text-gray-500">
            No saved addresses yet. Add a default shipping address to auto-fill checkout!
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {addresses.map((addr) => (
              <div
                key={addr.id}
                className={`border rounded-lg p-4 text-xs relative ${
                  addr.isDefault
                    ? "border-gray-900 bg-gray-50/70"
                    : "border-gray-200"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="inline-flex items-center gap-1 font-bold text-gray-900 uppercase">
                    <MapPin size={13} /> {addr.label || "Shipping"}
                  </span>
                  {addr.isDefault ? (
                    <span className="text-[10px] font-bold uppercase bg-gray-900 text-white px-2 py-0.5 rounded">
                      Default
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSetDefaultAddress(addr.id)}
                      className="text-[11px] font-semibold text-gray-600 hover:text-black inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Star size={12} /> Set Default
                    </button>
                  )}
                </div>
                <p className="text-gray-700">{addr.streetAddress}</p>
                <p className="text-gray-600">
                  {addr.city}, {addr.province} {addr.postcode}
                </p>
                <p className="text-gray-500 mt-1">Phone: {addr.phone}</p>
                <button
                  type="button"
                  onClick={() => onDeleteAddress(addr.id)}
                  className="mt-3 text-red-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
