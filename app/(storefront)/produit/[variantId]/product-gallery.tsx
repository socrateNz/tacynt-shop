"use client";

import { useState } from "react";

export function ProductGallery({
  imageIds,
  productId,
  designation,
}: {
  imageIds: string[];
  productId: string;
  designation: string;
}) {
  const [selected, setSelected] = useState(0);

  if (imageIds.length === 0) {
    return <div className="aspect-square w-full rounded-lg border border-dashed border-border" />;
  }

  return (
    <div className="flex flex-col gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- image binaire servie par la route, pas un asset statique optimisable */}
      <img
        src={`/api/products/${productId}/images/${imageIds[selected]}`}
        alt={designation}
        className="aspect-square w-full rounded-lg border border-border object-cover"
      />
      {imageIds.length > 1 && (
        <div className="flex gap-2">
          {imageIds.map((id, i) => (
            <button
              key={id}
              type="button"
              onClick={() => setSelected(i)}
              className={`size-16 shrink-0 overflow-hidden rounded-md border ${
                i === selected ? "border-primary" : "border-border"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- image binaire servie par la route, pas un asset statique optimisable */}
              <img
                src={`/api/products/${productId}/images/${id}`}
                alt=""
                className="size-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
