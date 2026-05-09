import fs from "fs/promises";

import { sortBy, without } from "lodash-es";

import {
  UNKNOWN_YEAR,
  Date,
  RawPlace,
  RawCoreEntry,
  RawNudge,
  UNKNOWN_ORG,
} from "../../src/js/model/types";

/** The option values for a single dataset. */
class OptionValues {
  readonly placeType: Set<string>;

  readonly country: Set<string>;

  readonly year: Set<string>;

  readonly orgCredit: Set<string>;

  constructor() {
    this.placeType = new Set();
    this.country = new Set();
    this.year = new Set();
    this.orgCredit = new Set();
  }

  #addPlace(place: RawPlace): void {
    this.placeType.add(place.type);
    this.country.add(place.country);
  }

  #addDate(date: string | undefined): void {
    this.year.add(date ? new Date(date).parsed.year.toString() : UNKNOWN_YEAR);
  }

  #addOrgCredit(orgCredit: string[] | undefined): void {
    if ( orgCredit && orgCredit.length > 0) {
      orgCredit.forEach((org) => this.orgCredit.add(org));
    } else {
      this.orgCredit.add(UNKNOWN_ORG);
    }
  }

  addNudge(place: RawPlace, nudge: RawNudge): void {
    this.#addPlace(place);
    this.#addDate(nudge.date);
    this.#addOrgCredit(nudge.org_credit);
  }

  export() {
    return {
      placeType: Array.from(this.placeType).sort(),
      country: sortCountries(this.country),
      year: Array.from(this.year).sort().reverse(),
      orgCredit: Array.from(this.orgCredit).sort(),
    };
  }
}

export function determineOptionValues(entries: RawCoreEntry[]) {
  const merged = new OptionValues();
  const anyAdopted = new OptionValues();
  const anyPledged = new OptionValues();
  const defaultAdopted = new OptionValues();
  const defaultPledged = new OptionValues();
  const ratioAdopted = new OptionValues();
  const ratioPledged = new OptionValues();
  const subAdopted = new OptionValues();
  const subPledged = new OptionValues();
  const titlesAdopted = new OptionValues();
  const titlesPledged = new OptionValues();
  const placementAdopted = new OptionValues();
  const placementPledged = new OptionValues();
  const otherAdopted = new OptionValues();
  const otherPledged = new OptionValues();

  entries.forEach((entry) => {
    entry.default?.forEach((nudgeRecord) => {
      merged.addNudge(entry.place, nudgeRecord);
      const [any, nudge] = {
        adopted: [anyAdopted, defaultAdopted],
        pledged: [anyPledged, defaultPledged],
      }[nudgeRecord.status];
      any.addNudge(entry.place, nudgeRecord);
      nudge.addNudge(entry.place, nudgeRecord);
    });
    entry.ratio?.forEach((nudgeRecord) => {
      merged.addNudge(entry.place, nudgeRecord);
      const [any, nudge] = {
        adopted: [anyAdopted, ratioAdopted],
        pledged: [anyPledged, ratioPledged],
      }[nudgeRecord.status];
      any.addNudge(entry.place, nudgeRecord);
      nudge.addNudge(entry.place, nudgeRecord);
    });
    entry.sub?.forEach((nudgeRecord) => {
      merged.addNudge(entry.place, nudgeRecord);
      const [any, nudge] = {
        adopted: [anyAdopted, subAdopted],
        pledged: [anyPledged, subPledged],
      }[nudgeRecord.status];
      any.addNudge(entry.place, nudgeRecord);
      nudge.addNudge(entry.place, nudgeRecord);
    });
    entry.titles?.forEach((nudgeRecord) => {
      merged.addNudge(entry.place, nudgeRecord);
      const [any, nudge] = {
        adopted: [anyAdopted, titlesAdopted],
        pledged: [anyPledged, titlesPledged],
      }[nudgeRecord.status];
      any.addNudge(entry.place, nudgeRecord);
      nudge.addNudge(entry.place, nudgeRecord);
    });
    entry.placement?.forEach((nudgeRecord) => {
      merged.addNudge(entry.place, nudgeRecord);
      const [any, nudge] = {
        adopted: [anyAdopted, placementAdopted],
        pledged: [anyPledged, placementPledged],
      }[nudgeRecord.status];
      any.addNudge(entry.place, nudgeRecord);
      nudge.addNudge(entry.place, nudgeRecord);
    });
    entry.other?.forEach((nudgeRecord) => {
      merged.addNudge(entry.place, nudgeRecord);
      const [any, nudge] = {
        adopted: [anyAdopted, otherAdopted],
        pledged: [anyPledged, otherPledged],
      }[nudgeRecord.status];
      any.addNudge(entry.place, nudgeRecord);
      nudge.addNudge(entry.place, nudgeRecord);
    });
  });

  const result = {
    merged: merged.export(),
    anyAdopted: anyAdopted.export(),
    anyPledged: anyPledged.export(),
    defaultAdopted: defaultAdopted.export(),
    defaultPledged: defaultPledged.export(),
    ratioAdopted: ratioAdopted.export(),
    ratioPledged: ratioPledged.export(),
    subAdopted: subAdopted.export(),
    subPledged: subPledged.export(),
    titlesAdopted: titlesAdopted.export(),
    titlesPledged: titlesPledged.export(),
    placementAdopted: placementAdopted.export(),
    placementPledged: placementPledged.export(),
    otherAdopted: otherAdopted.export(),
    otherPledged: otherPledged.export(),
  };
  return result;
}

/**
 * Sort alphabetically, but ensure the US is at the top.
 *
 * @param countries the fully normalized country names.
 */
export function sortCountries(countries: Set<string>): string[] {
  const sortedWithoutUS = sortBy(
    without(Array.from(countries), "United States"),
  );
  return countries.has("United States")
    ? ["United States", ...sortedWithoutUS]
    : sortedWithoutUS;
}

export async function saveOptionValues(entries: RawCoreEntry[]): Promise<void> {
  const result = determineOptionValues(entries);
  const json = JSON.stringify(result, null, 2);
  // eslint-disable-next-line no-console
  console.log("Writing data/option-values.json");
  await fs.writeFile("data/option-values.json", json);
}
