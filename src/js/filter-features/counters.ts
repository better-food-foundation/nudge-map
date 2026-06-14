import { isEqual } from "lodash-es";

import { FilterState, PlaceFilterManager, NudgeTypeFilter, NudgeStatusFilter } from "../state/FilterState";
import { PlaceId, ProcessedCoreEntry, PlaceType, NudgeType, NudgeStatus } from "../model/types";
import { COUNTRIES_PREFIXED_BY_THE } from "../model/data";
import { encodedPlaceToUrl } from "../model/placeId";
import type { ViewState } from "../layout/viewToggle";

export function determinePlaceDescription(
  numPlaces: number,
  matchedCountries: Set<string>,
): string {
  let country =
    matchedCountries.size === 1
      ? Array.from(matchedCountries)[0]
      : `${matchedCountries.size} countries`;
  if (COUNTRIES_PREFIXED_BY_THE.has(country)) {
    country = `the ${country}`;
  }

  const label = numPlaces === 1 ? "place" : "places";
  return `${numPlaces} ${label} in ${country}`;
}

export const SEARCH_RESET_HTML = `<button class="counter-search-reset" role="button" aria-label="reset search">reset search</button>`;
export const TABLE_DOWNLOAD_HTML = `<button class="counter-table-download" role="button" aria-label="download table as CSV">download as CSV</button>`;

export function determineSearch(
  view: ViewState,
  placeId: string,
  encodedPlace: string,
  nudgeType: NudgeTypeFilter,
  status: NudgeStatusFilter,
): string {
  const placeLink = `<a class="external-link" target="_blank" href=${encodedPlaceToUrl(
    encodedPlace,
  )}>${placeId} <i aria-hidden="true" class="fa-solid fa-arrow-right"></i></a>`;

  if (view === "map") {
    return `Showing ${placeLink} — ${SEARCH_RESET_HTML}`;
  }

  const statusLabel = status === "any status" ? "adopeted and pledged" : status;
  const suffix = `in ${placeLink} — ${SEARCH_RESET_HTML}`;
  switch (nudgeType) {
    case "any nudge":
      return `Showing an overview of ${statusLabel} nudges ${suffix}`;
    case "plant-based default":
      return `Showing ${statusLabel} plant-based default nudges ${suffix}`;
    case "climate-friendly ratio":
      return `Showing ${statusLabel} climate-friendly ratio nudges ${suffix}`;
    case "subtle substitution":
      return `Showing ${statusLabel} subtle substitution nudges ${suffix}`;
    case "tasty titles & descriptions":
      return `Showing ${statusLabel} tasty titles & descriptions nudges ${suffix}`;
    case "prime placement":
      return `Showing ${statusLabel} prime placement nudges ${suffix}`;
    case "other":
      return `Showing ${statusLabel} other nudges ${suffix}`;
  }
}

export function determineAnyNudge(
  view: ViewState,
  placeDescription: string,
  matchedNudgeTypes: Set<NudgeType>,
  stateNudgeTypes: Set<string>,
  state: NudgeStatusFilter,
): string {
  if (view === "table") {
    return `Showing an overview of ${state} nudges in ${placeDescription} - ${TABLE_DOWNLOAD_HTML}`;
  }

  interface Description {
    singleNudge: string;
    multipleNudges: string;
  }

  const prefix = `Showing ${placeDescription} with`;
  const nudgeDescriptionMap: Record<NudgeType, Description> = {
    "plant-based default": {
      singleNudge: "plant-based defaults",
      multipleNudges: "defaults",
    },
    "climate-friendly ratio": {
      singleNudge: "climate-friendly ratios",
      multipleNudges: "ratios",
    },
    "subtle substitution": {
      singleNudge: "subtle substitutions",
      multipleNudges: "substitutions",
    },
    "tasty titles & descriptions": {
      singleNudge: "tasty titles & descriptions",
      multipleNudges: "titles",
    },
    "prime placement": {
      singleNudge: "prime placements",
      multipleNudges: "placements",
    },
    "other": {
      singleNudge: "other nudges",
      multipleNudges: "other nudges",
    },
  };
  const nudgeDescriptions = Array.from(stateNudgeTypes)
    .filter((nudge) => matchedNudgeTypes.has(nudge as NudgeType))
    .map((nudge) => nudgeDescriptionMap[nudge as NudgeType]);
  if (!nudgeDescriptions.length) {
    throw new Error(`Expected state.includedNudgeChanges to be set`);
  }
  if (nudgeDescriptions.length === 1) {
    return `${prefix} ${state} ${nudgeDescriptions[0].singleNudge}`;
  }

  // Else, multiple nudges. Format as a list.
  const listItems = nudgeDescriptions
    .map((description) => `<li>${description.multipleNudges}</li>`)
    .sort()
    .join("");
  return `${prefix} 1+ ${state} parking reforms:<ul>${listItems}</ul>`;
}

export function determineDefault(
  view: ViewState,
  placeDescription: string,
  status: NudgeStatusFilter,
): string {
  return view === "map"
    ? `Showing ${placeDescription} with ${status} plant-based defaults`
    : `Showing details about ${status} plant-based defaults for ${placeDescription} - ${TABLE_DOWNLOAD_HTML}`;
}

export function determineRatio(
  view: ViewState,
  placeDescription: string,
  status: NudgeStatusFilter,
): string {
  return view === "map"
    ? `Showing ${placeDescription} with ${status} climate-friendly ratios`
    : `Showing details about ${status} climate-friendly ratios for ${placeDescription} - ${TABLE_DOWNLOAD_HTML}`;
}

export function determineSubstitution(
  view: ViewState,
  placeDescription: string,
  status: NudgeStatusFilter,
): string {
  return view === "map"
    ? `Showing ${placeDescription} with ${status} subtle substitutions`
    : `Showing details about ${status} subtle substitutions for ${placeDescription} - ${TABLE_DOWNLOAD_HTML}`;
}

export function determineTitles(
  view: ViewState,
  placeDescription: string,
  status: NudgeStatusFilter,
): string {
  return view === "map"
    ? `Showing ${placeDescription} with ${status} tasty titles & descriptions`
    : `Showing details about ${status} tasty titles & descriptions for ${placeDescription} - ${TABLE_DOWNLOAD_HTML}`;
}

export function determinePlacement(
  view: ViewState,
  placeDescription: string,
  status: NudgeStatusFilter,
): string {
  return view === "map"
    ? `Showing ${placeDescription} with ${status} prime placements`
    : `Showing details about ${status} prime placements for ${placeDescription} - ${TABLE_DOWNLOAD_HTML}`;
}

export function determineOther(
  view: ViewState,
  placeDescription: string,
  status: NudgeStatusFilter,
): string {
  return view === "map"
    ? `Showing ${placeDescription} with ${status} other nudges`
    : `Showing details about ${status} other nudges for ${placeDescription} - ${TABLE_DOWNLOAD_HTML}`;
}

export function determineHtml(
  view: ViewState,
  state: FilterState,
  entries: Record<PlaceId, ProcessedCoreEntry>,
  numPlaces: number,
  matchedCountries: Set<string>,
  matchedNudgeTypes: Set<NudgeType>,
): string {
  if (!numPlaces) {
    return "No places selected — use the filter or search icons";
  }
  if (state.searchInput) {
    const placeId = state.searchInput;
    return determineSearch(
      view,
      placeId,
      entries[placeId].place.encoded,
      state.nudgeTypeFilter,
      state.status,
    );
  }

  const placeDescription = determinePlaceDescription(
    numPlaces,
    matchedCountries,
  );

  switch (state.nudgeTypeFilter) {
    case "any nudge":
      return determineAnyNudge(
        view,
        placeDescription,
        matchedNudgeTypes,
        state.includedNudges,
        state.status,
      );
    case "plant-based default":
      return determineDefault(view, placeDescription, state.status);
    case "climate-friendly ratio":
      return determineRatio(view, placeDescription, state.status);
    case "subtle substitution":
      return determineSubstitution(view, placeDescription, state.status);
    case "tasty titles & descriptions":
      return determineTitles(view, placeDescription, state.status);
    case "prime placement":
      return determinePlacement(view, placeDescription, state.status);
    case "other":
      return determineOther(view, placeDescription, state.status);
    default:
      throw new Error(`Unexpected nudge type: ${state.nudgeTypeFilter}`);
  }
}

function setUpResetButton(
  counterContainer: HTMLElement,
  manager: PlaceFilterManager,
): void {
  counterContainer.addEventListener("click", (event) => {
    if (
      event.target instanceof Element &&
      event.target.matches(".counter-search-reset")
    ) {
      manager.update({ searchInput: null });
    }
  });
}

export default function initCounters(manager: PlaceFilterManager): void {
  const mapCounter = document.getElementById("map-counter");
  const tableCounter = document.getElementById("table-counter");
  if (!mapCounter || !tableCounter) return;

  setUpResetButton(mapCounter, manager);
  setUpResetButton(tableCounter, manager);

  manager.subscribe("update counters", (state) => {
    mapCounter.innerHTML = determineHtml(
      "map",
      state,
      manager.entries,
      manager.placeIds.size,
      manager.matchedCountries,
      manager.matchedNudgeTypes,
    );
    tableCounter.innerHTML = determineHtml(
      "table",
      state,
      manager.entries,
      manager.placeIds.size,
      manager.matchedCountries,
      manager.matchedNudgeTypes,
    );
  });
}
