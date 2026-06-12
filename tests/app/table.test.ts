import { expect, test } from "@playwright/test";

import { ColumnComponent, RowComponent, SortDirection } from "tabulator-tables";
import { compareDates, tableDownloadFileName } from "../../src/js/table";
import { Date } from "../../src/js/model/types";

test("tableDownloadFileName()", () => {
  expect(tableDownloadFileName("any nudge", "adopted")).toEqual(
    "nudges--overview--adopted.csv",
  );
  expect(tableDownloadFileName("any nudge", "pledged")).toEqual(
    "nudges--overview--pledged.csv",
  );
  expect(tableDownloadFileName("plant-based default", "adopted")).toEqual(
    "nudges--defaults--adopted.csv",
  );
  expect(tableDownloadFileName("climate-friendly ratio", "adopted")).toEqual(
    "nudges--ratios--adopted.csv",
  );
  expect(tableDownloadFileName("subtle substitution", "adopted")).toEqual(
    "nudges--substitutions--adopted.csv",
  );
  expect(
    tableDownloadFileName("tasty titles & descriptions", "adopted"),
  ).toEqual("nudges--titles-descriptions--adopted.csv");
  expect(tableDownloadFileName("prime placement", "adopted")).toEqual(
    "nudges--placement--adopted.csv",
  );
  expect(tableDownloadFileName("other", "adopted")).toEqual(
    "nudges--other--adopted.csv",
  );
});

test("compareDates handles descending and ascending", () => {
  const compare = (
    a: string | undefined,
    b: string | undefined,
    dir: SortDirection,
  ): number =>
    compareDates(
      Date.fromNullable(a),
      Date.fromNullable(b),
      {} as RowComponent,
      {} as RowComponent,
      {} as ColumnComponent,
      dir,
    );

  // Asc = oldest to newest
  expect(compare("2024", "2025", "asc")).toBeLessThan(0);
  expect(compare("2025", "2024", "asc")).toBeGreaterThan(0);
  expect(compare("2024", "2024", "asc")).toBe(0);
  expect(compare(undefined, "2024", "asc")).toBeGreaterThan(0);
  expect(compare("2024", undefined, "asc")).toBeLessThan(0);
  expect(compare(undefined, undefined, "asc")).toBe(0);

  // Desc = newest to oldest
  expect(compare("2024", "2025", "desc")).toBeLessThan(0);
  expect(compare("2025", "2024", "desc")).toBeGreaterThan(0);
  expect(compare("2024", "2024", "desc")).toBe(0);
  expect(compare(undefined, "2024", "desc")).toBeLessThan(0);
  expect(compare("2024", undefined, "desc")).toBeGreaterThan(0);
  expect(compare(undefined, undefined, "desc")).toBe(0);
});
