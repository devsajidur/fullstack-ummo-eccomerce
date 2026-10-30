import React, { useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { getDepartmentBySlug } from "../utils/categoryTaxonomy";

export default function ShopDynamicPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) {
      navigate("/shop", { replace: true });
      return;
    }
    const dept = getDepartmentBySlug(id);
    if (dept && Number.isNaN(Number(id))) {
      navigate(`/category/${dept.slug}`, { replace: true });
      return;
    }
    navigate(`/shopsingle?id=${encodeURIComponent(id)}`, { replace: true });
  }, [id, navigate]);

  return null;
}
