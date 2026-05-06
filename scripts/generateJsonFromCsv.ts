/* eslint-disable no-await-in-loop */
import * as fs from "fs";
import * as path from "path";
import { parse } from "csv-parse/sync";
import NodeGeocoder from "node-geocoder";
import { initGeocoder, getLongLat } from "./lib/geocoder";
import { fileURLToPath } from 'url';
import * as readline from "readline";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Rate limiting ────────────────────────────────────────────────────────────
 
const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
 
// Persistent state overrides entered by the user during a run
const stateOverrideCache = new Map<string, string>();
 
async function promptLine(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, (ans) => resolve(ans.trim())));
}
 
const countryOverrideCache = new Map<string, string>();
 
async function promptMissingLocation(
  placeName: string,
  parsed: { state: string | null; country: string },
): Promise<{ state: string | null; country: string }> {
  const cacheKey = placeName;
  if (stateOverrideCache.has(cacheKey) || countryOverrideCache.has(cacheKey)) {
    return {
      state: stateOverrideCache.get(cacheKey) || null,
      country: countryOverrideCache.get(cacheKey) ?? parsed.country,
    };
  }
 
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let { state, country } = parsed;
 
  if (country === "Unknown") {
    console.warn(`  ⚠ Could not determine country for "${placeName}".`);
    const ans = await promptLine(rl, `    Enter country manually (or press Enter to leave as Unknown): `);
    country = ans || "Unknown";
    countryOverrideCache.set(cacheKey, country);
  }
 
  if (state === null) {
    console.warn(`  ⚠ Could not determine state/region for "${placeName}" (${country}).`);
    const ans = await promptLine(rl, `    Enter state/region manually (or press Enter to leave blank): `);
    state = ans || null;
    stateOverrideCache.set(cacheKey, ans);
  }
 
  rl.close();
  return { state, country };
}
 
async function geocodeWithRetry(
  name: string,
  address: string,
  state: string | null,
  countryCode: string,
  geocoder: NodeGeocoder.Geocoder,
  retries = 3,
): Promise<[number, number] | null> {
  // Try address-based geocoding first, fall back to place name
  const strategies: Array<() => Promise<[number, number] | null>> = [
    () => getLongLat(address, state, countryCode, geocoder),
    () => getLongLat(name, state, countryCode, geocoder),
  ];
 
  for (const strategy of strategies) {
    for (let i = 0; i < retries; i++) {
      await sleep(1100 * (i + 1));
      try {
        const result = await strategy();
        if (result) return result;
        break; // no result but no error — move to next strategy
      } catch (e: any) {
        if (i === retries - 1) {
          console.warn(`  Retry exhausted: ${e}`);
          break; // move to next strategy
        }
        console.warn(`  Retry ${i + 1}/${retries - 1} for "${name}"…`);
      }
    }
  }
  return null;
}
 
// ─── Types ────────────────────────────────────────────────────────────────────
 
interface NudgeEntry {
  status: string;
  org_credit_filter?: string[];
  org_credit_expanded?: string[];
  date?: string;
  deadline?: string;
}
 
interface PlaceEntry {
  name: string;
  state: string | null;
  country: string;
  type: string;
  public: string;
  encoded: string;
  consumer_base: number | null;
  coord: [number, number] | null;
}
 
interface CoreRecord {
  place: PlaceEntry;
  [nudge: string]: NudgeEntry[] | PlaceEntry;
}
 
interface ExtendedNudgeEntry {
  summary: string;
  link?: string;
  notes?: string;
}
 
interface ExtendedRecord {
  [nudge: string]: ExtendedNudgeEntry[];
}
 
// ─── Nudge name map ───────────────────────────────────────────────────────────
 
const NUDGE_MAP: Record<string, string> = {
  "plant-based default": "default",
  "climate-friendly ratio": "ratio",
  "prime placement": "placement",
  "tasty titles & descriptions": "titles",
};
 
function normalizeNudge(raw: string): string {
  return NUDGE_MAP[raw.toLowerCase()] ?? raw;
}
 
// ─── Column indices (0-based) ─────────────────────────────────────────────────
// Name, Nudge, Specific Nudge, Status, Public vs. Private, Institution,
// Address, Consumer Base, Year, Deadline, Policy Summary, Org Credit (filter),
// Org (expanded), Link, Notes, [Private Notes = col 15, stop here]
const COL = {
  NAME: 0,
  NUDGE: 1,
  STATUS: 3,
  PUBLIC: 4,
  INSTITUTION: 5,
  ADDRESS: 6,
  CONSUMER_BASE: 7,
  YEAR: 8,
  DEADLINE: 9,
  SUMMARY: 10,
  ORG_FILTER: 11,
  ORG_EXPANDED: 12,
  LINK: 13,
  NOTES: 14,
};
 
// ─── Helpers ──────────────────────────────────────────────────────────────────
 
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_");
}
 
function parseConsumerBase(raw: string): number | null {
  if (!raw || raw.trim() === "") return null;
  const cleaned = raw.replace(/,/g, "").trim();
  const n = parseInt(cleaned, 10);
  return isNaN(n) ? null : n;
}
 
function parseOrgCredit(raw: string): string[] | undefined {
  if (!raw || raw.trim() === "") return undefined;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
 
function parseDeadline(raw: string): string | undefined {
  if (!raw || raw.trim() === "" || raw.trim().toLowerCase() === "n/a")
    return undefined;
  return raw.trim();
}
 
/**
 * Attempt to extract state/region and country from a freeform address string.
 *
 * Handles patterns like:
 *   "City, ST 12345"                     → state abbrev, US assumed
 *   "City, Province POSTAL Country"      → Canadian / UK / generic
 *   "City, Country"                      → no state
 */
function parseAddressForStateCountry(address: string): {
  state: string | null;
  country: string;
} {
  // Flatten multiline addresses
  const flat = address.replace(/\n/g, " ").trim();
 
  // Pattern: ends with known country name (expanded list)
  const knownCountries: Record<string, string> = {
    "United Kingdom": "United Kingdom",
    "U.K.": "United Kingdom",
    UK: "United Kingdom",
    England: "United Kingdom",
    Scotland: "United Kingdom",
    Wales: "United Kingdom",
    Canada: "Canada",
    Germany: "Germany",
    France: "France",
    Australia: "Australia",
    Netherlands: "Netherlands",
    Finland: "Finland",
    Sweden: "Sweden",
    Norway: "Norway",
    Denmark: "Denmark",
    Belgium: "Belgium",
    Switzerland: "Switzerland",
    Austria: "Austria",
    Ireland: "Ireland",
    Italy: "Italy",
    Spain: "Spain",
    Portugal: "Portugal",
    "New Zealand": "New Zealand",
    Japan: "Japan",
    Singapore: "Singapore",
  };
  for (const [key, val] of Object.entries(knownCountries)) {
    if (flat.endsWith(key) || flat.includes(`, ${key}`)) {
      // Try to find a state/province before the country
      const withoutCountry = flat.replace(new RegExp(`,?\\s*${key}$`), "").trim();
      const parts = withoutCountry.split(",").map((s) => s.trim());
      // Last part may contain "City Province POSTAL" — try splitting on space
      const lastPart = parts[parts.length - 1];
      // Canadian province codes are 2 letters before postal code
      const caMatch = lastPart.match(/\b([A-Z]{2})\s+[A-Z]\d[A-Z]\s*\d[A-Z]\d\b/);
      if (caMatch) return { state: expandProvince(caMatch[1]), country: val };
      // UK postcode — no meaningful "state"
      const ukMatch = lastPart.match(/\b[A-Z]{1,2}\d{1,2}\s*\d[A-Z]{2}\b/);
      if (ukMatch) return { state: null, country: val };
      // Australian state abbreviation (case-insensitive e.g. "Vic", "NSW")
      const auMatch = lastPart.match(/\b([A-Za-z]{2,3})\b/);
      if (auMatch && AU_STATES[auMatch[1].toUpperCase()]) {
        return { state: AU_STATES[auMatch[1].toUpperCase()], country: val };
      }
      // Other country — no state extractable
      return { state: null, country: val };
    }
  }
 
  // UK postcode without explicit country suffix (e.g. "London WC1E 6BT")
  const ukImplicit = flat.match(/\b[A-Z]{1,2}\d{1,2}\s*\d[A-Z]{2}\b/);
  if (ukImplicit) {
    return { state: null, country: "United Kingdom" };
  }
 
  // Canadian postal code without explicit "Canada" suffix: "City, BC V7N 4N5"
  const caImplicit = flat.match(/,\s+([A-Z]{2})\s+[A-Z]\d[A-Z]\s*\d[A-Z]\d/);
  if (caImplicit && CA_PROVINCES[caImplicit[1]]) {
    return { state: expandProvince(caImplicit[1]), country: "Canada" };
  }
 
  // USA — look for "City, ST ZIP" at the end
  const usMatch = flat.match(/,\s*([A-Za-z\s]+),?\s+([A-Z]{2})\s+\d{5}/);
  if (usMatch) {
    return { state: expandState(usMatch[2]), country: "United States" };
  }
  // Simpler US: ", ST ZIPCODE"
  const usSimple = flat.match(/,\s+([A-Z]{2})\s+[\d-]{5}/);
  if (usSimple) {
    return { state: expandState(usSimple[1]), country: "United States" };
  }
 
  // Nothing matched — return null for both so the user gets prompted
  return { state: null, country: "Unknown" };
}
 
const US_STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
  NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina",
  ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee",
  TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", DC: "District of Columbia",
};
 
const CA_PROVINCES: Record<string, string> = {
  AB: "Alberta", BC: "British Columbia", MB: "Manitoba", NB: "New Brunswick",
  NL: "Newfoundland and Labrador", NS: "Nova Scotia", NT: "Northwest Territories",
  NU: "Nunavut", ON: "Ontario", PE: "Prince Edward Island", QC: "Quebec",
  SK: "Saskatchewan", YT: "Yukon",
};
 
const AU_STATES: Record<string, string> = {
  ACT: "Australian Capital Territory", NSW: "New South Wales", NT: "Northern Territory",
  QLD: "Queensland", SA: "South Australia", TAS: "Tasmania",
  VIC: "Victoria", WA: "Western Australia",
};
 
function expandState(abbr: string): string {
  return US_STATES[abbr] ?? abbr;
}
 
function expandProvince(abbr: string): string {
  return CA_PROVINCES[abbr] ?? abbr;
}
 
// ─── Main ─────────────────────────────────────────────────────────────────────
 
async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error("Usage: tsx src/convert.ts <path-to-csv>");
    process.exit(1);
  }
 
  const outputDir = path.join(__dirname, '../data');
  fs.mkdirSync(outputDir, { recursive: true });
 
  const rawCsv = fs.readFileSync(csvPath, "utf-8");
 
  // Parse CSV — columns beyond index 14 (Private Notes) will still be parsed
  // but we simply ignore them.
  const rows: string[][] = parse(rawCsv, {
    relax_column_count: true,
    skip_empty_lines: false,
  });
 
  // Drop header row
  const [_header, ...dataRows] = rows;
 
  // Filter: skip blank rows and rows with no nudge
  const validRows = dataRows.filter((row) => {
    const name = row[COL.NAME]?.trim();
    const nudge = normalizeNudge(row[COL.NUDGE]?.trim() ?? "");
    return name && nudge;
  });
 
  if (validRows.length === 0) {
    console.error("No valid rows found.");
    process.exit(1);
  }
 
  console.log(`Processing ${validRows.length} valid rows…`);
 
  const geocoder = initGeocoder();
 
  // Persistent coordinate cache — survives between runs so addresses are never re-geocoded
  const cacheFile = path.join(outputDir, ".geocache.json");
  const coordCache = new Map<string, [number, number] | null>(
    fs.existsSync(cacheFile)
      ? Object.entries(JSON.parse(fs.readFileSync(cacheFile, "utf-8")))
      : [],
  );
  const saveCache = () =>
    fs.writeFileSync(
      cacheFile,
      JSON.stringify(Object.fromEntries(coordCache), null, 2),
    );
  console.log(`  Loaded ${coordCache.size} cached coordinates from ${cacheFile}`);
 
  const coreOutput: Record<string, CoreRecord> = {};
  const extendedOutput: Record<string, ExtendedRecord> = {};
 
  for (const row of validRows) {
    const name = row[COL.NAME].trim();
    const nudge = normalizeNudge(row[COL.NUDGE].trim());
    const status = row[COL.STATUS]?.trim() ?? "";
    const publicPrivate = row[COL.PUBLIC]?.trim().toLowerCase() ?? "";
    const institution = row[COL.INSTITUTION]?.trim() ?? "";
    const address = row[COL.ADDRESS]?.trim() ?? "";
    const consumerBase = parseConsumerBase(row[COL.CONSUMER_BASE] ?? "");
    const year = row[COL.YEAR]?.trim() || "unknown";
    const deadline = parseDeadline(row[COL.DEADLINE] ?? "");
    const summary = row[COL.SUMMARY]?.trim() ?? "";
    const orgFilter = parseOrgCredit(row[COL.ORG_FILTER] ?? "");
    const orgExpanded = parseOrgCredit(row[COL.ORG_EXPANDED] ?? "");
    const link = row[COL.LINK]?.trim() || undefined;
    const notes = row[COL.NOTES]?.trim() || undefined;
 
    // ── Skip pilot nudges and null consumer base ─────────────────────────────
    if (status.toLowerCase() === "pilot") continue;
    if (parseConsumerBase(row[COL.CONSUMER_BASE] ?? "") === null) continue;
 
    // ── Geocode (with cache) ──────────────────────────────────────────────────
    let coord: [number, number] | null = null;
    if (address) {
      if (coordCache.has(address) && coordCache.get(address) !== null) {
        coord = coordCache.get(address)!;
      } else {
        const rawParsed = parseAddressForStateCountry(address);
        const { state, country } = await promptMissingLocation(name, rawParsed);
        // Map country name to ISO code for geocoder
        const countryCodeMap: Record<string, string> = {
          "United States": "US",
          Canada: "CA",
          "United Kingdom": "GB",
          Germany: "DE",
          France: "FR",
          Australia: "AU",
          Netherlands: "NL",
          Finland: "FI",
          Sweden: "SE",
          Norway: "NO",
          Denmark: "DK",
          Belgium: "BE",
          Switzerland: "CH",
          Austria: "AT",
          Ireland: "IE",
          Italy: "IT",
          Spain: "ES",
          Portugal: "PT",
          "New Zealand": "NZ",
          Japan: "JP",
          Singapore: "SG",
        };
        const countryCode = countryCodeMap[country] ?? country.slice(0, 2).toUpperCase();
        try {
          console.log(`  Geocoding: ${name} (${address.split("\n")[0]})`);
          coord = await geocodeWithRetry(name, address, state, countryCode, geocoder);
        } catch (e) {
          console.warn(`  Warning: geocoding failed for "${name}": ${e}`);
        }
        coordCache.set(address, coord);
        saveCache(); // persist after each new result so progress isn't lost on interruption
      }
    }
 
    // ── Build place info (only on first encounter) ────────────────────────────
    if (!coreOutput[name]) {
      const rawParsed2 = parseAddressForStateCountry(address);
      const { state, country } = {
        state: rawParsed2.state ?? (stateOverrideCache.get(name) || null),
        country: countryOverrideCache.get(name) ?? rawParsed2.country,
      };
      coreOutput[name] = {
        place: {
          name,
          state,
          country,
          type: institution,
          public: publicPrivate,
          encoded: toSlug(name),
          consumer_base: consumerBase,
          coord,
        },
      };
      extendedOutput[name] = {};
    }
 
    // ── Core nudge entry ──────────────────────────────────────────────────────
    const coreNudgeEntry: NudgeEntry = {
      status,
      ...(orgFilter ? { org_credit_filter: orgFilter } : {}),
      ...(orgExpanded ? { org_credit_expanded: orgExpanded } : {}),
      ...(year !== "unknown" ? { date: year } : {}),
      ...(deadline ? { deadline } : {}),
    };
 
    if (!coreOutput[name][nudge]) {
      coreOutput[name][nudge] = [];
    }
    (coreOutput[name][nudge] as NudgeEntry[]).push(coreNudgeEntry);
 
    // ── Extended nudge entry ──────────────────────────────────────────────────
    const extendedNudgeEntry: ExtendedNudgeEntry = {
      summary,
      ...(link ? { link } : {}),
      ...(notes ? { notes } : {}),
    };
 
    if (!extendedOutput[name][nudge]) {
      extendedOutput[name][nudge] = [];
    }
    extendedOutput[name][nudge].push(extendedNudgeEntry);
  }
 
  // ── Prune null entries from cache so failed coords are retried next run ──────
  for (const [key, val] of coordCache.entries()) {
    if (val === null) coordCache.delete(key);
  }
  saveCache();
 
  // ── Remove places where all nudges were filtered out (e.g. all Pilot) ──────
  for (const name of Object.keys(coreOutput)) {
    const keys = Object.keys(coreOutput[name]).filter((k) => k !== "place");
    if (keys.length === 0) {
      delete coreOutput[name];
      delete extendedOutput[name];
    }
  }
 
  // ── Drop places with null coords and report them ────────────────────────────
  const nullCoordPlaces: string[] = [];
  for (const name of Object.keys(coreOutput)) {
    if ((coreOutput[name].place as PlaceEntry).coord === null) {
      nullCoordPlaces.push(name);
      delete coreOutput[name];
      delete extendedOutput[name];
    }
  }
 
  // ── Write output files ────────────────────────────────────────────────────
  const corePath = path.join(outputDir, "core.json");
  const extendedPath = path.join(outputDir, "extended.json");
 
  fs.writeFileSync(corePath, JSON.stringify(coreOutput, null, 2), "utf-8");
  fs.writeFileSync(extendedPath, JSON.stringify(extendedOutput, null, 2), "utf-8");
 
  console.log(`\n✓ core.json     → ${corePath}`);
  console.log(`✓ extended.json → ${extendedPath}`);
  console.log(`  Entities: ${Object.keys(coreOutput).length}`);
 
  if (nullCoordPlaces.length > 0) {
    console.warn(`\n⚠ ${nullCoordPlaces.length} place(s) excluded due to failed geocoding:`);
    nullCoordPlaces.forEach((p) => console.warn(`  - ${p}`));
  } else {
    console.log("  All places geocoded successfully.");
  }
}
 
main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});