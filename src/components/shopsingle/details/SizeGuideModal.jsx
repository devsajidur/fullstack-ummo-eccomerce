import React from "react";
import { Ruler, X } from "lucide-react";

const SIZE_CHART_ROWS = [
  { s: "XS", us: "2–4", eu: "34", chest: "32–34", waist: "25–27" },
  { s: "S", us: "4–6", eu: "36", chest: "35–37", waist: "28–30" },
  { s: "M", us: "8–10", eu: "38–40", chest: "38–40", waist: "31–33" },
  { s: "L", us: "12–14", eu: "42", chest: "41–43", waist: "34–36" },
  { s: "XL", us: "16–18", eu: "44–46", chest: "44–46", waist: "37–40" },
];

export default function SizeGuideModal({ selectedSize, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 pb-3 mb-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-primary flex items-center gap-2">
            <Ruler size={16} />
            International Size Guide (US / UK / EU)
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-900 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 text-gray-800 uppercase">
                <th className="p-2.5 border border-gray-200">Size</th>
                <th className="p-2.5 border border-gray-200">US</th>
                <th className="p-2.5 border border-gray-200">EU</th>
                <th className="p-2.5 border border-gray-200">Chest (in)</th>
                <th className="p-2.5 border border-gray-200">Waist (in)</th>
              </tr>
            </thead>
            <tbody>
              {SIZE_CHART_ROWS.map((row) => (
                <tr
                  key={row.s}
                  className={
                    selectedSize === row.s
                      ? "bg-amber-50 font-semibold"
                      : "hover:bg-gray-50"
                  }
                >
                  <td className="p-2.5 border border-gray-200 font-bold">
                    {row.s}
                  </td>
                  <td className="p-2.5 border border-gray-200">{row.us}</td>
                  <td className="p-2.5 border border-gray-200">{row.eu}</td>
                  <td className="p-2.5 border border-gray-200">{row.chest}</td>
                  <td className="p-2.5 border border-gray-200">{row.waist}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-gray-500 mt-3">
          Tip: If you are between two sizes, choose the smaller size for a
          tailored fit or the larger size for a relaxed fit.
        </p>
      </div>
    </div>
  );
}
