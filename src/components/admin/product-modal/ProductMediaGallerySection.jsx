import React, { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ImagePlus,
  Star,
  Trash2,
  UploadCloud,
} from "lucide-react";

export default function ProductMediaGallerySection({
  productForm,
  setProductForm,
  uploadingField,
  uploadStatusMsg,
  onCloudinaryFileUpload,
}) {
  const [extraImageUrl, setExtraImageUrl] = useState("");

  const galleryImages = Array.isArray(productForm.images)
    ? productForm.images.filter(Boolean)
    : productForm.thumbnail
      ? [productForm.thumbnail]
      : [];

  const handleAddGalleryUrl = () => {
    const clean = extraImageUrl.trim();
    if (!clean) return;
    const nextImages = Array.from(new Set([...galleryImages, clean]));
    setProductForm({
      ...productForm,
      thumbnail: productForm.thumbnail || clean,
      images: nextImages,
    });
    setExtraImageUrl("");
  };

  const handleSetPrimaryImage = (url) => {
    const rest = galleryImages.filter((u) => u !== url);
    setProductForm({
      ...productForm,
      thumbnail: url,
      images: [url, ...rest],
    });
  };

  const handleMoveGalleryImage = (index, direction) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= galleryImages.length) return;
    const copy = [...galleryImages];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIdx, 0, moved);
    setProductForm({
      ...productForm,
      thumbnail: copy[0] || productForm.thumbnail,
      images: copy,
    });
  };

  const handleRemoveGalleryImage = (url) => {
    const next = galleryImages.filter((u) => u !== url);
    setProductForm({
      ...productForm,
      thumbnail: next[0] || "",
      images: next,
    });
  };

  return (
    <div className="p-3.5 rounded-xl border border-gray-200 bg-white space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="font-extrabold uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
          <ImagePlus size={15} />
          Product Image Gallery ({galleryImages.length} Images)
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1.5 bg-gray-900 hover:bg-black text-white px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer">
            <UploadCloud size={13} />
            {uploadingField === "thumbnail"
              ? "Uploading..."
              : "Upload Primary Photo"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
              className="hidden"
              disabled={Boolean(uploadingField)}
              onChange={(e) =>
                onCloudinaryFileUpload(
                  e.target.files?.[0],
                  "thumbnail",
                  "ummo_products"
                )
              }
            />
          </label>

          <label className="inline-flex items-center gap-1.5 border border-gray-900 text-gray-900 hover:bg-gray-100 px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer">
            <ImagePlus size={13} />
            {uploadingField === "galleryImage"
              ? "Uploading..."
              : "+ Add Gallery Photo"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
              className="hidden"
              disabled={Boolean(uploadingField)}
              onChange={(e) =>
                onCloudinaryFileUpload(
                  e.target.files?.[0],
                  "galleryImage",
                  "ummo_products"
                )
              }
            />
          </label>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          required
          placeholder="Primary Thumbnail URL (https://res.cloudinary.com/...)"
          value={productForm.thumbnail}
          onChange={(e) => {
            const val = e.target.value;
            setProductForm({
              ...productForm,
              thumbnail: val,
              images: val
                ? Array.from(new Set([val, ...galleryImages]))
                : galleryImages,
            });
          }}
          className="flex-1 h-9 border border-gray-300 rounded-lg px-3"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Paste additional gallery image URL..."
          value={extraImageUrl}
          onChange={(e) => setExtraImageUrl(e.target.value)}
          className="flex-1 h-9 border border-gray-300 rounded-lg px-3"
        />
        <button
          type="button"
          onClick={handleAddGalleryUrl}
          className="h-9 px-3 rounded-lg bg-gray-100 hover:bg-gray-200 font-bold text-gray-800 cursor-pointer"
        >
          Add URL
        </button>
      </div>

      {uploadStatusMsg && (
        <p className="text-[11px] font-semibold text-emerald-700">
          {uploadStatusMsg}
        </p>
      )}

      {galleryImages.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5 pt-1">
          {galleryImages.map((imgUrl, idx) => {
            const isPrimary = imgUrl === productForm.thumbnail || idx === 0;
            return (
              <div
                key={`${imgUrl}-${idx}`}
                className={`relative border rounded-lg p-1.5 bg-gray-50 flex flex-col items-center ${
                  isPrimary
                    ? "border-gray-900 ring-1 ring-gray-900"
                    : "border-gray-200"
                }`}
              >
                <img
                  src={imgUrl}
                  alt={`Gallery ${idx + 1}`}
                  className="w-full h-16 object-contain rounded bg-white"
                />
                <div className="flex items-center justify-between w-full mt-1.5 gap-1">
                  <button
                    type="button"
                    onClick={() => handleSetPrimaryImage(imgUrl)}
                    title="Set as primary thumbnail"
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase cursor-pointer ${
                      isPrimary
                        ? "bg-gray-900 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    {isPrimary ? (
                      <span className="inline-flex items-center gap-0.5">
                        <Star size={9} /> Main
                      </span>
                    ) : (
                      "Set Main"
                    )}
                  </button>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => handleMoveGalleryImage(idx, -1)}
                      disabled={idx === 0}
                      className="p-0.5 text-gray-500 hover:text-gray-900 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowLeft size={11} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveGalleryImage(idx, 1)}
                      disabled={idx === galleryImages.length - 1}
                      className="p-0.5 text-gray-500 hover:text-gray-900 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowRight size={11} />
                    </button>
                    {galleryImages.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveGalleryImage(imgUrl)}
                        className="p-0.5 text-red-500 hover:text-red-700 cursor-pointer"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
