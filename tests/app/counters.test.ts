import { expect, test } from "@playwright/test";

import {
  determineHtml,
  determinePlaceDescription,
  determineSearch,
  SEARCH_RESET_HTML,
} from "../../src/js/filter-features/counters";
import { FilterState } from "../../src/js/state/FilterState";
import { ALL_NUDGE_TYPE } from "../../src/js/model/types";

test.describe("determineHtml", () => {
  const DEFAULT_STATE: FilterState = {
    searchInput: null,
    nudgeTypeFilter: "any nudge",
    includedNudges: new Set(ALL_NUDGE_TYPE),
    // The below values are ignored.
    country: new Set(),
    status: "adopted",
    placeType: new Set(),
    year: new Set(),
    consumerBaseSliderIndexes: [0, 0],
    orgCredit: new Set(),
  };

  test("no places", () => {
    const result = determineHtml("map", DEFAULT_STATE, {}, 0, new Set());
    expect(result).toEqual(
      "No places selected — use the filter or search icons",
    );
  });
});

test("determinePlaceDescription()", () => {
  const countries = new Set(["Mexico", "Egypt"]);

  expect(determinePlaceDescription(1, countries)).toEqual(
    "1 place in 2 countries",
  );
  expect(determinePlaceDescription(2, countries)).toEqual(
    "2 places in 2 countries",
  );

  expect(determinePlaceDescription(2, new Set(["Mexico"]))).toEqual(
    "2 places in Mexico",
  );
  expect(determinePlaceDescription(2, new Set(["United States"]))).toEqual(
    "2 places in the United States",
  );
});

test("determineSearch()", () => {
  const placeId = "Baltimore, Maryland, United States";
  const encodedPlace = "baltimore-maryland-united-states";
  const placeLink = `<a class="external-link" target="_blank" href=https://parkingreform.org/mandates-map/city_detail/${encodedPlace}.html>${placeId} <i aria-hidden="true" class="fa-solid fa-arrow-right"></i></a>`;

  // Map view always has the same text.
  expect(determineSearch("map", placeId, encodedPlace)).toEqual(
    `Showing ${placeLink} — ${SEARCH_RESET_HTML}`,
  );
});
