"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

const FALLBACK = "/brand/vial.png";

type Props = Omit<ImageProps, "src" | "alt"> & {
  src: string;
  alt: string;
};

export function ProductImage({ src, alt, onError, ...props }: Props) {
  const [current, setCurrent] = useState(src || FALLBACK);

  return (
    <Image
      {...props}
      src={current}
      alt={alt}
      onError={(event) => {
        if (current !== FALLBACK) setCurrent(FALLBACK);
        onError?.(event);
      }}
    />
  );
}
