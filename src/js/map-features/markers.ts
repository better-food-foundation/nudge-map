import { CircleMarker, FeatureGroup, Map } from "leaflet";

import { PlaceFilterManager } from "../state/FilterState";
import { ViewStateObservable } from "../layout/viewToggle";
import type { PlaceId } from "../model/types";
import { radiusGivenZoom } from "./markerUtils";
import { determinePlaceIdWithoutCountry } from "../model/placeId";

const MARKER_STYLE = {
  weight: 1,
  color: "white",
  fillColor: "#F05B43",
  fillOpacity: 1,
} as const;

/** We store the placeId on the marker to know which place a Marker corresponds to. */
export type MarkerWithPlaceId = CircleMarker & { placeId: PlaceId };

function updatePlaceVisibility(
  currentlyVisiblePlaceIds: Set<string>,
  newVisiblePlaceIds: Set<PlaceId>,
  placesToMarkers: Record<string, MarkerWithPlaceId>,
  markerGroup: FeatureGroup,
): void {
  // Remove markers no longer visible.
  for (const placeId of currentlyVisiblePlaceIds) {
    if (!newVisiblePlaceIds.has(placeId)) {
      // @ts-expect-error the API allows passing a LayerGroup, but the type hint doesn't show this.
      placesToMarkers[placeId].removeFrom(markerGroup);
    }
  }

  // Add new markers not yet visible.
  for (const placeId of newVisiblePlaceIds) {
    if (!currentlyVisiblePlaceIds.has(placeId)) {
      placesToMarkers[placeId].addTo(markerGroup);
    }
  }
}

export default function initPlaceMarkers(
  filterManager: PlaceFilterManager,
  map: Map,
  viewToggle: ViewStateObservable,
): FeatureGroup {
  const placesToMarkers: Record<string, MarkerWithPlaceId> = Object.entries(
    filterManager.entries,
  ).reduce((acc: Record<string, MarkerWithPlaceId>, [placeId, entry]) => {
    const [long, lat] = entry.place.coord;
    const marker = new CircleMarker([lat, long], {
      ...MARKER_STYLE,
      radius: radiusGivenZoom(map.getZoom()),
    }) as MarkerWithPlaceId;
    marker.placeId = placeId;

    // The tooltip is the text shown on hover. We strip the country
    // to make it less verbose.
    marker.bindTooltip(determinePlaceIdWithoutCountry(entry.place));

    acc[placeId] = marker;
    return acc;
  }, {});

  const markerGroup = new FeatureGroup();
  let currentlyVisiblePlaceIds = new Set<string>();

  // When on table view, we should only lazily update the map the next time
  // we switch to map view.
  let dataRefreshQueued = false;

  filterManager.subscribe("update map markers", () => {
    if (viewToggle.getValue() === "table") {
      dataRefreshQueued = true;
      return;
    }

    updatePlaceVisibility(
      currentlyVisiblePlaceIds,
      filterManager.placeIds,
      placesToMarkers,
      markerGroup,
    );
    currentlyVisiblePlaceIds = filterManager.placeIds;
  });

  viewToggle.subscribe((view) => {
    if (view === "map" && dataRefreshQueued) {
      updatePlaceVisibility(
        currentlyVisiblePlaceIds,
        filterManager.placeIds,
        placesToMarkers,
        markerGroup,
      );
      currentlyVisiblePlaceIds = filterManager.placeIds;
      dataRefreshQueued = false;
    }
  }, "apply queued map data refresh");

  // Adjust marker size on zoom changes.
  map.addEventListener("zoomend", () => {
    const zoom = map.getZoom();
    // TODO: remove placeId since we're just accessing marker
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    Object.values(placesToMarkers).forEach((marker) => {
      const newRadius = radiusGivenZoom(
        zoom,
      );
      marker.setRadius(newRadius);
    });
  });

  markerGroup.addTo(map);
  return markerGroup;
}
