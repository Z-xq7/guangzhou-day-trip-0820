import type { DiscoveryPlace, EditorialDimensions } from "./discovery-types";

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
