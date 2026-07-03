import fs from "fs/promises";

import { zipWith } from "lodash-es";

import {
  Date,
  RawCoreEntry,
  PlaceId,
  RawPlace,
  RawNudge,
  ProcessedPlace,
  ProcessedNudge,
} from "../../src/js/model/types";
import { processRawCoreEntry } from "../../src/js/model/data";

export interface DirectusFile {
  fileName: string;
  directusId: string;
}

export interface Citation {
  id: number;
  description: string;
  url: string | null;
  notes: string | null;
  attachments: DirectusFile[];
  screenshots: DirectusFile[];
}

export interface ExtendedNudge {
  summary: string;
  reporter: string | null;
  citations: Citation[];
}

export type ExtendedEntry = {
  default?: ExtendedNudge[];
  ratio?: ExtendedNudge[];
  sub?: ExtendedNudge[];
  titles?: ExtendedNudge[];
  placement?: ExtendedNudge[];
  other?: ExtendedNudge[];
};

export type RawCompleteNudge = RawNudge &
  ExtendedNudge;
export interface RawCompleteEntry {
  place: RawPlace;
  default?: Array<RawCompleteNudge>;
  ratio?: Array<RawCompleteNudge>;
  sub?: Array<RawCompleteNudge>;
  titles?: Array<RawCompleteNudge>;
  placement?: Array<RawCompleteNudge>;
  other?: Array<RawCompleteNudge>;
}

export type ProcessedCompleteNudge = ProcessedNudge &
  ExtendedNudge;
export interface ProcessedCompleteEntry {
  place: ProcessedPlace;
  default?: Array<ProcessedCompleteNudge>;
  ratio?: Array<ProcessedCompleteNudge>;
  sub?: Array<ProcessedCompleteNudge>;
  titles?: Array<ProcessedCompleteNudge>;
  placement?: Array<ProcessedCompleteNudge>;
  other?: Array<ProcessedCompleteNudge>;
}

export async function readRawCoreData(): Promise<
  Record<PlaceId, RawCoreEntry>
> {
  const raw = await fs.readFile("data/core.json", "utf8");
  return JSON.parse(raw);
}

export async function readRawExtendedData(): Promise<
  Record<PlaceId, ExtendedEntry>
> {
  const raw = await fs.readFile("data/extended.json", "utf8");
  return JSON.parse(raw);
}

function mergeRawNudges(
  coreNudges: RawNudge[],
  extendedNudges: ExtendedNudge[],
  placeId: PlaceId,
  nudgeKeyName: string,
): RawCompleteNudge[] {
  return zipWith(
    coreNudges,
    extendedNudges,
    (coreNudge, extendedNudge) => {
      if (!coreNudge || !extendedNudge) {
        throw new Error(
          `Unequal number of '${nudgeKeyName}' entries for '${placeId}' between data/core.json and data/extended.json`,
        );
      }
      return {
        ...coreNudge,
        ...extendedNudge,
      };
    },
  );
}

export async function readRawCompleteData(): Promise<
  Record<PlaceId, RawCompleteEntry>
> {
  const [coreData, extendedData] = await Promise.all([
    readRawCoreData(),
    readRawExtendedData(),
  ]);
  return Object.fromEntries(
    Object.entries(coreData).map(([placeId, coreEntry]) => {
      const extendedEntry = extendedData[placeId];
      return [
        placeId,
        {
          place: coreEntry.place,
          ...(coreEntry.default &&
            extendedEntry.default && {
              default: mergeRawNudges(
                coreEntry.default,
                extendedEntry.default,
                placeId,
                "default",
              ),
            }),
          ...(coreEntry.ratio &&
            extendedEntry.ratio && {
              ratio: mergeRawNudges(
                coreEntry.ratio,
                extendedEntry.ratio,
                placeId,
                "ratio",
              ),
            }),
          ...(coreEntry.sub &&
            extendedEntry.sub && {
              sub: mergeRawNudges(
                coreEntry.sub,
                extendedEntry.sub,
                placeId,
                "sub",
              ),
            }),
          ...(coreEntry.titles &&
            extendedEntry.titles && {
              titles: mergeRawNudges(
                coreEntry.titles,
                extendedEntry.titles,
                placeId,
                "titles",
              ),
            }),
          ...(coreEntry.placement &&
            extendedEntry.placement && {
              placement: mergeRawNudges(
                coreEntry.placement,
                extendedEntry.placement,
                placeId,
                "placement",
              ),
            }),
          ...(coreEntry.other &&
            extendedEntry.other && {
              other: mergeRawNudges(
                coreEntry.other,
                extendedEntry.other,
                placeId,
                "other",
              ),
            }),
        },
      ];
    }),
  );
}

function processCompleteNudge(
  nudge: RawCompleteNudge,
): ProcessedCompleteNudge {
  return {
    ...nudge,
    date: Date.fromNullable(nudge.date),
  };
}

export async function readProcessedCompleteData(): Promise<
  Record<PlaceId, ProcessedCompleteEntry>
> {
  const raw = await readRawCompleteData();
  return Object.fromEntries(
    Object.entries(raw).map(([placeId, entry]) => {
      const processed = processRawCoreEntry(entry);
      const result: ProcessedCompleteEntry = {
        place: processed.place,
      };
      if (entry.default) {
        result.default = entry.default.map(processCompleteNudge);
      }
      if (entry.ratio) {
        result.ratio = entry.ratio.map(processCompleteNudge);
      }
      if (entry.sub) {
        result.sub = entry.sub.map(processCompleteNudge);
      }
      if (entry.titles) {
        result.titles = entry.titles.map(processCompleteNudge);
      }
      if (entry.placement) {
        result.placement = entry.placement.map(processCompleteNudge);
      }
      if (entry.other) {
        result.other = entry.other.map(processCompleteNudge);
      }
      return [placeId, result];
    }),
  );
}

export function getCitations(entry: ExtendedEntry): Citation[] {
  const fromArray = (
    nudges: Array<{ citations: Citation[] }> | undefined,
  ): Citation[] => nudges?.flatMap((nudge) => nudge.citations) ?? [];

  return [
    ...fromArray(entry.default),
    ...fromArray(entry.ratio),
    ...fromArray(entry.sub),
    ...fromArray(entry.titles),
    ...fromArray(entry.placement),
    ...fromArray(entry.other),
  ];
}
