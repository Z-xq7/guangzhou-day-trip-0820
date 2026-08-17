export interface GeoPoint { lat: number; lng: number }

const EARTH_RADIUS_KM = 6371.0088;
const radians = (degrees: number) => degrees * Math.PI / 180;

export function haversineDistanceKm(from: GeoPoint, to: GeoPoint) {
  if (from.lat === to.lat && from.lng === to.lng) return 0;
  const latitudeDelta = radians(to.lat - from.lat);
  const longitudeDelta = radians(to.lng - from.lng);
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(from.lat)) * Math.cos(radians(to.lat))
      * Math.sin(longitudeDelta / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function formatDistanceKm(distanceKm: number) {
  if (distanceKm === 0) return "0 公里";
  if (distanceKm < 0.05) return "少于 0.1 公里";
  return `${distanceKm.toFixed(1)} 公里`;
}
