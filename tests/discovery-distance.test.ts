import { describe, expect, it } from "vitest";
import { formatDistanceKm, haversineDistanceKm } from "../src/features/discovery/discovery-distance";

describe("discovery distance", () => {
  it("returns zero for an identical point", () => {
    const point = { lat: 23.1294, lng: 113.2443 };
    expect(haversineDistanceKm(point, point)).toBe(0);
  });

  it("measures Chen Clan Academy to Canton Tower", () => {
    const value = haversineDistanceKm(
      { lat: 23.1294, lng: 113.2443 },
      { lat: 23.1064, lng: 113.3245 },
    );
    expect(value).toBeGreaterThan(8.4);
    expect(value).toBeLessThan(8.8);
  });

  it.each([[0, "0 公里"], [0.04, "少于 0.1 公里"], [0.76, "0.8 公里"], [8.64, "8.6 公里"]])(
    "formats %s km as %s",
    (value, expected) => expect(formatDistanceKm(value as number)).toBe(expected),
  );
});
