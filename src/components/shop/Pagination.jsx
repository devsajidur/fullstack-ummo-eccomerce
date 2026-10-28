import React from "react";

const Pagination = ({ item = [], ProductPerPage = 12, CurrPage }) => {
  const totalPages = Math.max(1, Math.ceil(item.length / ProductPerPage));
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div>
      {pages.map((page) => (
        <button
          key={page}
          type="button"
          onClick={() => CurrPage(page)}
          className="text-[18px] focus:bg-green-700 focus:text-white cursor-pointer ml-2 w-7 border border-green-400 rounded-sm hover:bg-green-700"
        >
          {page}
        </button>
      ))}
    </div>
  );
};

export default Pagination;
