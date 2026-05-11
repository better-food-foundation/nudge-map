import { isEqual } from "lodash-es";

import type { FilterState } from "./FilterState";
import { FILTER_OPTIONS } from "../filter-features/options";
import { COUNTRY_MAPPING } from "../model/data";
import { POPULATION_MAX_INDEX } from "../filter-features/consumerBaseSlider";

export const MERGED_STRING_SET_OPTIONS = {
  placeType: new Set(FILTER_OPTIONS.merged.placeType),
  includedNudges: new Set(FILTER_OPTIONS.merged.includedNudges),
  country: new Set(FILTER_OPTIONS.merged.country),
  year: new Set(FILTER_OPTIONS.merged.year),
  orgCredit: new Set(FILTER_OPTIONS.merged.orgCredit),
};

export const DEFAULT_FILTER_STATE: FilterState = {
  searchInput: null,
  nudgeTypeFilter: "any nudge",
  status: "adopted",
  ...MERGED_STRING_SET_OPTIONS,
  consumerBaseSliderIndexes: [0, POPULATION_MAX_INDEX],
};

const ARRAY_DELIMITER = ".";

class BidirectionalMap<K extends string, V extends string> {
  private constructor(
    private encodeMap: Record<K, V>,
    private decodeMap: Record<V, K>,
  ) {
    this.encodeMap = encodeMap;
    this.decodeMap = decodeMap;
  }

  static from<const T extends ReadonlyArray<readonly [string, string]>>(
    entries: T,
  ) {
    type Entry = T[number];
    const encodeMap = Object.fromEntries(entries) as Record<Entry[0], Entry[1]>;
    const decodeMap = Object.fromEntries(
      entries.map(([a, b]) => [b, a]),
    ) as Record<Entry[1], Entry[0]>;

    return new BidirectionalMap(encodeMap, decodeMap);
  }

  keys(): Set<string> {
    return new Set(Object.keys(this.encodeMap));
  }

  encode(key: K): V {
    return this.encodeMap[key];
  }

  encodeSet(keys: Set<string>): string {
    return Array.from(keys)
      .map((key) => this.encode(key as K))
      .join(ARRAY_DELIMITER);
  }

  decode(value: string | null): K | null {
    if (value === null) return null;
    return this.decodeMap[value as V] ?? null;
  }

  decodeSet(value: string | null, fallback: Set<string>): Set<string> {
    if (value === null) return fallback;
    const parsed = new Set(
      value
        .split(ARRAY_DELIMITER)
        .map((v) => this.decode(v))
        .filter((v) => v !== null),
    );
    return parsed.size ? parsed : fallback;
  }
}
export const NUDGE_TYPE_NAME = "nudge";
export const STATUS_NAME = "status";
export const YEAR_NAME = "yr";
export const COUNTRY_NAME = "cntry";
export const PLACE_TYPE_NAME = "inst";
export const INCLUDED_NUDGE_NAME = "nudges";
export const ORG_NAME = "org";
export const CONSUMER_BASE_NAME = "cb";

export const NUDGE_TYPE_MAP = BidirectionalMap.from([
  ["any nudge", "any"],
  ["plant-based default", "pbd"],
  ["climate-friendly ratio", "cpr"],
  ["subtle substitution", "ss"],
  ["tasty titles & descriptions", "tt"],
  ["prime placement", "pp"],
  ["other", "oth"],
]);
export const STATUS_MAP = BidirectionalMap.from([
  ["adopted", "a"],
  ["pledged", "p"],
]);
export const PLACE_TYPE_MAP = BidirectionalMap.from([
  ["University Dining Hall", "ud"],
  ["University Cafe", "uc"],
  ["University Event", "ue"],
  ["K-12", "k12"],
  ["Workplace Cafeteria", "wc"],
  ["Ind. Restaurant", "ir"],
  ["Chain Restaurant", "cr"],
  ["Cafe", "cfe"],
  ["Stadium", "std"],
  ["Event", "evt"],
  ["Hotel", "htl"],
  ["Transit Station", "ts"],
  ["Hospital", "hsp"],
  ["Religious Center", "rc"],
  ["City/Government", "gf"],
  ["Other", "othp"],
]);
export const COUNTRY_MAP = BidirectionalMap.from(
  Object.entries(COUNTRY_MAPPING).map(([code, country]) => [
    country!,
    code.toLowerCase(),
  ]),
);
export const YEAR_MAP = BidirectionalMap.from(
  Array.from(MERGED_STRING_SET_OPTIONS.year).map((year) => [year, year]),
);

export const ORG_CREDIT_MAP = BidirectionalMap.from(
  Array.from(MERGED_STRING_SET_OPTIONS.orgCredit).map((org) => [org, org]),
);

export function encodeFilterState(filterState: FilterState): URLSearchParams {
  const result = new URLSearchParams();

  if (!isEqual(filterState.country, DEFAULT_FILTER_STATE.country)) {
    result.append(COUNTRY_NAME, COUNTRY_MAP.encodeSet(filterState.country));
  }

  // TODO: add other filters to URL params (e.g. year, consumer base)

  result.sort();
  return result;
}

export function decodeConsumerBase(str: string | null): [number, number] {
  if (str === null) return DEFAULT_FILTER_STATE.consumerBaseSliderIndexes;
  let left: number;
  let right: number;
  try {
    const split = str.split(ARRAY_DELIMITER);
    if (split.length !== 2)
      return DEFAULT_FILTER_STATE.consumerBaseSliderIndexes;
    left = Number.parseInt(split[0], 10);
    right = Number.parseInt(split[1], 10);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e) {
    return DEFAULT_FILTER_STATE.consumerBaseSliderIndexes;
  }
  const isValid = left >= 0 && right <= POPULATION_MAX_INDEX && left < right;
  return isValid
    ? [left, right]
    : DEFAULT_FILTER_STATE.consumerBaseSliderIndexes;
}

export function queryStringToParams(queryString: string): URLSearchParams {
  const cleanQuery = queryString.startsWith("?")
    ? queryString.slice(1)
    : queryString;
  return new URLSearchParams(cleanQuery);
}

export function decodeFilterState(queryString: string): FilterState {
  const params = queryStringToParams(queryString);
  return {
    searchInput: DEFAULT_FILTER_STATE.searchInput,
    nudgeTypeFilter:
      NUDGE_TYPE_MAP.decode(params.get(NUDGE_TYPE_NAME)) ??
      DEFAULT_FILTER_STATE.nudgeTypeFilter,
    status:
      STATUS_MAP.decode(params.get(STATUS_NAME)) ?? DEFAULT_FILTER_STATE.status,
    includedNudges: NUDGE_TYPE_MAP.decodeSet(
      params.get(INCLUDED_NUDGE_NAME),
      DEFAULT_FILTER_STATE.includedNudges,
    ),
    year: YEAR_MAP.decodeSet(params.get(YEAR_NAME), DEFAULT_FILTER_STATE.year),
    country: COUNTRY_MAP.decodeSet(
      params.get(COUNTRY_NAME),
      DEFAULT_FILTER_STATE.country,
    ),
    placeType: PLACE_TYPE_MAP.decodeSet(
      params.get(PLACE_TYPE_NAME),
      DEFAULT_FILTER_STATE.placeType,
    ),
    consumerBaseSliderIndexes: decodeConsumerBase(
      params.get(CONSUMER_BASE_NAME),
    ),
    orgCredit: ORG_CREDIT_MAP.decodeSet(
      params.get(ORG_NAME),
      DEFAULT_FILTER_STATE.orgCredit,
    ),
  };
}
