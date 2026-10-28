import React from "react";

const Image = ({ src, alt, className, loading = "lazy" }) => {
  return (
    <img
      className={className}
      src={src}
      alt={alt || "product image"}
      loading={loading}
    />
  );
};

export default Image;
