/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */

import fs from "fs/promises";

import { $, glob } from "zx";
import { sum } from "lodash-es";
import Papa from "papaparse";

import {
  ProcessedCompleteEntry,
  ProcessedCompleteNudge,
  readProcessedCompleteData,
} from "./lib/data";
import { NudgeStatus } from "../src/js/model/types";

const DELIMITER = "; ";

function toBoolean(condition: boolean | undefined): string {
  return condition ? "TRUE" : "FALSE";
}

interface AnyNudgeSet {
  hasNudges: boolean;
  csvValues: {
    default: string;
    ratio: string;
    sub: string;
    titles: string;
    placement: string;
    other: string;
  };
}

function determineAnyNudgeSet(
  entry: ProcessedCompleteEntry,
  status: NudgeStatus,
): AnyNudgeSet {
  const hasDefault =
    entry.default?.some((nudge) => nudge.status === status) ?? false;
  const hasRatio =
    entry.ratio?.some((nudge) => nudge.status === status) ?? false;
  const hasSubstitution =
    entry.sub?.some((nudge) => nudge.status === status) ?? false;
  const hasTitles =
    entry.titles?.some((nudge) => nudge.status === status) ?? false;
  const hasPlacement =
    entry.placement?.some((nudge) => nudge.status === status) ?? false;
  const hasOther =
    entry.other?.some((nudge) => nudge.status === status) ?? false; 
  return {
      hasNudges: hasDefault || hasRatio || hasSubstitution || hasTitles || hasPlacement || hasOther,
    csvValues: {
      default: toBoolean(hasDefault),
      ratio: toBoolean(hasRatio),
      sub: toBoolean(hasSubstitution),
      titles: toBoolean(hasTitles),
      placement: toBoolean(hasPlacement),
      other: toBoolean(hasOther),
    },
  };
}

export function createAnyNudgeCsvs(data: ProcessedCompleteEntry[]): {
  adopted: string;
  pledged: string;
} {
  const adopted: any[] = [];
  const pledged: any[] = [];
  data.forEach((entry) => {
    const initialValues = {
      place: entry.place.name,
      street: entry.place.street,
      city: entry.place.city,
      postal_code: entry.place.postal_code,
      state: entry.place.state,
      country: entry.place.country,
      place_type: entry.place.type,
      consumer_base: entry.place.consumer_base,
      lat: entry.place.coord[1],
      long: entry.place.coord[0],
    };
    const bffUrl = { bff_url: entry.place.url };

    const adoptedNudgeSet = determineAnyNudgeSet(entry, "adopted");
    const pledgedNudgeSet = determineAnyNudgeSet(entry, "pledged");

    if (adoptedNudgeSet.hasNudges) {
      adopted.push({
        ...initialValues,
        ...adoptedNudgeSet.csvValues,
        ...bffUrl,
      });
    }
    if (pledgedNudgeSet.hasNudges) {
      pledged.push({
        ...initialValues,
        ...pledgedNudgeSet.csvValues,
        ...bffUrl,
      });
    }
  });

  return {
    adopted: Papa.unparse(adopted),
    pledged: Papa.unparse(pledged),
  };
}

function validateNumEntries(
  csv: string,
  data: ProcessedCompleteEntry[],
  getter: (entry: ProcessedCompleteEntry) => Array<any> | undefined,
): void {
  const numJson = sum(data.flatMap((entry) => getter(entry)?.length ?? 0));
  const numCsv = csv.split("\r\n").length - 1;
  if (numJson !== numCsv) {
    throw new Error(`CSV has unequal entries to JSON: ${numCsv} vs ${numJson}`);
  }
}

export function createNudgeCsv(
  data: ProcessedCompleteEntry[],
  getter: (
    entry: ProcessedCompleteEntry,
  ) => ProcessedCompleteNudge[] | undefined,
): string {
  const entries = data.flatMap((entry) => {
    const nudges = getter(entry);
    if (!nudges) return [];
    return nudges.map((nudge) => ({
      place: entry.place.name,
      street: entry.place.street,
      city: entry.place.city,
      postal_code: entry.place.postal_code,
      state: entry.place.state,
      country: entry.place.country,
      consumer_base: entry.place.consumer_base,
      place_type: entry.place.type,
      lat: entry.place.coord[1],
      long: entry.place.coord[0],
      status: nudge.status,
      nudge_date: nudge.date?.raw,
      org_credit: nudge.org_credit?.join(DELIMITER),
      is_verified: nudge.is_verified,
      summary: nudge.summary,
      num_citations: nudge.citations.length,
      reporter: nudge.reporter,
      bff_url: entry.place.url,
    }));
  });
  const csv = Papa.unparse(entries);
  validateNumEntries(csv, data, getter);
  return csv;
}

async function writeCsv(csv: string, filePath: string): Promise<void> {
  await fs.writeFile(filePath, csv);
  console.log(`Generated CSV at ${filePath}`);
}

async function writeJson(
  data: Record<string, ProcessedCompleteEntry>,
  filePath: string,
): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  console.log(`Generated ${filePath}`);
}

async function main(): Promise<void> {
  const completeData = await readProcessedCompleteData();
  const data = Object.values(completeData);

  await writeJson(completeData, "data/generated/complete-data.json");

  const { adopted, pledged } = createAnyNudgeCsvs(data);
  await writeCsv(adopted, "data/generated/overview_adopted.csv");
  await writeCsv(pledged, "data/generated/overview_pledged.csv");

  const defaultNudges = createNudgeCsv(data, (entry) => entry.default);
  await writeCsv(defaultNudges, "data/generated/plant_based_defaults.csv");

  const ratio = createNudgeCsv(data, (entry) => entry.ratio);
  await writeCsv(ratio, "data/generated/climate_friendly_ratios.csv");

  const sub = createNudgeCsv(data, (entry) => entry.sub);
  await writeCsv(sub, "data/generated/subtle_substitutions.csv");

  const titles = createNudgeCsv(data, (entry) => entry.titles);
  await writeCsv(titles, "data/generated/tasty_titles.csv");
  
  const placement = createNudgeCsv(data, (entry) => entry.placement);
  await writeCsv(placement, "data/generated/prime_placement.csv");

  const other = createNudgeCsv(data, (entry) => entry.other);
  await writeCsv(other, "data/generated/other.csv");

  const files = await glob("data/generated/*");
  await $`zip -j data/generated/nudge-map-data.zip ${files}`;
  console.log("Generated zip at data/generated/nudge-map-data.zip");
}

if (process.env.NODE_ENV !== "test") {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
