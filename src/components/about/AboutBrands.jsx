import React from "react";
import aboutpagedata from "../../api/aboutpagedata.json";
import Image from "../layout/common/Image";

const AboutBrands = () => {
  return (
    <div className="container px-4 lg:px-0">
      <div className="flex justify-center sm:justify-between items-center flex-wrap gap-6">
        {aboutpagedata.map((item, idx) => (
          <Image
            key={item.id || idx}
            src={item.image}
            alt="Brand partner"
            className="max-h-10 sm:max-h-12 w-auto object-contain"
          />
        ))}
      </div>
    </div>
  );
};

export default AboutBrands;
