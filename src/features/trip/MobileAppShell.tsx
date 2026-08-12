import type { MobileView } from "../../data/types";

const views: Array<{ id: MobileView; label: string; mark: string }> = [
  { id: "route", label: "路线", mark: "线" },
  { id: "discover", label: "发现", mark: "探" },
  { id: "map", label: "地图", mark: "图" },
  { id: "todo", label: "待办", mark: "办" },
  { id: "me", label: "我的", mark: "我" },
];

export function MobileAppShell({
  activeView,
  onChange,
}: {
  activeView: MobileView;
  onChange: (view: MobileView) => void;
}) {
  return (
    <nav className="mobile-bottom-nav" aria-label="手机功能导航">
      {views.map((view) => (
        <a
          key={view.id}
          href={`#${view.id}`}
          aria-current={activeView === view.id ? "page" : undefined}
          onClick={(event) => {
            event.preventDefault();
            onChange(view.id);
          }}
        >
          <span aria-hidden="true">{view.mark}</span>
          {view.label}
        </a>
      ))}
    </nav>
  );
}
