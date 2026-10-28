import React from "react";
import LocationSidebar from "../components/location/LocationSidebar";
import LocationImage from "../components/location/LocationImage";

export default function LocationPage() {
  return (
    <div className="container xl:px-0 px-4 mx-auto md:pb-37.5 pb-10">
      <h1 className="text-2xl py-10 font-bold text-primary sm:text-[26px] md:text-[35px]">
        STORE LOCATOR
      </h1>
      <div className="flex flex-wrap md:flex-nowrap md:gap-4">
        <LocationSidebar />
        <LocationImage />
      </div>
    </div>
  );
}
