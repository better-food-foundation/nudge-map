import { expect, test } from "@playwright/test";

import { generateSEO } from "../../scripts/lib/staticPages";
import type { NudgeStatus, ProcessedCoreEntry } from "../../src/js/model/types";

test.describe("generateSEO", () => {
  const PLACE_ID = "Tucson, Arizona, United States";
  const EXPECTED_TITLE = `Nudges in ${PLACE_ID} | Better Food Foundation`;
  const BASE_ENTRY: ProcessedCoreEntry = {
    place: {
      name: "Tucson",
      state: "",
      country: "",
      type: "Hotel",
      coord: [0, 0],
      consumer_base: 0,
      encoded: "",
      url: "",
    },
  };

  function addNudges(
    entry: ProcessedCoreEntry,
    status: NudgeStatus,
  ): ProcessedCoreEntry {
    return {
      place: entry.place,
      default: [
        ...(entry.default ?? []),
        { status, org_credit: [], date: undefined },
      ],
      ratio: [
        ...(entry.ratio ?? []),
        { status, org_credit: [], date: undefined },
      ],
      sub: [
        ...(entry.sub ?? []),
        { status, org_credit: [], date: undefined },
      ],
      titles: [
        ...(entry.titles ?? []),
        { status, org_credit: [], date: undefined },
      ],
      placement: [
        ...(entry.placement ?? []),
        { status, org_credit: [], date: undefined },
      ],
      other: [
        ...(entry.other ?? []),
        { status, org_credit: [], date: undefined },
      ]
    };
  }

  test("adopted nudges take precedence", () => {
    const entry = addNudges(addNudges(BASE_ENTRY, "adopted"), "pledged");
    const { title, description } = generateSEO(PLACE_ID, entry);
    expect(title).toEqual(EXPECTED_TITLE);
    expect(description).toEqual(
      "Tucson implemented plant-based defaults, implemented climate-friendly ratios, implemented subtle substitutions, implemented tasty titles and descriptions, implemented prime placement, and implemented other nudges. View implementation details.",
    );
  });

  test("pledged reforms", () => {
    const entry = addNudges(BASE_ENTRY, "pledged");
    const { title, description } = generateSEO(PLACE_ID, entry);
    expect(title).toEqual(EXPECTED_TITLE);
    expect(description).toEqual(
      "Tucson pledged to implement plant-based defaults, implement climate-friendly ratios, implement subtle substitutions, implement tasty titles and descriptions, implement prime placement, and implement other nudges. View implementation details."
    );
  });
});
