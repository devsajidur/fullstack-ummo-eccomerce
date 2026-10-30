import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  Calendar,
  Flame,
  Percent,
  Plus,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  getStoredDiscountCampaigns,
  saveStoredDiscountCampaigns,
} from "../../services/api";
import { getAllDepartments } from "../../utils/categoryTaxonomy";
import {
  getProductDiscountState,
  isTimestampExpired,
} from "../../utils/discountTimer";

export default function AdminDiscountsTab({ products = [] }) {
  const [campaigns, setCampaigns] = useState(() =>
    getStoredDiscountCampaigns()
  );
  const [name, setName] = useState("");
  const [type, setType] = useState("percentage");
  const [value, setValue] = useState(15);
  const [scope, setScope] = useState("department");
  const [targetDepartment, setTargetDepartment] = useState("women");
  const [startTime, setStartTime] = useState(() =>
    new Date().toISOString().slice(0, 16)
  );
  const [endTime, setEndTime] = useState(() =>
    new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 16)
  );

  const departments = useMemo(() => getAllDepartments(false), []);

  const handleSaveCampaigns = (nextList) => {
    setCampaigns(nextList);
    saveStoredDiscountCampaigns(nextList);
  };

  const handleCreateCampaign = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Campaign name is required.");
      return;
    }
    const numVal = Number(value);
    if (!Number.isFinite(numVal) || numVal <= 0) {
      toast.error("Discount value must be greater than 0.");
      return;
    }
    if (type === "percentage" && numVal > 90) {
      toast.error("Percentage discount cannot exceed 90%.");
      return;
    }
    const startMs = Date.parse(startTime);
    const endMs = Date.parse(endTime);
    if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs <= startMs) {
      toast.error("Campaign end date must be after start date.");
      return;
    }

    const newCamp = {
      id: `CAMP-${Date.now()}`,
      name: name.trim(),
      type,
      value: numVal,
      scope,
      targetDepartment: scope === "department" ? targetDepartment : "",
      startTime: Number.isFinite(startMs)
        ? new Date(startMs).toISOString()
        : new Date().toISOString(),
      endTime: Number.isFinite(endMs)
        ? new Date(endMs).toISOString()
        : new Date(Date.now() + 7 * 86400000).toISOString(),
      active: true,
    };

    const next = [newCamp, ...campaigns];
    handleSaveCampaigns(next);
    setName("");
    toast.success(`Discount campaign "${newCamp.name}" created & synced!`);
  };

  const handleToggleCampaign = (id) => {
    const next = campaigns.map((c) =>
      c.id === id ? { ...c, active: c.active === false } : c
    );
    handleSaveCampaigns(next);
    toast.success("Campaign status updated.");
  };

  const handleDeleteCampaign = (id) => {
    const next = campaigns.filter((c) => c.id !== id);
    handleSaveCampaigns(next);
    toast.success("Discount campaign removed.");
  };

  // Detect overlapping active campaigns on the same department
  const overlapWarnings = useMemo(() => {
    const seenDept = new Map();
    const warnings = [];
    campaigns.forEach((c) => {
      if (c.active === false) return;
      const key = c.scope === "all" ? "ALL" : c.targetDepartment || c.scope;
      if (seenDept.has(key)) {
        warnings.push(
          `"${c.name}" overlaps with "${seenDept.get(
            key
          )}" on target "${key}". The highest valid discount is automatically applied without double-stacking.`
        );
      } else {
        seenDept.set(key, c.name);
      }
    });
    return warnings;
  }, [campaigns]);

  const discountedProductsPreview = useMemo(() => {
    return products
      .map((p) => ({
        product: p,
        ds: getProductDiscountState(p),
      }))
      .filter(({ ds }) => ds.isDiscountActive)
      .sort((a, b) => b.ds.discountPercentage - a.ds.discountPercentage);
  }, [products]);

  return (
    <div className="space-y-6">
      {/* Create New Discount Campaign Form */}
      <form
        onSubmit={handleCreateCampaign}
        className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 shadow-xs space-y-4"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-gray-900 flex items-center gap-2">
              <Flame size={17} className="text-[#C32929]" />
              Create Scheduled Discount Campaign
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Campaigns automatically update product sale prices across `/shop`,
              `/discounts`, and `/category/:slug`, and show the live timer on
              the Single Product page.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">
              Campaign Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Eid & Summer Flash Sale"
              className="w-full h-10 px-3 rounded-lg border border-gray-300 text-xs outline-none focus:border-gray-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">
                Discount Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full h-10 px-2.5 rounded-lg border border-gray-300 bg-white text-xs font-semibold"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount ($)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">
                Value ({type === "percentage" ? "%" : "$"}) *
              </label>
              <input
                type="number"
                min="1"
                max={type === "percentage" ? "90" : "1000"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-gray-300 text-xs font-bold outline-none focus:border-gray-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">
                Target Scope
              </label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                className="w-full h-10 px-2.5 rounded-lg border border-gray-300 bg-white text-xs font-semibold"
              >
                <option value="department">By Department</option>
                <option value="all">Entire Catalog</option>
              </select>
            </div>
            {scope === "department" && (
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">
                  Department
                </label>
                <select
                  value={targetDepartment}
                  onChange={(e) => setTargetDepartment(e.target.value)}
                  className="w-full h-10 px-2.5 rounded-lg border border-gray-300 bg-white text-xs font-bold"
                >
                  {departments.map((d) => (
                    <option key={d.slug} value={d.slug}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">
              Start Date & Time
            </label>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-gray-300 text-xs"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">
              End Date & Time (Countdown Target)
            </label>
            <input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-gray-300 text-xs"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full h-10 rounded-lg bg-[#C32929] hover:bg-red-700 text-white text-xs font-bold uppercase tracking-wider inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus size={15} />
              Launch Campaign
            </button>
          </div>
        </div>
      </form>

      {/* Conflict / Overlap Safeguard Alert */}
      {overlapWarnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <AlertCircle size={15} className="text-amber-700" />
            Campaign Overlap Safeguard Active
          </div>
          {overlapWarnings.map((w, idx) => (
            <p key={idx} className="pl-5 text-amber-800">
              • {w}
            </p>
          ))}
        </div>
      )}

      {/* Active & Scheduled Campaigns List */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-gray-900">
            Configured Discount Campaigns ({campaigns.length})
          </h3>
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
            {discountedProductsPreview.length} Products Currently Discounted
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {campaigns.map((camp) => {
            const isExpired = isTimestampExpired(camp.endTime);
            const isActive = camp.active !== false && !isExpired;

            return (
              <div
                key={camp.id}
                className={`border rounded-xl p-4 flex flex-col justify-between gap-3 ${
                  isActive
                    ? "border-gray-200 bg-white"
                    : "border-gray-200 bg-gray-50 opacity-75"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span
                        className={`inline-block text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full mb-1 ${
                          isExpired
                            ? "bg-red-100 text-red-700"
                            : isActive
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-gray-200 text-gray-700"
                        }`}
                      >
                        {isExpired
                          ? "EXPIRED"
                          : isActive
                            ? "ACTIVE"
                            : "PAUSED"}
                      </span>
                      <h4 className="text-sm font-bold text-gray-900">
                        {camp.name}
                      </h4>
                    </div>
                    <span className="inline-flex items-center gap-0.5 px-2.5 py-1 rounded-lg bg-red-50 text-[#C32929] text-xs font-extrabold">
                      <Percent size={12} />
                      {camp.type === "fixed"
                        ? `$${camp.value} OFF`
                        : `${camp.value}% OFF`}
                    </span>
                  </div>

                  <div className="text-xs text-gray-500 mt-2 space-y-1">
                    <p>
                      Scope:{" "}
                      <strong className="text-gray-800 uppercase">
                        {camp.scope === "all"
                          ? "All Catalog Products"
                          : `Department: ${camp.targetDepartment}`}
                      </strong>
                    </p>
                    <p className="flex items-center gap-1 text-[11px]">
                      <Calendar size={12} />
                      Ends:{" "}
                      {camp.endTime
                        ? new Date(camp.endTime).toLocaleString()
                        : "Ongoing"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => handleToggleCampaign(camp.id)}
                    className="h-8 px-3 rounded-lg border border-gray-300 bg-white text-xs font-bold text-gray-800 hover:bg-gray-50 cursor-pointer"
                  >
                    {camp.active === false ? "Activate" : "Pause"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteCampaign(camp.id)}
                    className="h-8 px-2.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 inline-flex items-center gap-1 text-xs font-bold cursor-pointer"
                  >
                    <Trash2 size={13} />
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
