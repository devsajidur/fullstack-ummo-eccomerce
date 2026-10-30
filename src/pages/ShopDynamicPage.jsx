import React, { useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { getDepartmentBySlug } from "../utils/categoryTaxonomy";
import ShopSingle from "./ShopSingle";

export default function ShopDynamicPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dept = id ? getDepartmentBySlug(id) : null;
  const isDepartmentRoute = Boolean(dept && Number.isNaN(Number(id)));

  useEffect(() => {
    if (!id) {
      navigate("/shop", { replace: true });
      return;
    }
    if (isDepartmentRoute) {
      navigate(`/category/${dept.slug}`, { replace: true });
    }
  }, [id, isDepartmentRoute, dept, navigate]);

  if (!id || isDepartmentRoute) {
    return <div className="min-h-screen" />;
  }

  return <ShopSingle />;
}
