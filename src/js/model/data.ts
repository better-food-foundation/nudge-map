import { encodedPlaceToUrl } from "./placeId";
import {
  PlaceId,
  ProcessedCoreEntry,
  RawCoreEntry,
  RawPlace,
  ProcessedPlace,
  NudgeType,
  Date,
  NudgeStatus,
  RawNudge,
  ProcessedNudge,
} from "./types";

export const COUNTRIES_PREFIXED_BY_THE = new Set([
  "United States",
  "United Kingdom",
  "Netherlands",
]);

export const COUNTRY_MAPPING: Partial<Record<string, string>> = {
  AU: "Australia",
  AT: "Austria",
  BR: "Brazil",
  CA: "Canada",
  CH: "Switzerland",
  CK: "Cook Islands",
  CN: "China",
  DE: "Germany",
  DK: "Denmark",
  FI: "Finland",
  FR: "France",
  IE: "Ireland",
  IN: "India",
  IL: "Israel",
  IS: "Iceland",
  KR: "Korea",
  MX: "Mexico",
  NL: "Netherlands",
  NZ: "New Zealand",
  SE: "Sweden",
  SG: "Singapore",
  UK: "United Kingdom",
  US: "United States",
  ZA: "South Africa",
};

export function processPlace(raw: RawPlace): ProcessedPlace {
  return {
    ...raw,
    url: encodedPlaceToUrl(raw.encoded),
  };
}

export function determineAllNudgeTypes(
  entry: RawCoreEntry | ProcessedCoreEntry,
  status: NudgeStatus,
): NudgeType[] {
  const hasNudge = (nudges: Array<{ status: NudgeStatus }> | undefined) =>
    !!nudges?.filter((nudge) => nudge.status === status).length;

  const result: NudgeType[] = [];
  if (hasNudge(entry.default)) result.push("plant-based default");
  if (hasNudge(entry.ratio)) result.push("climate-friendly ratio");
  if (hasNudge(entry.sub)) result.push("subtle substitution");
  if (hasNudge(entry.titles)) result.push("tasty titles");
  if (hasNudge(entry.placement)) result.push("prime placement");
  if (hasNudge(entry.other)) result.push("other");
  return result;
}

export function determineNudgeTypeStatuses(
  entry: RawCoreEntry | ProcessedCoreEntry,
): Record<NudgeType, Set<NudgeStatus>> {
  const getStatuses = (nudges: Array<{ status: NudgeStatus }> | undefined) =>
    new Set(nudges?.map((nudge) => nudge.status) ?? []);
  return {
    "plant-based default": getStatuses(entry.default),
    "climate-friendly ratio": getStatuses(entry.ratio),
    "subtle substitution": getStatuses(entry.sub),
    "tasty titles": getStatuses(entry.titles),
    "prime placement": getStatuses(entry.placement),
    other: getStatuses(entry.other),
  };
}

function processNudge(raw: RawNudge): ProcessedNudge {
  return {
    ...raw,
    date: Date.fromNullable(raw.date),
  };
}

export function processRawCoreEntry(raw: RawCoreEntry): ProcessedCoreEntry {
  const result: ProcessedCoreEntry = {
    place: processPlace(raw.place),
  };

  if (raw.default) {
    result.default = raw.default.map(processNudge);
  }
  if (raw.ratio) {
    result.ratio = raw.ratio.map(processNudge);
  }
  if (raw.sub) {
    result.sub = raw.sub.map(processNudge);
  }
  if (raw.titles) {
    result.titles = raw.titles.map(processNudge);
  }
  if (raw.placement) {
    result.placement = raw.placement.map(processNudge);
  }
  if (raw.other) {
    result.other = raw.other.map(processNudge);
  }
  return result;
}

export default async function readData(): Promise<
  Record<PlaceId, ProcessedCoreEntry>
> {
  const rawData = (await import("../../../data/core.json", {
    with: { type: "json" },
  })) as unknown as Record<PlaceId, RawCoreEntry>;
  return Object.fromEntries(
    Object.entries(rawData).map(([placeId, entry]) => [
      placeId,
      processRawCoreEntry(entry),
    ]),
  );
}

export function getFilteredIndexes<T>(
  array: T[],
  predicate: (value: T) => boolean,
): number[] {
  return array.reduce((indexes: number[], currentValue, currentIndex) => {
    if (predicate(currentValue)) {
      indexes.push(currentIndex);
    }
    return indexes;
  }, []);
}
