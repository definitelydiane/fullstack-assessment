/**
 * A component to display product images on product pages.
 */
"use client";

import { useState } from "react";
import Image from "next/image";
import { Card, CardContent } from "./card";

export default function ImageCarousel({
  productTitle,
  imageUrls,
}: {
  productTitle: string; // We pass this in to use as our alt text.
  imageUrls: string[];
}) {
  const [selectedImage, setSelectedImage] = useState(0);
  return (
    <>
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="relative h-96 w-full bg-muted">
            {imageUrls[selectedImage] && (
              <Image
                src={imageUrls[selectedImage]}
                alt={productTitle}
                fill
                className="object-contain p-8"
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
              />
            )}
          </div>
        </CardContent>
      </Card>
      {imageUrls.length > 1 && (
        <div className="grid grid-cols-4 gap-2">
          {imageUrls.map((url, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedImage(idx)}
              className={`relative h-20 border-2 rounded-lg overflow-hidden ${selectedImage === idx ? "border-primary" : "border-muted"}`}
            >
              <Image
                src={url}
                alt={`${productTitle} - Image ${idx + 1}`}
                fill
                className="object-contain p-2"
                sizes="100px"
              />
            </button>
          ))}
        </div>
      )}
    </>
  );
}
