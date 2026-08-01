"use client";

import { useRef, useState } from "react";
import {
  bookingItems,
  budgetItems as defaultBudgetItems,
  budgetLabels,
  scenarioCopy,
  sources,
} from "../../data/itinerary";
import type {
  BookingItem,
  BudgetItem,
  ItineraryStop,
  MobileView,
  Scenario,
} from "../../data/types";
import { summarizeBudget } from "./trip-logic";
import { RouteDiagram } from "./RouteDiagram";
import { StopDetail } from "./StopDetail";

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
          <li
            key={stop.id}
            className={`${selectedId === stop.id ? "is-selected" : ""} ${completed ? "is-complete" : ""}`}
          >
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

interface NextStopBarProps {
  nextStop: ItineraryStop;
  navigationUrl: string;
  onSelect: (id: string) => void;
}

export function NextStopBar({ nextStop, navigationUrl, onSelect }: NextStopBarProps) {
  return (
    <div className="next-stop-bar" aria-label="下一站快捷操作">
      <div><span>下一站 · {nextStop.start}</span><strong>{nextStop.title}</strong></div>
      <button type="button" onClick={() => onSelect(nextStop.id)}>看详情</button>
      <a href={navigationUrl} target="_blank" rel="noreferrer">百度地图导航 ↗</a>
    </div>
  );
}

export interface RouteViewProps {
  isActive?: boolean;
  isMobile?: boolean;
  scenario: Scenario;
  stops: ItineraryStop[];
  selectedStop: ItineraryStop;
  completedIds: string[];
  completedCount: number;
  perPersonBudget: { min: number; max: number };
  onScenarioChange: (scenario: Scenario) => void;
  onSelectStop: (id: string) => void;
  onToggleStop: (id: string) => void;
  onNavigateView?: (view: MobileView) => void;
  selectedNavigationUrl: string;
  progressNextStop?: ItineraryStop;
  progressNextNavigationUrl?: string;
}

export function RouteView({
  isActive = true,
  isMobile = false,
  scenario,
  stops,
  selectedStop,
  completedIds,
  completedCount,
  perPersonBudget,
  onScenarioChange,
  onSelectStop,
  onToggleStop,
  onNavigateView,
  selectedNavigationUrl,
  progressNextStop,
  progressNextNavigationUrl,
}: RouteViewProps) {
  return (
    <section
      id="route"
      className={`app-view${isActive ? " is-active" : ""}`}
      aria-label="路线规划"
      aria-hidden={isMobile && !isActive ? true : undefined}
    >
      <header className="site-header">
        <a className="brand" href="#top" aria-label="返回行程顶部">
          <span className="brand-seal" aria-hidden="true">粤</span>
          <span><strong>一日广州</strong><small>二人岭南漫游</small></span>
        </a>
        <nav aria-label="页面导航">
          <a href="#route">路线</a>
          <a href="#map">地图</a>
          <a href="#todo">预约</a>
          <a href="#me">预算</a>
        </nav>
      </header>

      <section className="hero" id="top" tabIndex={-1}>
        <div className="hero-rings ring-one" aria-hidden="true" />
        <div className="hero-rings ring-two" aria-hidden="true" />
        <div className="hero-copy">
          <p className="eyebrow">2026.08.20 · 星期四 · 深圳北出发</p>
          <h1>趁一日，饮啖茶<br /><em>行一城</em></h1>
          <p className="hero-lead">从西关晨茶走到珠江灯影。路线不贪多，但广州该有的味道、建筑、街巷与夜色，一样不少。</p>
          <div className="hero-actions">
            <a className="button button-primary" href="#stop-detail">展开今日路线 <span aria-hidden="true">↓</span></a>
            <a
              className="button button-ghost"
              href="#todo"
              onClick={isMobile && onNavigateView ? (event) => {
                event.preventDefault();
                onNavigateView("todo");
              } : undefined}
            >
              先看预约清单
            </a>
          </div>
        </div>
        <div className="hero-ticket" aria-label="行程摘要">
          <div className="ticket-top"><span>GUANGZHOU DAY PASS</span><strong>双人</strong></div>
          <div className="ticket-route"><span>SZX</span><i aria-hidden="true" /><span>CAN</span></div>
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
        <div><span className="stat-kicker">广州人均</span><strong>¥{perPersonBudget.min}–{perPersonBudget.max}</strong><small>不含往返高铁</small></div>
        <div><span className="stat-kicker">信息状态</span><strong>已核验</strong><small>更新于 08.01</small></div>
      </section>

      <section className="scenario-section section-shell" aria-labelledby="scenario-title">
        <div className="section-heading compact">
          <div><p className="eyebrow">PLAN B BUILT IN</p><h2 id="scenario-title">天气变，主线不乱</h2></div>
          <ScenarioSwitcher value={scenario} onChange={onScenarioChange} />
        </div>
        <div className={`scenario-note scenario-${scenario}`} role="status">
          <span className="note-mark" aria-hidden="true">{scenario === "normal" ? "常" : scenario === "rain" ? "雨" : "迟"}</span>
          <div><strong>{scenarioCopy[scenario].title}</strong><p>{scenarioCopy[scenario].description}</p></div>
        </div>
      </section>

      <section className="route-section section-shell" aria-labelledby="route-title">
        <div className="section-heading">
          <div><p className="eyebrow">CURRENT STOP</p><h2 id="route-title">当前站详情</h2></div>
          <p>点击时间轴选择站点，展开这一站真正需要的信息。</p>
        </div>
        <StopDetail
          stop={selectedStop}
          navigationUrl={selectedNavigationUrl}
          priorityPhoto={selectedStop.id === "tea"}
        />
      </section>

      <section className="timeline-section section-shell" aria-labelledby="timeline-title">
        <div className="section-heading">
          <div><p className="eyebrow">FROM MORNING TEA TO RIVER LIGHTS</p><h2 id="timeline-title">一日时间轴</h2></div>
          <p>{completedCount}/{stops.length} 已打卡 · 点击圆圈记录进度</p>
        </div>
        <TripTimeline
          stops={stops}
          selectedId={selectedStop.id}
          completedIds={completedIds}
          onSelect={onSelectStop}
          onToggleComplete={onToggleStop}
        />
      </section>
    </section>
  );
}

export interface MapViewProps {
  isActive?: boolean;
  isMobile?: boolean;
  stops: ItineraryStop[];
  selectedStop: ItineraryStop;
  nextStop?: ItineraryStop;
  placeUrl: string;
  nextNavigationUrl?: string;
  onSelectStop: (id: string) => void;
}

export function MapView({
  isActive = true,
  isMobile = false,
  stops,
  selectedStop,
  nextStop,
  placeUrl,
  nextNavigationUrl,
  onSelectStop,
}: MapViewProps) {
  const [copyResult, setCopyResult] = useState<{
    status: "idle" | "copied" | "manual";
    placeText: string | null;
  }>({ status: "idle", placeText: null });
  const copyRequestId = useRef(0);
  const placeText = `${selectedStop.placeRegion ?? "广州"} ${selectedStop.placeName}`;
  const copyStatus = copyResult.placeText === placeText ? copyResult.status : "idle";

  const copyPlace = async () => {
    const requestId = ++copyRequestId.current;
    const textToCopy = placeText;
    const commitCopyResult = (status: "copied" | "manual") => {
      if (requestId !== copyRequestId.current) return;
      setCopyResult({ status, placeText: textToCopy });
    };
    try {
      if (!navigator.clipboard?.writeText) {
        commitCopyResult("manual");
        return;
      }
      await navigator.clipboard.writeText(textToCopy);
      commitCopyResult("copied");
    } catch {
      commitCopyResult("manual");
    }
  };

  return (
    <section
      id="map"
      className={`app-view${isActive ? " is-active" : ""}`}
      aria-label="地图与导航"
      aria-hidden={isMobile && !isActive ? true : undefined}
    >
      <section className="route-section section-shell" aria-labelledby="map-title">
        <div className="section-heading">
          <div><p className="eyebrow">ROUTE AT A GLANCE</p><h2 id="map-title">路线总览</h2></div>
          <p>点击路线图选择站点；示意图不代表真实地理比例。</p>
        </div>
        <div className="route-layout">
          <div className="route-diagram-column">
            <RouteDiagram stops={stops} selectedId={selectedStop.id} onSelect={onSelectStop} />
          </div>
          <article className="stop-detail" aria-live="polite">
            <div className="detail-topline">
              <span className="category-pill">{selectedStop.category}</span>
              <span>{selectedStop.start}–{selectedStop.end}</span>
            </div>
            <p className="detail-kicker">已选站点</p>
            <h3>{selectedStop.title}</h3>
            <p className="detail-summary">{selectedStop.summary}</p>
            <div className="detail-facts">
              <div><span>地点</span><strong>{selectedStop.placeName}</strong></div>
              {nextStop ? (
                <div><span>下一站</span><strong>{nextStop.title}</strong></div>
              ) : (
                <div><span>行程状态</span><strong>路线已完成</strong></div>
              )}
            </div>
            <button type="button" onClick={copyPlace}>
              {copyStatus === "copied" ? "已复制地点" : "复制地点"}
            </button>
            {copyStatus === "manual" ? (
              <code aria-label="手动复制地点">{placeText}</code>
            ) : null}
            <a
              className="button button-ghost detail-nav"
              href={placeUrl}
              target="_blank"
              rel="noreferrer"
            >
              在百度地图查看地点 {selectedStop.shortTitle} <span aria-hidden="true">↗</span>
            </a>
            {nextStop && nextNavigationUrl ? (
              <a
                className="button button-primary detail-nav"
                href={nextNavigationUrl}
                target="_blank"
                rel="noreferrer"
              >
                百度地图去下一站 {nextStop.shortTitle} <span aria-hidden="true">↗</span>
              </a>
            ) : (
              <p className="route-complete-note">已到达本次行程终点，无需继续导航。</p>
            )}
          </article>
        </div>
      </section>
    </section>
  );
}

export interface TodoViewProps {
  isActive?: boolean;
  isMobile?: boolean;
  completedIds: string[];
  onToggle: (id: string) => void;
}

export function TodoView({ isActive = true, isMobile = false, completedIds, onToggle }: TodoViewProps) {
  return (
    <section
      id="todo"
      className={`app-view${isActive ? " is-active" : ""}`}
      aria-label="行前待办"
      aria-hidden={isMobile && !isActive ? true : undefined}
    >
      <section
        className="prep-grid section-shell"
        id="checklist"
        tabIndex={-1}
        aria-labelledby="checklist-title"
      >
        <div className="checklist-card paper-card">
          <div className="section-heading compact">
            <div><p className="eyebrow">BEFORE YOU GO</p><h2 id="checklist-title">行前预约清单</h2></div>
          </div>
          <BookingChecklist items={bookingItems} completedIds={completedIds} onToggle={onToggle} />
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
    </section>
  );
}

export interface MyTripViewProps {
  isActive?: boolean;
  isMobile?: boolean;
  scenario: Scenario;
  completedStops: number;
  totalStops: number;
  completedBookings: number;
  budget: ReturnType<typeof summarizeBudget>;
  budgetItems?: BudgetItem[];
  onNavigateView?: (view: MobileView) => void;
  onReset: () => void;
}

const scenarioLabels: Record<Scenario, string> = {
  normal: "正常",
  rain: "下雨",
  delay: "高铁晚点",
};

export function MyTripView({
  isActive = true,
  isMobile = false,
  scenario,
  completedStops,
  totalStops,
  completedBookings,
  budget,
  budgetItems = defaultBudgetItems,
  onNavigateView,
  onReset,
}: MyTripViewProps) {
  return (
    <section
      id="me"
      className={`app-view${isActive ? " is-active" : ""}`}
      aria-label="我的行程"
      aria-hidden={isMobile && !isActive ? true : undefined}
    >
      <section className="quick-stats" aria-label="我的行程进度">
        <div><span className="stat-kicker">当前模式</span><strong>{scenarioLabels[scenario]}</strong><small>可随时切换</small></div>
        <div><span className="stat-kicker">景点打卡</span><strong>{completedStops}/{totalStops}</strong><small>仅保存在本机</small></div>
        <div><span className="stat-kicker">行前待办</span><strong>{completedBookings}/{bookingItems.length}</strong><small>按出发顺序办理</small></div>
        <div><span className="stat-kicker">双人预算</span><strong>¥{budget.couple.min}–{budget.couple.max}</strong><small>不含往返高铁</small></div>
      </section>

      <section
        className="budget-section section-shell"
        id="budget"
        tabIndex={-1}
        aria-labelledby="budget-title"
      >
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
        <div className="section-heading compact">
          <div><p className="eyebrow">VERIFIED, NOT GUESSED</p><h2 id="sources-title">信息来源</h2></div>
        </div>
        <div className="source-grid">
          {sources.map((source) => (
            <a key={source.id} href={source.url} target="_blank" rel="noreferrer">
              <span>{source.publisher}</span><strong>{source.title}</strong><small>核验 {source.verifiedAt} ↗</small>
            </a>
          ))}
        </div>
        <p className="source-note">车次、船名和精确票价将在官方开放 8 月 20 日班次后才能锁定；页面当前只给安全时间窗。</p>
        <p className="privacy-note">不登录、不定位、不上传数据</p>
        <button type="button" onClick={onReset}>清除本机记录</button>
      </section>

      <footer>
        <span className="brand-seal" aria-hidden="true">粤</span>
        <p>两个人，一日广州。<br /><small>路线数据不含定位，不上传任何个人信息。</small></p>
        <a
          href="#route"
          onClick={isMobile && onNavigateView ? (event) => {
            event.preventDefault();
            onNavigateView("route");
          } : undefined}
        >
          回到顶部 ↑
        </a>
      </footer>
    </section>
  );
}
