import { DateTime } from "luxon";

export class Date {
  readonly raw: string;

  readonly parsed: DateTime<true>;

  constructor(raw: string) {
    this.raw = raw;
    const parsed = DateTime.fromISO(raw);
    if (!parsed.isValid) {
      throw new Error(`Invalid date string: ${raw}`);
    }
    this.parsed = parsed;
  }

  static fromNullable(dateStr: string | undefined): Date | undefined {
    return dateStr ? new this(dateStr) : undefined;
  }

  format(): string {
    if (this.raw.length === 4) return this.raw;
    if (this.raw.length === 7) return this.parsed.toFormat("LLL yyyy");
    return this.parsed.toFormat("LLL d, yyyy");
  }

  preposition(): "in" | "on" {
    return this.raw.length === 10 ? "on" : "in";
  }
}

export type PlaceId = string;

export const ALL_PLACE_TYPES = [
  "uni_dining",
  "uni_cafe",
  "uni_event",
  "k12",
  "work_cafeteria",
  "ind_restaurant",
  "chain_restaurant",
  "cafe",
  "stadium",
  "event",
  "hotel",
  "transit_station",
  "hospital",
  "religious_center",
  "gov_facility",
  "other",
] as const;
export type PlaceType = (typeof ALL_PLACE_TYPES)[number];

export interface RawPlace {
  // Full name of the place.
  name: string;
  // State or province abbreviation. Not set for countries.
  state: string | null;
  country: string;
  type: PlaceType;
  // The value used for the URL. Note that this may be an outdated value
  // so that we don't require a redirect.
  encoded: string;
  // [long, lat]
  coord: [number, number];
  consumer_base: number;
}
export type ProcessedPlace = RawPlace & { url: string };

export const ALL_NUDGE_TYPE = [
  "plant-based default",
  "climate-friendly ratio",
  "subtle substitution",
  "tasty titles",
  "prime placement",
  "other",
] as const;
export type NudgeType = (typeof ALL_NUDGE_TYPE)[number];

export const ALL_NUDGE_STATUS = ["adopted", "pledged"] as const;
export type NudgeStatus = (typeof ALL_NUDGE_STATUS)[number];

/// Every nudge type has a status.
export interface BaseNudge {
  status: NudgeStatus;
}

export type RawNudge = BaseNudge & {
  date: string | undefined;
};

export type ProcessedNudge = BaseNudge & {
  date: Date | undefined;
};
export interface RawCoreEntry {
  place: RawPlace;
  default?: RawNudge[];
  ratio?: RawNudge[];
  sub?: RawNudge[];
  titles?: RawNudge[];
  placement?: RawNudge[];
  other?: RawNudge[];
}
export interface ProcessedCoreEntry {
  place: ProcessedPlace;
  default?: ProcessedNudge[];
  ratio?: ProcessedNudge[];
  sub?: ProcessedNudge[];
  titles?: ProcessedNudge[];
  placement?: ProcessedNudge[];
  other?: ProcessedNudge[];
}
export const UNKNOWN_YEAR = "unknown";

/// The types from `data/option-values.json`.
export interface OptionValues {
  country: string[];
  placeType: PlaceType[];
  nudge: NudgeType[];
  year: string[];
}
