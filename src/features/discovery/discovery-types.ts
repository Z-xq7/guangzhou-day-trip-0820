export type DiscoveryKind = "attraction" | "food";
export type PriceLevel = "free" | "low" | "medium" | "high";
export type IndoorOutdoor = "indoor" | "outdoor" | "mixed";
export type DiscoveryAudience = "couple" | "family" | "elder" | "rain" | "night";
export type DiscoverySort = "editorial" | "couple" | "family" | "duration" | "budget";

export interface EditorialDimensions {
  distinctiveness: number;
  completeness: number;
  coupleAppeal: number;
  convenience: number;
  value: number;
}

export interface LicensedDiscoveryPhoto {
  src: string;
  alt: string;
  caption: string;
  author: string;
  sourceUrl: string;
  license: string;
  licenseUrl: string;
  modifications: string;
  isRepresentativeOnly?: boolean;
}

export interface SourceRef {
  title: string;
  publisher: string;
  url: string;
  verifiedAt: string;
}

export interface VerifiedPlatformRating {
  platform: string;
  score: number;
  scale: number;
  url: string;
  verifiedAt: string;
}

export interface DiscoveryPlace {
  id: string;
  index: number;
  kind: DiscoveryKind;
  name: string;
  aliases: string[];
  district: string;
  coordinate: { lat: number; lng: number };
  mapLabelOffset?: { x: number; y: number };
  summary: string;
  description: string;
  themes: string[];
  recommendedFor: DiscoveryAudience[];
  audienceScores: { couple: number; family: number; elder: number; rain: number };
  indoorOutdoor: IndoorOutdoor;
  bestTime: string;
  durationMinutes: [number, number];
  budgetPerPerson: [number, number];
  priceLevel: PriceLevel;
  highlights: string[];
  transit: string;
  opening: string;
  nearbyPlaceIds: string[];
  baiduPlaceName: string;
  photo: LicensedDiscoveryPhoto;
  editorialDimensions: EditorialDimensions;
  platformRating?: VerifiedPlatformRating;
  sources: SourceRef[];
  verifiedAt: string;
}

export interface DiscoveryFilters {
  query: string;
  kind: "all" | DiscoveryKind;
  themes: string[];
  districts: string[];
  audiences: DiscoveryAudience[];
  priceLevels: PriceLevel[];
  sort: DiscoverySort;
}
