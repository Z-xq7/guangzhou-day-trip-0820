import { describe, expect, it } from "vitest";
import { discoveryPlaces } from "../src/data/discovery";
import {
  buildDiscoveryBaiduUrl,
  defaultDiscoveryFilters,
  encodeDiscoveryHash,
  filterDiscoveryPlaces,
  parseDiscoveryHash,
  sortDiscoveryPlaces,
} from "../src/features/discovery/discovery-logic";

describe("discovery search and filters", () => {
  it("searches aliases, districts, themes, highlights, and food names", () => {
    expect(
      filterDiscoveryPlaces(discoveryPlaces, {
        ...defaultDiscoveryFilters,
        query: "双皮奶",
      }).map((place) => place.id),
    ).toEqual(["nanxin-dessert"]);
    expect(
      filterDiscoveryPlaces(discoveryPlaces, {
        ...defaultDiscoveryFilters,
        query: "xiguan",
      }).some((place) => place.id === "yongqingfang"),
    ).toBe(true);
    expect(
      filterDiscoveryPlaces(discoveryPlaces, {
        ...defaultDiscoveryFilters,
        query: "  CANTON   TOWER ",
      }).map((place) => place.id),
    ).toEqual(["canton-tower"]);
  });

  it("combines groups with AND and selected values inside a group with OR", () => {
    const result = filterDiscoveryPlaces(discoveryPlaces, {
      ...defaultDiscoveryFilters,
      kind: "attraction",
      districts: ["荔湾", "越秀"],
      audiences: ["rain"],
      priceLevels: ["free", "low"],
    });

    expect(result.length).toBeGreaterThan(0);
    expect(result.every((place) => place.kind === "attraction")).toBe(true);
    expect(result.every((place) => ["荔湾", "越秀"].includes(place.district))).toBe(true);
    expect(result.every((place) => place.recommendedFor.includes("rain"))).toBe(true);
    expect(result.every((place) => ["free", "low"].includes(place.priceLevel))).toBe(true);
  });

  it("returns an empty collection when no place satisfies all active groups", () => {
    expect(
      filterDiscoveryPlaces(discoveryPlaces, {
        ...defaultDiscoveryFilters,
        kind: "food",
        districts: ["白云"],
      }),
    ).toEqual([]);
  });
});

describe("discovery sorting", () => {
  it("sorts editorial and audience scores descending with catalog order as a tie-breaker", () => {
    const sample = discoveryPlaces.filter((place) =>
      ["chen-clan-academy", "shamian", "nanxin-dessert"].includes(place.id),
    );
    expect(sortDiscoveryPlaces(sample, "editorial").map((place) => place.id)).toEqual([
      "nanxin-dessert",
      "chen-clan-academy",
      "shamian",
    ]);
    expect(sortDiscoveryPlaces(sample, "couple").map((place) => place.id)).toEqual([
      "chen-clan-academy",
      "shamian",
      "nanxin-dessert",
    ]);
  });

  it("sorts duration and budget by their hand-calculated averages without mutating input", () => {
    const sample = discoveryPlaces.filter((place) =>
      ["baiyun-mountain", "shamian", "canton-tower"].includes(place.id),
    );
    const original = sample.map((place) => place.id);

    expect(sortDiscoveryPlaces(sample, "duration").map((place) => place.id)).toEqual([
      "shamian",
      "canton-tower",
      "baiyun-mountain",
    ]);
    expect(sortDiscoveryPlaces(sample, "budget").map((place) => place.id)).toEqual([
      "shamian",
      "baiyun-mountain",
      "canton-tower",
    ]);
    expect(sample.map((place) => place.id)).toEqual(original);
  });
});

describe("discovery hash state", () => {
  it("round-trips a discovery detail and non-default filters", () => {
    const hash = encodeDiscoveryHash({
      placeId: "chen-clan-academy",
      filters: {
        ...defaultDiscoveryFilters,
        query: "岭南",
        themes: ["岭南文化"],
        districts: ["荔湾"],
        audiences: ["couple", "rain"],
        priceLevels: ["free", "low"],
        sort: "couple",
      },
    });

    expect(parseDiscoveryHash(hash)).toEqual({
      placeId: "chen-clan-academy",
      filters: {
        ...defaultDiscoveryFilters,
        query: "岭南",
        themes: ["岭南文化"],
        districts: ["荔湾"],
        audiences: ["couple", "rain"],
        priceLevels: ["free", "low"],
        sort: "couple",
      },
    });
  });

  it("falls back safely for unknown IDs and unknown enum values", () => {
    expect(parseDiscoveryHash("#discover/not-a-place?kind=hotel&sort=random")).toEqual({
      placeId: null,
      filters: defaultDiscoveryFilters,
    });
  });

  it("returns null for non-discovery or malformed percent-encoded hashes", () => {
    expect(parseDiscoveryHash("#route")).toBeNull();
    expect(parseDiscoveryHash("#discover/%E0%A4%A")).toBeNull();
  });
});

describe("discovery Baidu links", () => {
  it("builds an encoded Baidu place search without coordinate-system leakage", () => {
    const url = new URL(buildDiscoveryBaiduUrl("陈家祠"));
    expect(url.hostname).toBe("api.map.baidu.com");
    expect(url.pathname).toBe("/place/search");
    expect(url.searchParams.get("query")).toBe("广州 陈家祠");
    expect(url.searchParams.get("region")).toBe("广州");
    expect(url.searchParams.has("location")).toBe(false);
  });
});
