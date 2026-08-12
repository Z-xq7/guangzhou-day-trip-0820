import { discoveryPlaces } from "../../data/discovery";
import type {
  DiscoveryAudience,
  DiscoveryFilters,
  DiscoveryPlace,
  DiscoverySort,
  EditorialDimensions,
  PriceLevel,
} from "./discovery-types";

const SCORE_WEIGHTS: Record<keyof EditorialDimensions, number> = {
  distinctiveness: 0.3,
  completeness: 0.25,
  coupleAppeal: 0.2,
  convenience: 0.15,
  value: 0.1,
};

export function calculateEditorialScore(place: DiscoveryPlace) {
  const total = Object.entries(SCORE_WEIGHTS).reduce(
    (sum, [key, weight]) =>
      sum + place.editorialDimensions[key as keyof EditorialDimensions] * weight,
    0,
  );
  return Math.round(total * 10) / 10;
}

export function validateDiscoveryPlaces(places: DiscoveryPlace[]) {
  const errors: string[] = [];
  const ids = new Set(places.map((place) => place.id));
  const attractionCount = places.filter((place) => place.kind === "attraction").length;
  const foodCount = places.filter((place) => place.kind === "food").length;

  if (places.length !== 30) errors.push("expected exactly 30 places");
  if (attractionCount !== 21 || foodCount !== 9) {
    errors.push("expected 21 attractions and 9 food places");
  }
  if (ids.size !== places.length) errors.push("place IDs must be unique");

  places.forEach((place, arrayIndex) => {
    if (place.index !== arrayIndex + 1) errors.push(`${place.id}: invalid index`);
    if (
      place.coordinate.lat < 22.5 ||
      place.coordinate.lat > 24 ||
      place.coordinate.lng < 112.5 ||
      place.coordinate.lng > 114.5
    ) {
      errors.push(`${place.id}: invalid Guangzhou coordinate`);
    }
    if (
      !place.photo.author ||
      !place.photo.sourceUrl.startsWith("https://") ||
      !place.photo.license ||
      !place.photo.licenseUrl.startsWith("https://") ||
      !place.photo.modifications
    ) {
      errors.push(`${place.id}: incomplete photo credit`);
    }
    if (
      !place.sources.length ||
      place.sources.some(
        (source) =>
          !source.title ||
          !source.publisher ||
          !source.url.startsWith("https://") ||
          !/^\d{4}-\d{2}-\d{2}$/.test(source.verifiedAt),
      )
    ) {
      errors.push(`${place.id}: invalid sources`);
    }
    if (place.nearbyPlaceIds.some((id) => !ids.has(id) || id === place.id)) {
      errors.push(`${place.id}: unknown nearby place`);
    }
    if (Object.values(place.editorialDimensions).some((score) => score < 1 || score > 5)) {
      errors.push(`${place.id}: invalid score dimension`);
    }
    if (Object.values(place.audienceScores).some((score) => score < 1 || score > 5)) {
      errors.push(`${place.id}: invalid audience score`);
    }
    if (
      place.durationMinutes[0] < 0 ||
      place.durationMinutes[0] > place.durationMinutes[1] ||
      place.budgetPerPerson[0] < 0 ||
      place.budgetPerPerson[0] > place.budgetPerPerson[1]
    ) {
      errors.push(`${place.id}: invalid range`);
    }
    if (place.platformRating) {
      const rating = place.platformRating;
      if (
        rating.score < 0 ||
        rating.score > rating.scale ||
        !rating.url.startsWith("https://") ||
        !/^\d{4}-\d{2}-\d{2}$/.test(rating.verifiedAt)
      ) {
        errors.push(`${place.id}: invalid platform rating`);
      }
    }
  });

  return errors;
}

export const defaultDiscoveryFilters: DiscoveryFilters = {
  query: "",
  kind: "all",
  themes: [],
  districts: [],
  audiences: [],
  priceLevels: [],
  sort: "editorial",
};

function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase("zh-CN").replace(/\s+/g, " ");
}

function matchesOne<T extends string>(selected: T[], values: readonly T[]) {
  return selected.length === 0 || selected.some((value) => values.includes(value));
}

export function filterDiscoveryPlaces(
  places: DiscoveryPlace[],
  filters: DiscoveryFilters,
) {
  const query = normalizeSearch(filters.query);
  return places.filter((place) => {
    const haystack = normalizeSearch(
      [
        place.name,
        ...place.aliases,
        place.district,
        ...place.themes,
        ...place.highlights,
        place.summary,
      ].join(" "),
    );

    return (
      (!query || haystack.includes(query)) &&
      (filters.kind === "all" || place.kind === filters.kind) &&
      matchesOne(filters.districts, [place.district]) &&
      matchesOne(filters.themes, place.themes) &&
      matchesOne(filters.audiences, place.recommendedFor) &&
      matchesOne(filters.priceLevels, [place.priceLevel])
    );
  });
}

function average([minimum, maximum]: [number, number]) {
  return (minimum + maximum) / 2;
}

export function sortDiscoveryPlaces(
  places: DiscoveryPlace[],
  sort: DiscoverySort,
) {
  const sorted = [...places];
  const valueFor = (place: DiscoveryPlace) => {
    switch (sort) {
      case "couple":
        return -place.audienceScores.couple;
      case "family":
        return -place.audienceScores.family;
      case "duration":
        return average(place.durationMinutes);
      case "budget":
        return average(place.budgetPerPerson);
      case "editorial":
      default:
        return -calculateEditorialScore(place);
    }
  };

  return sorted.sort((left, right) => valueFor(left) - valueFor(right) || left.index - right.index);
}

const knownPlaceIds = new Set(discoveryPlaces.map((place) => place.id));
const knownThemes = new Set(discoveryPlaces.flatMap((place) => place.themes));
const knownDistricts = new Set(discoveryPlaces.map((place) => place.district));
const audienceValues = new Set<DiscoveryAudience>([
  "couple",
  "family",
  "elder",
  "rain",
  "night",
]);
const priceValues = new Set<PriceLevel>(["free", "low", "medium", "high"]);
const sortValues = new Set<DiscoverySort>([
  "editorial",
  "couple",
  "family",
  "duration",
  "budget",
]);

function getArrayParameter<T extends string>(
  search: URLSearchParams,
  key: string,
  allowed: Set<T> | Set<string>,
) {
  const value = search.get(key);
  if (!value) return [] as T[];
  return value.split(",").filter((item): item is T => allowed.has(item as T));
}

export interface DiscoveryHashState {
  placeId: string | null;
  filters: DiscoveryFilters;
}

export function encodeDiscoveryHash({ placeId, filters }: DiscoveryHashState) {
  const safePlaceId = placeId && knownPlaceIds.has(placeId) ? placeId : null;
  const path = safePlaceId ? `#discover/${encodeURIComponent(safePlaceId)}` : "#discover";
  const search = new URLSearchParams();

  if (filters.query.trim()) search.set("q", filters.query.trim());
  if (filters.kind !== "all") search.set("kind", filters.kind);
  if (filters.themes.length) search.set("themes", filters.themes.join(","));
  if (filters.districts.length) search.set("districts", filters.districts.join(","));
  if (filters.audiences.length) search.set("audiences", filters.audiences.join(","));
  if (filters.priceLevels.length) search.set("prices", filters.priceLevels.join(","));
  if (filters.sort !== "editorial") search.set("sort", filters.sort);

  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

export function parseDiscoveryHash(hash: string): DiscoveryHashState | null {
  const raw = hash.replace(/^#/, "");
  const queryIndex = raw.indexOf("?");
  const path = queryIndex >= 0 ? raw.slice(0, queryIndex) : raw;
  const query = queryIndex >= 0 ? raw.slice(queryIndex + 1) : "";
  const pathParts = path.split("/");
  if (pathParts[0] !== "discover" || pathParts.length > 2) return null;

  let decodedId: string | null = null;
  try {
    decodedId = pathParts[1] ? decodeURIComponent(pathParts[1]) : null;
  } catch {
    return null;
  }

  const search = new URLSearchParams(query);
  const rawKind = search.get("kind");
  const rawSort = search.get("sort");
  const kind = rawKind === "attraction" || rawKind === "food" ? rawKind : "all";
  const sort = rawSort && sortValues.has(rawSort as DiscoverySort)
    ? (rawSort as DiscoverySort)
    : "editorial";

  return {
    placeId: decodedId && knownPlaceIds.has(decodedId) ? decodedId : null,
    filters: {
      query: search.get("q") ?? "",
      kind,
      themes: getArrayParameter(search, "themes", knownThemes),
      districts: getArrayParameter(search, "districts", knownDistricts),
      audiences: getArrayParameter(search, "audiences", audienceValues),
      priceLevels: getArrayParameter(search, "prices", priceValues),
      sort,
    },
  };
}

const BAIDU_SOURCE = "webapp.Z-xq7.guangzhou-day-trip";

export function buildDiscoveryBaiduUrl(placeName: string) {
  const query = new URLSearchParams({
    query: `广州 ${placeName}`,
    region: "广州",
    output: "html",
    src: BAIDU_SOURCE,
  });
  return `https://api.map.baidu.com/place/search?${query.toString()}`;
}
