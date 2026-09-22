import { expect, test } from "@playwright/test";

import {
  createAnyNudgeCsvs,
  createNudgeCsv,
} from "../../scripts/generateDataSet";
import type { Citation, ProcessedCompleteEntry } from "../../scripts/lib/data";
import { Date } from "../../src/js/model/types";

// This test uses snapshot testing (https://jestjs.io/docs/snapshot-testing#updating-snapshots). If the tests fail and the changes
// are valid, run `npm test -- --update-snapshots`.

function normalize(csv: string): string {
  return csv.replace(/\r\n/g, "\n");
}

// eslint-disable-next-line no-empty-pattern
test("generate CSVs", async ({}, testInfo) => {
  // Normally, Playwright saves the operating system name in the snapshot results.
  // Our test is OS-independent, so turn this off.
  // eslint-disable-next-line no-param-reassign
  testInfo.snapshotSuffix = "";

  const citation: Citation = {
    id: 0,
    description: "citation",
    type: "News article",
    url: null,
    notes: null,
    attachments: [],
    screenshots: [],
  };

  const entries: ProcessedCompleteEntry[] = [
    {
      place: {
        name: "My Cafe",
        street: "123 Main St",
        city: "My City",
        postal_code: "12345",
        state: "NY",
        country: "United States",
        type: "Cafe",
        encoded: "",
        consumer_base: 24104,
        coord: [44.23, 14.23],
        url: "https:///better-food-foundation.github.io/nudge-map/place-detail/my-cafe-details.html",
      },
      default: [
        {
          summary: "Default summary #1",
          status: "adopted",
          date: new Date("2022-02-13"),
          is_verified: true,
          org_credit: ["Better Food Foundation"],
          reporter: "Stephen Black",
          citations: [citation, citation],
        },
        {
          summary: "Default summary #2",
          status: "pledged",
          date: undefined,
          is_verified: false,
          org_credit: undefined,
          reporter: "Stephen Black",
          citations: [citation],
        },
      ],
    },
    {
      place: {
        name: "Another Place",
        street: "456 Main St",
        city: "Another City",
        postal_code: "67890",
        state: "CA",
        country: "United States",
        type: "City/Government",
        encoded: "",
        consumer_base: 414,
        coord: [80.3, 24.23],
        url: "https:///better-food-foundation.github.io/nudge-map/place-detail/another-place.html",
      },
      ratio: [
        {
          summary: "Climate-friendly ratio",
          status: "pledged",
          date: undefined,
          is_verified: true,
          org_credit: undefined,
          reporter: "Stephen Black",
          citations: [],
        },
      ],
    },
  ];
  const { adopted, pledged } = createAnyNudgeCsvs(entries);
  expect(normalize(adopted)).toMatchSnapshot("overview-adopted.csv");
  expect(normalize(pledged)).toMatchSnapshot("overview-pledged.csv");

  const defaultNudges = createNudgeCsv(entries, (entry) => entry.default);
  expect(normalize(defaultNudges)).toMatchSnapshot("plant_based_defaults.csv");
});
