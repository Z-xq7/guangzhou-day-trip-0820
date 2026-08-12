import { describe, expect, it } from "vitest";
import { discoveryPlaces, featuredDiscoveryIds } from "../src/data/discovery";
import {
  calculateEditorialScore,
  validateDiscoveryPlaces,
} from "../src/features/discovery/discovery-logic";

describe("discovery data", () => {
  it("contains exactly 21 attractions and 9 food places with continuous indices", () => {
    expect(discoveryPlaces).toHaveLength(30);
    expect(discoveryPlaces.filter((place) => place.kind === "attraction")).toHaveLength(21);
    expect(discoveryPlaces.filter((place) => place.kind === "food")).toHaveLength(9);
    expect(discoveryPlaces.map((place) => place.index)).toEqual(
      Array.from({ length: 30 }, (_, index) => index + 1),
    );
  });

  it("has unique IDs, valid coordinates, complete licenses, sources, and nearby references", () => {
    expect(validateDiscoveryPlaces(discoveryPlaces)).toEqual([]);
  });

  it("calculates a one-decimal type-specific score instead of trusting a stored total", () => {
    const chenClan = discoveryPlaces.find((place) => place.id === "chen-clan-academy")!;
    expect(calculateEditorialScore(chenClan)).toBe(4.8);
    expect(calculateEditorialScore(chenClan)).toBeGreaterThanOrEqual(1);
    expect(calculateEditorialScore(chenClan)).toBeLessThanOrEqual(5);
  });

  it("uses six valid featured IDs", () => {
    expect(featuredDiscoveryIds).toHaveLength(6);
    expect(
      featuredDiscoveryIds.every((id) => discoveryPlaces.some((place) => place.id === id)),
    ).toBe(true);
  });
});
