"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import {
  bookingItems,
  budgetItems,
  budgetLabels,
  itineraryStops,
  scenarioCopy,
  sources,
} from "../../data/itinerary";
import type { BookingItem, ItineraryStop, Scenario } from "../../data/types";
import { applyScenario, buildAmapNavigationUrl, summarizeBudget } from "./trip-logic";
import {
  defaultTripState,
  getTripStateSnapshot,
  subscribeTripState,
  updateTripState,
} from "./trip-storage";
import { TripMap } from "./TripMap";

interface ScenarioSwitcherProps {
  value: Scenario;
  onChange: (scenario: Scenario) => void;
}

export function ScenarioSwitcher({ value, onChange }: ScenarioSwitcherProps) {
  const options: Array<{ value: Scenario; label: string; icon: string }> = [
    { value: "normal", label: "正常", icon: "晴" },
    { value: "rain", label: "下雨", icon: "雨" },
    { value: "delay", label: "高铁晚点", icon: "迟" },
  ];

  return (
    <div className="scenario-switcher" role="tablist" aria-label="行程模式">
      {options.map((option) => (
        <button
          key={option.value}
          className={value === option.value ? "is-active" : ""}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
        >
          <span aria-hidden="true">{option.icon}</span>
          {option.label}
        </button>
      ))}
    </div>
  );
}

interface TripTimelineProps {
  stops: ItineraryStop[];
  selectedId: string;
  completedIds: string[];
  onSelect: (id: string) => void;
  onToggleComplete: (id: string) => void;
}

export function TripTimeline({
  stops,
  selectedId,
  completedIds,
  onSelect,
  onToggleComplete,
}: TripTimelineProps) {
  return (
    <ol className="trip-timeline">
      {stops.map((stop, index) => {
        const completed = completedIds.includes(stop.id);
        return (
          <li key={stop.id} className={`${selectedId === stop.id ? "is-selected" : ""} ${completed ? "is-complete" : ""}`}>
            <span className="timeline-node" aria-hidden="true">{index + 1}</span>
            <button
              className="timeline-main"
              type="button"
              aria-current={selectedId === stop.id ? "step" : undefined}
              onClick={() => onSelect(stop.id)}
            >
              <span className="timeline-time">{stop.start}</span>
              <span className="timeline-copy">
                <small>{stop.category}</small>
                <strong>{stop.title}</strong>
                <span>{stop.transport}</span>
              </span>
              <span className="timeline-arrow" aria-hidden="true">→</span>
            </button>
            <label className="completion-toggle" title={`标记${stop.title}已完成`}>
              <input
                type="checkbox"
                aria-label={`标记${stop.title}已完成`}
                checked={completed}
                onChange={() => onToggleComplete(stop.id)}
              />
              <span aria-hidden="true">{completed ? "✓" : ""}</span>
            </label>
          </li>
        );
      })}
    </ol>
  );
}

interface BookingChecklistProps {
  items: BookingItem[];
  completedIds: string[];
  onToggle: (id: string) => void;
}

export function BookingChecklist({ items, completedIds, onToggle }: BookingChecklistProps) {
  return (
    <ul className="booking-list">
      {items.map((item) => {
        const completed = completedIds.includes(item.id);
        return (
          <li key={item.id} className={completed ? "is-complete" : ""}>
            <label>
              <input type="checkbox" checked={completed} onChange={() => onToggle(item.id)} />
              <span className="custom-check" aria-hidden="true">{completed ? "✓" : ""}</span>
              <span>
                <strong>{item.title}</strong>
                <small>{item.status}</small>
              </span>
            </label>
            <a href={item.url} target="_blank" rel="noreferrer">去办理 ↗</a>
          </li>
        );
      })}
    </ul>
  );
}

function toggleId(ids: string[], id: string) {
  return ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id];
}

export function TripPlanner() {
  const budget = useMemo(() => summarizeBudget(budgetItems), []);
  const tripState = useSyncExternalStore(
    subscribeTripState,
    getTripStateSnapshot,
    () => defaultTripState,
  );
  const [selectedId, setSelectedId] = useState("tea");

  const activeStops = useMemo(
    () => applyScenario(itineraryStops, tripState.scenario),
    [tripState.scenario],
  );

  const selectedStop =
    activeStops.find((stop) => stop.id === selectedId) ??
    activeStops.find((stop) => stop.id !== "rail-outbound") ??
    activeStops[0];
  const nextStop =
    activeStops.find(
      (stop) => stop.id !== "rail-outbound" && !tripState.completedStopIds.includes(stop.id),
    ) ?? activeStops.at(-1);
  const completedCount = activeStops.filter((stop) => tripState.completedStopIds.includes(stop.id)).length;

  const setScenario = useCallback((scenario: Scenario) => {
    updateTripState((current) => ({ ...current, scenario }));
  }, []);

  const selectStop = useCallback((id: string) => setSelectedId(id), []);

  const toggleStop = useCallback((id: string) => {
    updateTripState((current) => ({
      ...current,
      completedStopIds: toggleId(current.completedStopIds, id),
    }));
  }, []);

  const toggleBooking = useCallback((id: string) => {
    updateTripState((current) => ({
      ...current,
      bookingIds: toggleId(current.bookingIds, id),
    }));
  }, []);

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="返回行程顶部">
          <span className="brand-seal" aria-hidden="true">粤</span>
          <span><strong>一日广州</strong><small>二人岭南漫游</small></span>
        </a>
        <nav aria-label="页面导航">
          <a href="#route">路线</a>
          <a href="#checklist">预约</a>
          <a href="#budget">预算</a>
        </nav>
      </header>

      <section className="hero" id="top">
        <div className="hero-rings ring-one" aria-hidden="true" />
        <div className="hero-rings ring-two" aria-hidden="true" />
        <div className="hero-copy">
          <p className="eyebrow">2026.08.20 · 星期四 · 深圳北出发</p>
          <h1>趁一日，饮啖茶<br /><em>行一城</em></h1>
          <p className="hero-lead">从西关晨茶走到珠江灯影。路线不贪多，但广州该有的味道、建筑、街巷与夜色，一样不少。</p>
          <div className="hero-actions">
            <a className="button button-primary" href="#route">展开今日路线 <span aria-hidden="true">↓</span></a>
            <a className="button button-ghost" href="#checklist">先看预约清单</a>
          </div>
        </div>
        <div className="hero-ticket" aria-label="行程摘要">
          <div className="ticket-top"><span>GUANGZHOU DAY PASS</span><strong>双人</strong></div>
          <div className="ticket-route">
            <span>SZX</span><i aria-hidden="true" /><span>CAN</span>
          </div>
          <dl>
            <div><dt>出发</dt><dd>深圳北</dd></div>
            <div><dt>终点</dt><dd>珠江夜游</dd></div>
            <div><dt>节奏</dt><dd>早出晚归</dd></div>
            <div><dt>主线</dt><dd>西关 → 越秀</dd></div>
          </dl>
          <div className="ticket-stamp" aria-hidden="true">穗<br />游</div>
        </div>
      </section>

      <section className="quick-stats" aria-label="行程关键数据">
        <div><span className="stat-kicker">全天跨度</span><strong>约 14.5h</strong><small>含深广往返</small></div>
        <div><span className="stat-kicker">预计步行</span><strong>约 9km</strong><small>雨天模式更少</small></div>
        <div><span className="stat-kicker">广州人均</span><strong>¥{budget.perPerson.min}–{budget.perPerson.max}</strong><small>不含往返高铁</small></div>
        <div><span className="stat-kicker">信息状态</span><strong>已核验</strong><small>更新于 08.01</small></div>
      </section>

      <section className="scenario-section section-shell" aria-labelledby="scenario-title">
        <div className="section-heading compact">
          <div><p className="eyebrow">PLAN B BUILT IN</p><h2 id="scenario-title">天气变，主线不乱</h2></div>
          <ScenarioSwitcher value={tripState.scenario} onChange={setScenario} />
        </div>
        <div className={`scenario-note scenario-${tripState.scenario}`} role="status">
          <span className="note-mark" aria-hidden="true">{tripState.scenario === "normal" ? "常" : tripState.scenario === "rain" ? "雨" : "迟"}</span>
          <div><strong>{scenarioCopy[tripState.scenario].title}</strong><p>{scenarioCopy[tripState.scenario].description}</p></div>
        </div>
      </section>

      <section className="route-section section-shell" id="route" aria-labelledby="route-title">
        <div className="section-heading">
          <div><p className="eyebrow">ROUTE AT A GLANCE</p><h2 id="route-title">路线总览</h2></div>
          <p>点击地图或时间轴，下面会展开这一站真正需要的信息。</p>
        </div>
        <div className="route-layout">
          <div className="map-column">
            <TripMap stops={activeStops} selectedId={selectedStop.id} onSelect={selectStop} />
          </div>
          <article className="stop-detail" id="stop-detail" aria-live="polite">
            <div className="detail-topline">
              <span className="category-pill">{selectedStop.category}</span>
              <span>{selectedStop.start}–{selectedStop.end} · {selectedStop.durationMinutes} 分钟</span>
            </div>
            <p className="detail-kicker">{selectedStop.shortTitle}</p>
            <h3>{selectedStop.title}</h3>
            <p className="detail-summary">{selectedStop.summary}</p>
            <p className="detail-body">{selectedStop.detail}</p>
            <div className="detail-facts">
              <div><span>怎么去</span><strong>{selectedStop.transport}</strong></div>
              <div><span>预算</span><strong>{selectedStop.priceLabel}</strong></div>
              <div><span>预约</span><strong>{selectedStop.reservation}</strong></div>
            </div>
            <div className="detail-tags" aria-label="本站重点">
              {selectedStop.highlights.map((item) => <span key={item}>{item}</span>)}
            </div>
            {selectedStop.food.length > 0 && (
              <div className="food-note"><span aria-hidden="true">食</span><p><strong>这一站吃什么</strong>{selectedStop.food.join(" · ")}</p></div>
            )}
            {selectedStop.comparisons && (
              <div className="comparison-block">
                <div className="comparison-title"><strong>怎么选？</strong><span>把时间与花费放在一起看</span></div>
                <div className="comparison-grid">
                  {selectedStop.comparisons.map((choice) => (
                    <div key={choice.id} className={`comparison-card ${choice.recommended ? "is-recommended" : ""}`}>
                      <span>{choice.badge}</span><strong>{choice.title}</strong>
                      <dl><div><dt>花费</dt><dd>{choice.cost}</dd></div><div><dt>耗时</dt><dd>{choice.time}</dd></div></dl>
                      <p>{choice.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <a
              className="button button-primary detail-nav"
              href={buildAmapNavigationUrl(selectedStop.placeName, selectedStop.navigationMode)}
              target="_blank"
              rel="noreferrer"
            >
              在高德打开 {selectedStop.shortTitle} <span aria-hidden="true">↗</span>
            </a>
          </article>
        </div>
      </section>

      <section className="timeline-section section-shell" aria-labelledby="timeline-title">
        <div className="section-heading">
          <div><p className="eyebrow">FROM MORNING TEA TO RIVER LIGHTS</p><h2 id="timeline-title">一日时间轴</h2></div>
          <p>{completedCount}/{activeStops.length} 已打卡 · 点击圆圈记录进度</p>
        </div>
        <TripTimeline
          stops={activeStops}
          selectedId={selectedStop.id}
          completedIds={tripState.completedStopIds}
          onSelect={selectStop}
          onToggleComplete={toggleStop}
        />
      </section>

      <section className="prep-grid section-shell" id="checklist" aria-labelledby="checklist-title">
        <div className="checklist-card paper-card">
          <div className="section-heading compact"><div><p className="eyebrow">BEFORE YOU GO</p><h2 id="checklist-title">行前预约清单</h2></div></div>
          <BookingChecklist items={bookingItems} completedIds={tripState.bookingIds} onToggle={toggleBooking} />
        </div>
        <aside className="decision-card">
          <p className="eyebrow">THE NON-NEGOTIABLES</p>
          <h3>三个时间，不能赌</h3>
          <ol>
            <li><span>01</span><div><strong>07:45 前抵穗</strong><p>超过 08:30，立即启用晚点模式。</p></div></li>
            <li><span>02</span><div><strong>18:50 到码头</strong><p>只买 20:30 前结束的班次。</p></div></li>
            <li><span>03</span><div><strong>21:40 后返程</strong><p>广州南预留至少 30 分钟进站。</p></div></li>
          </ol>
        </aside>
      </section>

      <section className="budget-section section-shell" id="budget" aria-labelledby="budget-title">
        <div className="section-heading">
          <div><p className="eyebrow">SPEND WHERE IT MATTERS</p><h2 id="budget-title">预算花在体验上</h2></div>
          <p>广州本地消费；深广往返高铁单独计算。</p>
        </div>
        <div className="budget-layout">
          <div className="budget-total">
            <span>人均预计</span><strong>¥{budget.perPerson.min}<i>–</i>{budget.perPerson.max}</strong>
            <p>双人共 ¥{budget.couple.min}–{budget.couple.max}</p>
          </div>
          <div className="budget-bars">
            {budgetItems.map((item) => (
              <div key={item.id}>
                <span>{budgetLabels[item.id]}</span>
                <i><b style={{ width: `${Math.max(12, (item.max / 150) * 100)}%` }} /></i>
                <strong>¥{item.min}–{item.max}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sources-section section-shell" aria-labelledby="sources-title">
        <div className="section-heading compact"><div><p className="eyebrow">VERIFIED, NOT GUESSED</p><h2 id="sources-title">信息来源</h2></div></div>
        <div className="source-grid">
          {sources.map((source) => (
            <a key={source.id} href={source.url} target="_blank" rel="noreferrer">
              <span>{source.publisher}</span><strong>{source.title}</strong><small>核验 {source.verifiedAt} ↗</small>
            </a>
          ))}
        </div>
        <p className="source-note">车次、船名和精确票价将在官方开放 8 月 20 日班次后才能锁定；页面当前只给安全时间窗。</p>
      </section>

      <footer>
        <span className="brand-seal" aria-hidden="true">粤</span>
        <p>两个人，一日广州。<br /><small>路线数据不含定位，不上传任何个人信息。</small></p>
        <a href="#top">回到顶部 ↑</a>
      </footer>

      {nextStop && (
        <div className="next-stop-bar" aria-label="下一站快捷操作">
          <div><span>下一站 · {nextStop.start}</span><strong>{nextStop.title}</strong></div>
          <button type="button" onClick={() => selectStop(nextStop.id)}>看详情</button>
          <a href={buildAmapNavigationUrl(nextStop.placeName, nextStop.navigationMode)} target="_blank" rel="noreferrer">高德导航 ↗</a>
        </div>
      )}
    </main>
  );
}
