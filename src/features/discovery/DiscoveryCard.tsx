"use client";

import { discoveryPlaces } from "../../data/discovery";
import {
  buildDiscoveryBaiduUrl,
  calculateEditorialScore,
} from "./discovery-logic";
import type { DiscoveryPlace } from "./discovery-types";
import { DiscoveryPhoto } from "./DiscoveryPhoto";

interface DiscoveryCardProps {
  place: DiscoveryPlace;
  expanded: boolean;
  wished: boolean;
  onOpen(id: string | null): void;
  onToggleWish(id: string): void;
  onShowOnMap(id: string): void;
}

const audienceLabels = {
  couple: "情侣",
  family: "亲子",
  elder: "长辈",
  rain: "雨天",
} as const;

function formatRange([minimum, maximum]: [number, number], unit: string) {
  return minimum === maximum ? `${minimum}${unit}` : `${minimum}–${maximum}${unit}`;
}

export function DiscoveryCard({
  place,
  expanded,
  wished,
  onOpen,
  onToggleWish,
  onShowOnMap,
}: DiscoveryCardProps) {
  const score = calculateEditorialScore(place).toFixed(1);
  const nearby = place.nearbyPlaceIds
    .map((id) => discoveryPlaces.find((candidate) => candidate.id === id)?.name)
    .filter((name): name is string => Boolean(name));
  const detailButtonLabel = expanded ? `收起${place.name}详情` : `查看${place.name}详情`;
  const wishButtonLabel = wished
    ? `从想去清单移除${place.name}`
    : `加入想去清单：${place.name}`;

  return (
    <article
      id={`discovery-card-${place.id}`}
      className={`discovery-card${expanded ? " is-expanded" : ""}`}
      aria-label={`${place.index} ${place.name}`}
      tabIndex={-1}
    >
      <DiscoveryPhoto place={place} priority={place.index <= 2} />

      <div className="discovery-card-body">
        <div className="discovery-card-kicker">
          <span>{place.kind === "attraction" ? "景点" : "美食"}</span>
          <span>{place.district}</span>
          <span>{place.indoorOutdoor === "indoor" ? "室内" : place.indoorOutdoor === "outdoor" ? "户外" : "室内外"}</span>
        </div>
        <div className="discovery-card-heading">
          <h3>
            <span aria-hidden="true">{String(place.index).padStart(2, "0")}</span>
            {place.name}
          </h3>
          <strong className="discovery-score">站内推荐 {score}</strong>
        </div>

        <p className="discovery-summary">{place.summary}</p>
        <div className="discovery-tags" aria-label={`${place.name}主题`}>
          {place.themes.slice(0, 4).map((theme) => <span key={theme}>{theme}</span>)}
        </div>
        <dl className="discovery-quick-facts">
          <div><dt>建议停留</dt><dd>{formatRange(place.durationMinutes, " 分钟")}</dd></div>
          <div><dt>人均预算</dt><dd>¥{formatRange(place.budgetPerPerson, "")}</dd></div>
          <div><dt>适合时段</dt><dd>{place.bestTime}</dd></div>
        </dl>

        <div className="discovery-rating-policy">
          {place.platformRating ? (
            <a
              href={place.platformRating.url}
              target="_blank"
              rel="noreferrer"
            >
              {place.platformRating.platform} {place.platformRating.score}/{place.platformRating.scale}
            </a>
          ) : (
            <span>暂无可核验平台分</span>
          )}
          <small>站内推荐分来自公开维度计算，不是用户点评分</small>
        </div>

        {wished ? (
          <p className="discovery-wishlist-note">已加入路线候选，不会改写 8 月 20 日主线</p>
        ) : null}

        {expanded ? (
          <div id={`${place.id}-detail`} className="discovery-card-detail">
            <p>{place.description}</p>

            <section aria-labelledby={`${place.id}-highlights`}>
              <h4 id={`${place.id}-highlights`}>到这里看什么</h4>
              <ul>{place.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}</ul>
            </section>

            <dl className="discovery-detail-facts">
              <div><dt>开放 / 营业</dt><dd>{place.opening}</dd></div>
              <div><dt>怎么去</dt><dd>{place.transit}</dd></div>
              <div><dt>顺路可去</dt><dd>{nearby.join("、") || "暂无"}</dd></div>
            </dl>

            <section className="discovery-audience" aria-labelledby={`${place.id}-audience`}>
              <h4 id={`${place.id}-audience`}>不同同行人的适配度</h4>
              <div>
                {Object.entries(audienceLabels).map(([key, label]) => {
                  const value = place.audienceScores[key as keyof typeof audienceLabels];
                  return (
                    <label key={key}>
                      <span>{label}</span>
                      <meter min="1" max="5" value={value}>{value}/5</meter>
                      <strong>{value}/5</strong>
                    </label>
                  );
                })}
              </div>
            </section>

            <section aria-labelledby={`${place.id}-sources`}>
              <h4 id={`${place.id}-sources`}>资料来源</h4>
              <ul className="discovery-source-list">
                {place.sources.map((source) => (
                  <li key={source.url}>
                    <a href={source.url} target="_blank" rel="noreferrer">
                      {source.title} · {source.publisher}
                    </a>
                  </li>
                ))}
              </ul>
              <p>资料核验：{place.verifiedAt}</p>
            </section>

            <div className="discovery-detail-actions">
              <a
                href={buildDiscoveryBaiduUrl(place.baiduPlaceName)}
                target="_blank"
                rel="noreferrer"
              >
                在百度地图打开{place.name}
              </a>
              <button type="button" onClick={() => onShowOnMap(place.id)}>
                在总览图查看{place.name}
              </button>
            </div>
          </div>
        ) : null}

        <div className="discovery-card-actions">
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={`${place.id}-detail`}
            onClick={() => onOpen(expanded ? null : place.id)}
          >
            {detailButtonLabel}
          </button>
          <button
            type="button"
            aria-pressed={wished}
            onClick={() => onToggleWish(place.id)}
          >
            {wishButtonLabel}
          </button>
        </div>
      </div>
    </article>
  );
}
