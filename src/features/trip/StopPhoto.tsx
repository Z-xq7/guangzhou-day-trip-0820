"use client";

import { useState } from "react";
import type { StopPhoto as StopPhotoData } from "../../data/types";

interface StopPhotoProps {
  photo: StopPhotoData;
  title: string;
  priority: boolean;
}

export function StopPhoto({ photo, title, priority }: StopPhotoProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="stop-photo stop-photo-fallback" role="img" aria-label={`${title}照片暂不可用`}>
        <span>照片暂不可用</span><strong>{title}</strong>
      </div>
    );
  }

  return (
    <figure className="stop-photo">
      <img
        src={photo.src}
        alt={photo.alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        onError={() => setFailed(true)}
      />
      <figcaption>
        <span>真实照片 · {title}</span>
        <a href={photo.sourceUrl} target="_blank" rel="noreferrer">
          图片来源：{photo.author} · {photo.license}
        </a>
      </figcaption>
    </figure>
  );
}
