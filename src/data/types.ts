export type Scenario = "normal" | "rain" | "delay";

export type MobileView = "route" | "map" | "todo" | "me";

export interface StopPhoto {
  src: string;
  alt: string;
  caption?: string;
  author: string;
  sourceUrl: string;
  license: string;
}

export interface ScheduleEntry {
  id: string;
  title: string;
  start: string;
  end: string;
}

export interface ItineraryStop extends ScheduleEntry {
  durationMinutes: number;
  shortTitle: string;
  category: string;
  summary: string;
  detail: string;
  highlights: string[];
  food: string[];
  priceLabel: string;
  reservation: string;
  placeName: string;
  placeRegion?: string;
  navigationMode: "walk" | "bus" | "car";
  transport: string;
  photo?: StopPhoto;
  showOnMap: boolean;
  comparisons?: ChoiceComparison[];
}

export type ScenarioStopOverride = Partial<Omit<ItineraryStop, "id" | "photo">>;

export interface ScenarioPlan {
  removedStopIds: string[];
  stopOverrides: Record<string, ScenarioStopOverride>;
  budgetOverrides: Record<string, Pick<BudgetItem, "min" | "max">>;
}

export interface BudgetItem {
  id: string;
  min: number;
  max: number;
}

export interface BookingItem {
  id: string;
  title: string;
  status: string;
  url: string;
}

export interface ChoiceComparison {
  id: string;
  badge: string;
  title: string;
  cost: string;
  time: string;
  description: string;
  recommended?: boolean;
}

export interface TravelSegment {
  id: string;
  fromStopId: string;
  toStopId: string;
  mode: "walk" | "metro" | "taxi" | "rail";
  durationMinutes: number;
  instruction: string;
}

export interface SourceInfo {
  id: string;
  title: string;
  publisher: string;
  verifiedAt: string;
  url: string;
}

export interface TripState {
  version: 2;
  scenario: Scenario;
  completedStopIds: string[];
  bookingIds: string[];
  activeView: MobileView;
}
