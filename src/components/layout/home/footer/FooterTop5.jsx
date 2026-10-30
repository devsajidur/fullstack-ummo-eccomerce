import React, { useState } from "react";
import Image from "../../common/Image";
import footerImage from "../../../../assets/images/footerimage.png";
import { submitSubscriberToMongo } from "../../../../services/api";
import toast from "react-hot-toast";

const FooterTop5 = () => {
  const [subEmail, setSubEmail] = useState("");

  async function handleSubscribe(e) {
    e.preventDefault();
    if (!subEmail.trim()) return;
    try {
      await submitSubscriberToMongo(subEmail.trim().toLowerCase());
    } catch {
      // ignore offline
    }
    setSubEmail("");
    toast.success("Subscribed to newsletter! Use code WELCOME10 for 10% OFF.");
  }

  return (
    <div className="mt-8 md:mt-0 relative">
      <h2 className="text-[18px] font-medium">SUBSCRIBE</h2>
      <p className="max-w-68.25 w-full text-[14px] font-normal leading-6 text-primary mt-5 md:mt-7.5 mb-3.75">
        Be the first to get the latest news about trends, promotions, and much
        more!
      </p>
      <form
        onSubmit={handleSubscribe}
        className="w-full h-12 md:h-13.75 bg-white flex justify-between px-4 md:px-5 mb-7 md:mb-10.25 border border-gray-200 rounded"
      >
        <input
          className="text-[14px] font-normal leading-6 text-primary outline-none w-full"
          type="email"
          required
          value={subEmail}
          onChange={(e) => setSubEmail(e.target.value)}
          placeholder="Your email address"
        />
        <button
          type="submit"
          className="text-[13px] font-bold tracking-wider uppercase text-primary cursor-pointer px-2 min-h-[44px]"
        >
          JOIN
        </button>
      </form>
      <h3 className="text-primary text-[15px] font-medium mb-2.75">
        Secure payments
      </h3>
      <Image
        src={footerImage}
        alt="Accepted payment methods"
        width={260}
        height={26}
        className="h-6 w-auto object-contain"
      />
    </div>
  );
};

export default FooterTop5;
