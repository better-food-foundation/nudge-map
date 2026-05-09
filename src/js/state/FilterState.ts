import { isEqual } from "lodash-es";
import {
  ALL_NUDGE_TYPE,
  PlaceId,
  PlaceType,
  ProcessedCoreEntry,
  ProcessedPlace,
  NudgeStatus,
  NudgeType,
  ProcessedNudge,
  UNKNOWN_YEAR,
  UNKNOWN_ORG,
} from "../model/types";
import Observable from "./Observable";
import { determineAllNudgeTypes, getFilteredIndexes } from "../model/data";

export const POPULATION_INTERVALS: Array<[string, number]> = [
  ["100", 100],
  ["5k", 5000],
  ["25k", 25000],
  ["50k", 50000],
  ["100k", 100000],
  ["500k", 500000],
  ["1M", 1000000],
  ["10M", 10000000],
];

export const ALL_NUDGE_TYPE_FILTER = ["any nudge", ...ALL_NUDGE_TYPE] as const;
export type NudgeTypeFilter = (typeof ALL_NUDGE_TYPE_FILTER)[number];

// Note that this only tracks state set by the user.
// Computed values are handled elsewhere.
//
// This is a single unified global view of the state, even though we
// have multiple datasets like 'plant-based defaults'. Certain values
// within an option group are irrelevant to certain data sets; for example,
// while all datasets have 'country', their entries usually only have a subset
// of the total set of countries across all datsets. Nevertheless,
// we unify the state so that it persists when changing the nudge type.
//
// Keep key names in alignment with DataSetSpecificOptions in filter-features/options.ts
export interface FilterState {
  searchInput: string | null;
  nudgeTypeFilter: NudgeTypeFilter;
  status: NudgeStatus;
  placeType: Set<string>;
  includedNudges: Set<string>;
  country: Set<string>;
  year: Set<string>;
  consumerBaseSliderIndexes: [number, number];
  orgCredit: Set<string>;
}

interface PlaceMatchSearch {
  type: "search";
}

interface PlaceMatchSingleNudge {
  type: "single nudge";
  nudgeType: NudgeType;
  matchingIndexes: number[];
}

interface PlaceMatchAnyNudge {
  type: "any";
  // Note that we still record if a place has a certain nudge type
  // even if the filter state is actively ignoring that nudge.
  hasDefault: boolean;
  hasRatio: boolean;
  hasSub: boolean;
  hasTitles: boolean;
  hasPlacement: boolean;
  hasOther: boolean;
}

type PlaceMatch = PlaceMatchSearch | PlaceMatchSingleNudge | PlaceMatchAnyNudge;

// This allows us to avoid recomputing computed state when the FilterState has not changed.
interface CacheEntry {
  state: FilterState;
  matchedPlaces: Record<PlaceId, PlaceMatch>;
  matchedCountries: Set<string>;
  matchedNudgeTypesForAnyNudge: Set<NudgeType>;
  matchedPlaceTypes: Set<PlaceType>;
}

export class PlaceFilterManager {
  private readonly state: Observable<FilterState>;

  readonly entries: Record<PlaceId, ProcessedCoreEntry>;

  private cache: CacheEntry | null = null;

  constructor(
    entries: Record<PlaceId, ProcessedCoreEntry>,
    initialState: FilterState,
  ) {
    this.entries = entries;
    this.state = new Observable("FilterState", initialState);
  }

  get totalNumPlaces(): number {
    return Object.keys(this.entries).length;
  }

  get matchedPlaces(): Record<PlaceId, PlaceMatch> {
    return this.ensureCache().matchedPlaces;
  }

  get placeIds(): Set<PlaceId> {
    return new Set(Object.keys(this.matchedPlaces));
  }

  get matchedCountries(): Set<string> {
    return this.ensureCache().matchedCountries;
  }

  getState(): FilterState {
    return this.state.getValue();
  }

  update(changes: Partial<FilterState>): void {
    const priorState = this.state.getValue();
    this.state.setValue({ ...priorState, ...changes });
  }

  subscribe(id: string, observer: (state: FilterState) => void): void {
    this.state.subscribe(observer, id);
  }

  initialize(): void {
    this.state.initialize();
  }

  /// Recompute the CacheEntry if FilterState has changed.
  private ensureCache(): CacheEntry {
    const currentState = this.state.getValue();
    if (this.cache && isEqual(currentState, this.cache.state)) {
      return this.cache;
    }

    const matchedPlaces: Record<PlaceId, PlaceMatch> = {};
    const matchedCountries = new Set<string>();
    const matchedNudgeTypes = new Set<NudgeType>();
    const matchedPlaceTypes = new Set<PlaceType>();
    for (const placeId of Object.keys(this.entries)) {
      const match = this.getPlaceMatch(placeId);
      if (!match) continue;
      matchedPlaces[placeId] = match;
      matchedCountries.add(this.entries[placeId].place.country);
      matchedPlaceTypes.add(this.entries[placeId].place.type);
      if (match.type === "any") {
        if (match.hasDefault) matchedNudgeTypes.add("plant-based default");
        if (match.hasRatio) matchedNudgeTypes.add("climate-friendly ratio");
        if (match.hasSub) matchedNudgeTypes.add("subtle substitution");
        if (match.hasTitles)
          matchedNudgeTypes.add("tasty titles & descriptions");
        if (match.hasPlacement) matchedNudgeTypes.add("prime placement");
        if (match.hasOther) matchedNudgeTypes.add("other");
      }
    }

    this.cache = {
      state: currentState,
      matchedPlaces,
      matchedCountries,
      matchedNudgeTypesForAnyNudge: matchedNudgeTypes,
      matchedPlaceTypes,
    };
    return this.cache;
  }

  private matchesPlace(place: ProcessedPlace): boolean {
    const filterState = this.state.getValue();

    const isCountry = filterState.country.has(place.country);
    if (!isCountry) return false;

    const isPlaceType = filterState.placeType.has(place.type);
    if (!isPlaceType) return false;

    const [sliderLeftIndex, sliderRightIndex] =
      filterState.consumerBaseSliderIndexes;
    const isConsumerBase =
      place.consumer_base >= POPULATION_INTERVALS[sliderLeftIndex][1] &&
      place.consumer_base <= POPULATION_INTERVALS[sliderRightIndex][1];
    return isConsumerBase;
  }

  private matchesNudge(nudgeRecord: ProcessedNudge): boolean {
    const filterState = this.state.getValue();

    const isStatus = nudgeRecord.status === filterState.status;
    if (!isStatus) return false;

    const isYear = filterState.year.has(
      nudgeRecord.date?.parsed.year.toString() || UNKNOWN_YEAR,
    );
    if (!isYear) return false;

    const nudgeOrgs = nudgeRecord.org_credit ?? [];
    const isOrgCredit =
      nudgeOrgs.length > 0
        ? nudgeOrgs.some((org) => filterState.orgCredit.has(org))
        : filterState.orgCredit.has(UNKNOWN_ORG);
    if (!isOrgCredit) return false;

    return true;
  }

  private getPlaceMatch(placeId: PlaceId): PlaceMatch | null {
    const filterState = this.state.getValue();
    const entry = this.entries[placeId];

    // Search overrides filter config.
    if (filterState.searchInput) {
      return filterState.searchInput === placeId
        ? {
            type: "search",
          }
        : null;
    }

    const isPlace = this.matchesPlace(entry.place);
    if (!isPlace) return null;

    if (filterState.nudgeTypeFilter === "any nudge") {
      const nudgeTypes = determineAllNudgeTypes(entry, filterState.status);
      const isNudgeType = nudgeTypes.some((v) =>
        filterState.includedNudges.has(v),
      );
      return isNudgeType
        ? {
            type: "any",
            hasDefault: nudgeTypes.includes("plant-based default"),
            hasRatio: nudgeTypes.includes("climate-friendly ratio"),
            hasSub: nudgeTypes.includes("subtle substitution"),
            hasTitles: nudgeTypes.includes("tasty titles & descriptions"),
            hasPlacement: nudgeTypes.includes("prime placement"),
            hasOther: nudgeTypes.includes("other"),
          }
        : null;
    }

    if (filterState.nudgeTypeFilter === "plant-based default") {
      const matchingNudges = getFilteredIndexes(
        entry.default ?? [],
        (nudgeRecord) => this.matchesNudge(nudgeRecord),
      );
      return matchingNudges.length
        ? {
            type: "single nudge",
            nudgeType: "plant-based default",
            matchingIndexes: matchingNudges,
          }
        : null;
    }

    if (filterState.nudgeTypeFilter === "climate-friendly ratio") {
      const matchingNudges = getFilteredIndexes(
        entry.ratio ?? [],
        (nudgeRecord) => this.matchesNudge(nudgeRecord),
      );
      return matchingNudges.length
        ? {
            type: "single nudge",
            nudgeType: "climate-friendly ratio",
            matchingIndexes: matchingNudges,
          }
        : null;
    }

    if (filterState.nudgeTypeFilter === "subtle substitution") {
      const matchingNudges = getFilteredIndexes(
        entry.sub ?? [],
        (nudgeRecord) => this.matchesNudge(nudgeRecord),
      );
      return matchingNudges.length
        ? {
            type: "single nudge",
            nudgeType: "subtle substitution",
            matchingIndexes: matchingNudges,
          }
        : null;
    }

    if (filterState.nudgeTypeFilter === "tasty titles & descriptions") {
      const matchingNudges = getFilteredIndexes(
        entry.titles ?? [],
        (nudgeRecord) => this.matchesNudge(nudgeRecord),
      );
      return matchingNudges.length
        ? {
            type: "single nudge",
            nudgeType: "tasty titles & descriptions",
            matchingIndexes: matchingNudges,
          }
        : null;
    }

    if (filterState.nudgeTypeFilter === "prime placement") {
      const matchingNudges = getFilteredIndexes(
        entry.placement ?? [],
        (nudgeRecord) => this.matchesNudge(nudgeRecord),
      );
      return matchingNudges.length
        ? {
            type: "single nudge",
            nudgeType: "prime placement",
            matchingIndexes: matchingNudges,
          }
        : null;
    }

    if (filterState.nudgeTypeFilter === "other") {
      const matchingNudges = getFilteredIndexes(
        entry.other ?? [],
        (nudgeRecord) => this.matchesNudge(nudgeRecord),
      );
      return matchingNudges.length
        ? {
            type: "single nudge",
            nudgeType: "other",
            matchingIndexes: matchingNudges,
          }
        : null;
    }

    throw new Error(`Unrecognized nudge type`);
  }
}
