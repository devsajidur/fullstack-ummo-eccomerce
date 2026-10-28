import React, { useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import Countdown from "react-countdown";
import Header from "../components/layout/Header";

export default function ShopDynamicPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (id && !Number.isNaN(Number(id))) {
      navigate(`/shopsingle?id=${id}`, { replace: true });
    }
  }, [id, navigate]);

  const renderer = ({ hours, minutes, seconds, days }) => (
    <div className="flex gap-3 md:gap-6.25 max-w-[340px] mt-11.25">
      <div>
        <h3 className="text-[30px] leading-7.5 font-normal text-primary">
          {days}
        </h3>
        <h3 className="text-base font-bold leading-7.5 text-gray">DAYS</h3>
      </div>
      <h4 className="text-[30px] font-normal leading-7.5 text-primary">:</h4>
      <div>
        <h3 className="text-[30px] leading-7.5 font-normal text-primary">
          {hours}
        </h3>
        <h3 className="text-base font-bold leading-7.5 text-gray">HOURS</h3>
      </div>
      <h4 className="text-[30px] font-normal leading-7.5 text-primary">:</h4>
      <div>
        <h3 className="text-[30px] leading-7.5 font-normal text-primary">
          {minutes}
        </h3>
        <h3 className="text-base font-bold leading-7.5 text-gray">MINS</h3>
      </div>
      <h4 className="text-[30px] font-normal leading-7.5 text-primary">:</h4>
      <div>
        <h3 className="text-[30px] leading-7.5 font-normal text-primary">
          {seconds}
        </h3>
        <h3 className="text-base font-bold leading-7.5 text-gray">SEC</h3>
      </div>
    </div>
  );

  return (
    <>
      <Header />
      <div className="font-jost min-h-screen flex flex-col justify-center items-center px-4">
        <h2 className="text-[35px] xs:text-[45px] sm:text-[70px] md:text-[90px] lg:text-[100px] font-bold text-primary uppercase">
          Coming Soon
        </h2>
        <p className="max-w-119 text-center text-sm font-normal leading-6 text-primary">
          We are preparing this collection. Meanwhile, explore our full catalog!
        </p>
        <Countdown date={"2026-12-31T23:59:59.000Z"} renderer={renderer} />
      </div>
    </>
  );
}
