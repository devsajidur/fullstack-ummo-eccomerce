import React from "react";

const Image = ({ src, alt, className, loading = "lazy", ...rest }) => {
  return (
    <img
      className={className}
      src={src}
      alt={alt || "product image"}
      loading={loading}
      {...rest}
    />
  );
};

export default Image;
