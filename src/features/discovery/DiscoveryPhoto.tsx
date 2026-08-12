"use client";

import { useState } from "react";
import type { DiscoveryPlace } from "./discovery-types";

interface DiscoveryPhotoProps {
  place: DiscoveryPlace;
  priority?: boolean;
}

export function DiscoveryPhoto({ place, priority = false }: DiscoveryPhotoProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const { photo } = place;
  const failed = failedSrc === photo.src;
  const kindLabel = place.kind === "attraction" ? "景点" : "美食";

  return (
    <figure className="discovery-photo">
      <div className="discovery-photo-media">
        {failed ? (
          <div
            className="discovery-photo-fallback"
            role="img"
            aria-label={`${place.name}${kindLabel}照片暂不可用`}
          >
            <span aria-hidden="true">{String(place.index).padStart(2, "0")}</span>
            <strong>{place.name}</strong>
            <small>{kindLabel}照片暂不可用</small>
          </div>
        ) : (
          // The repository ships pre-sized local WebP files for both build targets.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.src}
            alt={photo.alt}
            width="1200"
            height="800"
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={priority ? "high" : "auto"}
            onError={() => setFailedSrc(photo.src)}
          />
        )}
        <span className="discovery-photo-index" aria-hidden="true">
          {String(place.index).padStart(2, "0")}
        </span>
      </div>
      <figcaption>
        <span><small>照片：</small><strong>{photo.caption}</strong></span>
        {photo.isRepresentativeOnly ? (
          <strong className="discovery-photo-disclaimer">
            示意图，不作为门店出品承诺
          </strong>
        ) : null}
        <details className="discovery-credit">
          <summary>图片署名与许可</summary>
          <div>
            <a href={photo.sourceUrl} target="_blank" rel="noreferrer">
              原图：{photo.author}
            </a>
            <a href={photo.licenseUrl} target="_blank" rel="noreferrer">
              许可：{photo.license}
            </a>
            <span>{photo.modifications}</span>
          </div>
        </details>
      </figcaption>
    </figure>
  );
}
