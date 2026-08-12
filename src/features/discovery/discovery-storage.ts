import { discoveryPlaces } from "../../data/discovery";
import { updateTripState } from "../trip/trip-storage";

const knownDiscoveryIds = new Set(discoveryPlaces.map((place) => place.id));

export function toggleWishlistPlace(id: string) {
  if (!knownDiscoveryIds.has(id)) return;
  updateTripState((state) => ({
    ...state,
    wishlistPlaceIds: state.wishlistPlaceIds.includes(id)
      ? state.wishlistPlaceIds.filter((value) => value !== id)
      : [...state.wishlistPlaceIds, id],
  }));
}

export function clearWishlist() {
  updateTripState((state) => ({ ...state, wishlistPlaceIds: [] }));
}
