import React from "react";

const Image = ({
  src,
  alt = "",
  className = "",
  loading = "lazy",
  decoding = "async",
  ...rest
}) => {
  return (
    <img
      className={className}
      src={src}
      alt={alt}
      loading={loading}
      decoding={decoding}
      {...rest}
    />
  );
};

export default Image;
