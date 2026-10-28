import React from "react";

const FooterBottom = () => {
  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <>
      <div className="container hidden md:flex justify-between items-center pt-8.5 pb-7 px-4 xl:px-2">
        <h6 className="text-primary text-[14px] font-normal leading-6">
          ©2026 Uomo
        </h6>
        <div className="flex items-center gap-5.75">
          <h6 className="text-gray text-[14px] font-normal leading-6">
            Language
          </h6>
          <h6 className="text-primary text-[14px] font-normal leading-6">
            United Kingdom | English
          </h6>
          <h6 className="text-gray text-[14px] font-normal leading-6">
            Currency
          </h6>
          <h6 className="text-primary text-[14px] font-normal leading-6">
            $ USD
          </h6>
        </div>
      </div>

      {/* Mobile view with bottom clearance for fixed mobile nav */}
      <div className="container pt-6 pb-20 md:hidden px-4 relative">
        <h6 className="text-primary text-[14px] font-normal leading-6">
          ©2026 Uomo
        </h6>

        <div className="flex items-center gap-x-5 mt-2">
          <h6 className="text-gray text-[14px] font-normal leading-6">
            Language
          </h6>
          <h6 className="text-primary flex items-center gap-x-4 text-[14px] font-normal leading-6">
            United Kingdom | English
          </h6>
        </div>

        <div className="flex items-center gap-x-6 mt-2">
          <h6 className="text-gray text-[14px] font-normal leading-6">
            Currency
          </h6>
          <h6 className="text-primary text-[14px] font-normal leading-6 flex items-center gap-x-2.5">
            $ USD
          </h6>
        </div>
        <button
          type="button"
          onClick={scrollToTop}
          aria-label="Scroll to top"
          className="absolute bottom-16 right-4 p-3.5 bg-[#EEEEEE] rounded-full shadow cursor-pointer"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M7.49932 3.36078C7.22726 3.08872 6.77274 3.08872 6.49999 3.36078L0.206656 9.638C-0.0688853 9.91355 -0.0688853 10.3604 0.206656 10.6352C0.482197 10.9108 0.929749 10.9108 1.20529 10.6352L6.99997 4.85667L12.794 10.6359C13.0702 10.9115 13.517 10.9115 13.7933 10.6359C14.0688 10.3604 14.0688 9.91355 13.7933 9.6387L7.49932 3.36078Z"
              fill="black"
            />
          </svg>
        </button>
      </div>
    </>
  );
};

export default FooterBottom;
