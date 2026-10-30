import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FolderTree,
  Plus,
  Search,
  Tag,
} from "lucide-react";
import toast from "react-hot-toast";
import Image from "../layout/common/Image";
import {
  classifyProductTaxonomy,
  getAllDepartments,
  getCustomTaxonomyOverrides,
  saveCustomTaxonomyOverrides,
  summarizeCatalogTaxonomy,
} from "../../utils/categoryTaxonomy";
import { saveStoreConfigPatch } from "../../services/api";

export default function AdminCategoriesTab({ products = [], onUpdateProduct }) {
  const [selectedDeptSlug, setSelectedDeptSlug] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showReviewOnly, setShowReviewOnly] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptSlug, setNewDeptSlug] = useState("");
  const [newDeptSubs, setNewDeptSubs] = useState("General, Featured");
  const [revision, setRevision] = useState(0);

  const departments = useMemo(
    () => getAllDepartments(true),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [revision]
  );

  const taxonomySummary = useMemo(
    () => summarizeCatalogTaxonomy(products),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products, revision]
  );

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products
      .map((p) => ({
        product: p,
        taxonomy: classifyProductTaxonomy(p),
      }))
      .filter(({ product, taxonomy }) => {
        if (
          selectedDeptSlug !== "all" &&
          taxonomy.department !== selectedDeptSlug
        ) {
          return false;
        }
        if (showReviewOnly && !taxonomy.needsReview) {
          return false;
        }
        if (q) {
          const text = `${product.title || ""} ${product.category || ""} ${
            taxonomy.departmentName || ""
          } ${taxonomy.subcategory || ""}`.toLowerCase();
          if (!text.includes(q)) return false;
        }
        return true;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, selectedDeptSlug, showReviewOnly, searchQuery, revision]);

  const handleAssignProductTaxonomy = (product, nextDeptSlug, nextSub) => {
    const deptObj = departments.find((d) => d.slug === nextDeptSlug);
    const resolvedSub =
      nextSub || deptObj?.subcategories?.[0] || "General";

    const overrides = getCustomTaxonomyOverrides();
    const updatedOverrides = {
      ...overrides,
      productMappings: {
        ...(overrides.productMappings || {}),
        [String(product.id)]: {
          department: nextDeptSlug,
          subcategory: resolvedSub,
        },
      },
    };
    saveCustomTaxonomyOverrides(updatedOverrides);
    saveStoreConfigPatch({ customTaxonomy: updatedOverrides });

    if (typeof onUpdateProduct === "function") {
      onUpdateProduct({
        ...product,
        department: nextDeptSlug,
        subcategory: resolvedSub,
      });
    }
    setRevision((r) => r + 1);
    toast.success(
      `Assigned "${product.title}" to ${deptObj?.name || nextDeptSlug} → ${resolvedSub}`
    );
  };

  const handleCreateCustomDepartment = (e) => {
    e.preventDefault();
    const cleanName = newDeptName.trim();
    const cleanSlug = (newDeptSlug.trim() || cleanName)
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-|-$/g, "");
    if (!cleanName || !cleanSlug) {
      toast.error("Department name and slug are required.");
      return;
    }
    const subs = newDeptSubs
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const overrides = getCustomTaxonomyOverrides();
    const existingList = Array.isArray(overrides.customDepartments)
      ? overrides.customDepartments
      : [];
    const nextDepts = [
      ...existingList.filter((d) => d.slug !== cleanSlug),
      {
        slug: cleanSlug,
        name: cleanName,
        nameBn: cleanName,
        title: `${cleanName} Collection`,
        subcategories: subs.length ? subs : ["General"],
      },
    ];
    const updatedOverrides = {
      ...overrides,
      customDepartments: nextDepts,
    };
    saveCustomTaxonomyOverrides(updatedOverrides);
    saveStoreConfigPatch({ customTaxonomy: updatedOverrides });
    setNewDeptName("");
    setNewDeptSlug("");
    setRevision((r) => r + 1);
    toast.success(`Department "${cleanName}" (/category/${cleanSlug}) saved!`);
  };

  return (
    <div className="space-y-6">
      {/* Department Summary Grid */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-gray-900 flex items-center gap-2">
              <FolderTree size={17} />
              Canonical Category Taxonomy ({departments.length} Departments)
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Every product is deterministically mapped to a primary department
              and subcategory without fake gender assignments.
            </p>
          </div>
          {taxonomySummary.reviewQueue.length > 0 && (
            <button
              type="button"
              onClick={() => setShowReviewOnly((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3.5 min-h-[38px] rounded-lg text-xs font-bold cursor-pointer ${
                showReviewOnly
                  ? "bg-amber-600 text-white"
                  : "bg-amber-50 border border-amber-200 text-amber-800"
              }`}
            >
              <AlertTriangle size={14} />
              <span>
                {showReviewOnly
                  ? "Showing Review Queue Only"
                  : `${taxonomySummary.reviewQueue.length} Items Flagged for Review`}
              </span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {taxonomySummary.departments.map((dept) => {
            const isSelected = selectedDeptSlug === dept.slug;
            return (
              <button
                key={dept.slug}
                type="button"
                onClick={() =>
                  setSelectedDeptSlug(isSelected ? "all" : dept.slug)
                }
                className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? "border-gray-900 bg-gray-900 text-white shadow-sm"
                    : "border-gray-200 bg-gray-50/70 hover:border-gray-400 text-gray-900"
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-extrabold uppercase tracking-wider truncate">
                    {dept.name}
                  </span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      isSelected
                        ? "bg-white text-gray-900"
                        : "bg-gray-200 text-gray-800"
                    }`}
                  >
                    {dept.totalCount}
                  </span>
                </div>
                <p
                  className={`text-[11px] mt-1.5 truncate ${
                    isSelected ? "text-gray-300" : "text-gray-500"
                  }`}
                >
                  {(dept.subcategories || []).join(" • ")}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Create New Custom Department Form */}
      <form
        onSubmit={handleCreateCustomDepartment}
        className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-xs"
      >
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-900 mb-3 flex items-center gap-1.5">
          <Plus size={14} />
          Add New Department / Category
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input
            type="text"
            value={newDeptName}
            onChange={(e) => setNewDeptName(e.target.value)}
            placeholder="Department Name (e.g., Festive Wear)"
            className="h-10 px-3 rounded-lg border border-gray-300 text-xs outline-none focus:border-gray-900"
          />
          <input
            type="text"
            value={newDeptSlug}
            onChange={(e) => setNewDeptSlug(e.target.value)}
            placeholder="URL Slug (e.g., festive-wear)"
            className="h-10 px-3 rounded-lg border border-gray-300 text-xs outline-none focus:border-gray-900"
          />
          <input
            type="text"
            value={newDeptSubs}
            onChange={(e) => setNewDeptSubs(e.target.value)}
            placeholder="Subcategories (comma-separated)"
            className="h-10 px-3 rounded-lg border border-gray-300 text-xs outline-none focus:border-gray-900"
          />
          <button
            type="submit"
            className="h-10 px-4 rounded-lg bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
          >
            Save Department
          </button>
        </div>
      </form>

      {/* Product Taxonomy Assignment & Review List */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 flex-1 min-w-[220px]">
            <div className="relative flex-1 max-w-md">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products by title, category, or department..."
                className="w-full h-10 pl-9 pr-3 border border-gray-300 rounded-lg text-xs outline-none focus:border-gray-900"
              />
            </div>
            {selectedDeptSlug !== "all" && (
              <button
                type="button"
                onClick={() => setSelectedDeptSlug("all")}
                className="px-3 h-10 rounded-lg bg-gray-100 text-xs font-bold text-gray-700 hover:bg-gray-200 cursor-pointer"
              >
                Show All
              </button>
            )}
          </div>
          <span className="text-xs font-semibold text-gray-500">
            Showing <strong>{filteredItems.length}</strong> products
          </span>
        </div>

        <div className="divide-y divide-gray-100 max-h-[540px] overflow-y-auto">
          {filteredItems.slice(0, 60).map(({ product, taxonomy }) => {
            const currentDeptObj =
              departments.find((d) => d.slug === taxonomy.department) ||
              departments[0];
            const availableSubs = currentDeptObj?.subcategories || ["General"];

            return (
              <div
                key={product.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Image
                    item={product}
                    src={product.thumbnail}
                    alt={product.title}
                    width={44}
                    height={44}
                    className="w-11 h-11 rounded-lg object-contain bg-gray-50 border border-gray-200 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-bold text-gray-900 truncate">
                        {product.title}
                      </p>
                      {taxonomy.needsReview ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                          <AlertTriangle size={10} />
                          Needs Confirmation
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                          <CheckCircle2 size={10} />
                          Verified
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Source tag:{" "}
                      <span className="font-mono text-gray-700">
                        {product.category}
                      </span>{" "}
                      → Mapped:{" "}
                      <strong className="text-gray-900">
                        {taxonomy.departmentName} / {taxonomy.subcategory}
                      </strong>
                    </p>
                  </div>
                </div>

                {/* Department & Subcategory Selectors */}
                <div className="flex items-center gap-2 shrink-0">
                  <Tag size={13} className="text-gray-400 hidden sm:block" />
                  <select
                    aria-label={`Department for ${product.title}`}
                    value={taxonomy.department}
                    onChange={(e) => {
                      const nextSlug = e.target.value;
                      const nextDept = departments.find(
                        (d) => d.slug === nextSlug
                      );
                      handleAssignProductTaxonomy(
                        product,
                        nextSlug,
                        nextDept?.subcategories?.[0] || "General"
                      );
                    }}
                    className="h-9 px-2.5 rounded-lg border border-gray-300 bg-white text-xs font-bold text-gray-800 cursor-pointer"
                  >
                    {departments.map((d) => (
                      <option key={d.slug} value={d.slug}>
                        {d.name}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label={`Subcategory for ${product.title}`}
                    value={taxonomy.subcategory}
                    onChange={(e) =>
                      handleAssignProductTaxonomy(
                        product,
                        taxonomy.department,
                        e.target.value
                      )
                    }
                    className="h-9 px-2.5 rounded-lg border border-gray-300 bg-white text-xs font-semibold text-gray-700 cursor-pointer"
                  >
                    {availableSubs.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
