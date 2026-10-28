import React from "react";
import FooterTop1 from "./FooterTop1";
import FooterTop2 from "./FooterTop2";
import FooterTop3 from "./FooterTop3";
import FooterTop4 from "./FooterTop4";
import FooterTop5 from "./FooterTop5";

const FooterTop = () => {
  return (
    <>
      <div className="container hidden lg:flex px-4 xl:px-2.5 justify-between gap-8 pb-22 border-b-2 border-[#CFCDCD]">
        <FooterTop1 />
        <FooterTop2 />
        <FooterTop3 />
        <FooterTop4 />
        <FooterTop5 />
      </div>
      <div className="container lg:hidden flex flex-col px-4 justify-between pb-6 border-b-2 border-[#CFCDCD]">
        <FooterTop1 />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 mt-10">
          <FooterTop2 />
          <FooterTop3 />
          <FooterTop4 />
        </div>
        <FooterTop5 />
      </div>
    </>
  );
};

export default FooterTop;
