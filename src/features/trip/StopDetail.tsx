"use client";

import type { ItineraryStop } from "../../data/types";
import { StopPhoto } from "./StopPhoto";

export interface StopDetailProps {
  stop: ItineraryStop;
  navigationUrl: string;
  priorityPhoto: boolean;
}

export function StopDetail({ stop, navigationUrl, priorityPhoto }: StopDetailProps) {
  const usesPlaceSearch = stop.placeRegion && stop.placeRegion !== "广州";

  return (
    <article className="stop-detail" id="stop-detail" tabIndex={-1} aria-live="polite">
      <div className="detail-topline">
        <span className="category-pill">{stop.category}</span>
        <span>{stop.start}–{stop.end} · {stop.durationMinutes} 分钟</span>
      </div>
      {stop.photo && (
        <StopPhoto photo={stop.photo} title={stop.title} priority={priorityPhoto} />
      )}
      <p className="detail-kicker">{stop.shortTitle}</p>
      <h3>{stop.title}</h3>
      <p className="detail-summary">{stop.summary}</p>
      <p className="detail-body">{stop.detail}</p>
      <div className="detail-facts">
        <div><span>怎么去</span><strong>{stop.transport}</strong></div>
        <div><span>预算</span><strong>{stop.priceLabel}</strong></div>
        <div><span>预约</span><strong>{stop.reservation}</strong></div>
      </div>
      <div className="detail-tags" aria-label="本站重点">
        {stop.highlights.map((item) => <span key={item}>{item}</span>)}
      </div>
      {stop.food.length > 0 && (
        <div className="food-note">
          <span aria-hidden="true">食</span>
          <p><strong>这一站吃什么</strong>{stop.food.join(" · ")}</p>
        </div>
      )}
      {stop.comparisons && (
        <div className="comparison-block">
          <div className="comparison-title">
            <strong>怎么选？</strong><span>把时间与花费放在一起看</span>
          </div>
          <div className="comparison-grid">
            {stop.comparisons.map((choice) => (
              <div
                key={choice.id}
                className={`comparison-card ${choice.recommended ? "is-recommended" : ""}`}
              >
                <span>{choice.badge}</span><strong>{choice.title}</strong>
                <dl>
                  <div><dt>花费</dt><dd>{choice.cost}</dd></div>
                  <div><dt>耗时</dt><dd>{choice.time}</dd></div>
                </dl>
                <p>{choice.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      <a
        className="button button-primary detail-nav"
        href={navigationUrl}
        target="_blank"
        rel="noreferrer"
      >
        {usesPlaceSearch ? "在百度地图查看" : "在百度地图打开"} {stop.shortTitle}{" "}
        <span aria-hidden="true">↗</span>
      </a>
    </article>
  );
}
