import { expect, test } from "@playwright/test";

import {
  determineHtml,
  determinePlaceDescription,
  determineSearch,
  determineDefault,
  determineRatio,
  determineSubstitution,
  determineTitles,
  determinePlacement,
  determineOther,
  SEARCH_RESET_HTML,
  TABLE_DOWNLOAD_HTML,
  determineAnyNudge,
} from "../../src/js/filter-features/counters";
import {
  FilterState,
  ALL_NUDGE_TYPE_FILTER,
} from "../../src/js/state/FilterState";
import {
  ALL_NUDGE_STATUS,
  ALL_NUDGE_TYPE,
  NudgeType,
  NudgeStatus,
} from "../../src/js/model/types";
import { ViewState } from "../../src/js/layout/viewToggle";

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
    const result = determineHtml(
      "map",
      DEFAULT_STATE,
      {},
      0,
      new Set(),
      new Set(),
    );
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
  const placeLink = `<a class="external-link" target="_blank" href=https://parkingreform.org/mandates-map/city_detail/${encodedPlace}.html>${placeId} <svg aria-hidden="true" width="1em" height="1em"><use href="#icon-arrow-right"></use></svg></a>`;

  // Map view always has the same text.
  for (const nudgeType of ALL_NUDGE_TYPE_FILTER) {
    for (const status of ALL_NUDGE_STATUS) {
      expect(
        determineSearch("map", placeId, encodedPlace, nudgeType, status),
      ).toEqual(`Showing ${placeLink} — ${SEARCH_RESET_HTML}`);
    }
  }

  expect(
    determineSearch("table", placeId, encodedPlace, "any nudge", "adopted"),
  ).toEqual(
    `Showing an overview of adopted nudges in ${placeLink} — ${SEARCH_RESET_HTML}`,
  );
  expect(
    determineSearch(
      "table",
      placeId,
      encodedPlace,
      "plant-based default",
      "pledged",
    ),
  ).toEqual(
    `Showing details about pledged plant-based defaults in ${placeLink} — ${SEARCH_RESET_HTML}`,
  );
  expect(
    determineSearch(
      "table",
      placeId,
      encodedPlace,
      "climate-friendly ratio",
      "adopted",
    ),
  ).toEqual(
    `Showing details about adopted climate-friendly ratios in ${placeLink} — ${SEARCH_RESET_HTML}`,
  );
});

test("determineDefault()", () => {
  expect(determineDefault("map", "2 places in Mexico", "adopted")).toEqual(
    "Showing 2 places in Mexico with adopted plant-based defaults",
  );
  expect(determineDefault("map", "2 places in Mexico", "pledged")).toEqual(
    "Showing 2 places in Mexico with pledged plant-based defaults",
  );

  expect(determineDefault("table", "2 places in Mexico", "adopted")).toEqual(
    `Showing details about adopted plant-based defaults for 2 places in Mexico - ${TABLE_DOWNLOAD_HTML}`,
  );
  expect(determineDefault("table", "2 places in Mexico", "pledged")).toEqual(
    `Showing details about pledged plant-based defaults for 2 places in Mexico - ${TABLE_DOWNLOAD_HTML}`,
  );
});

test("determineRatio()", () => {
  expect(determineRatio("map", "2 places in Mexico", "adopted")).toEqual(
    "Showing 2 places in Mexico with adopted climate-friendly ratios",
  );
  expect(determineRatio("map", "2 places in Mexico", "pledged")).toEqual(
    "Showing 2 places in Mexico with pledged climate-friendly ratios",
  );

  expect(determineRatio("table", "2 places in Mexico", "adopted")).toEqual(
    `Showing details about adopted climate-friendly ratios for 2 places in Mexico - ${TABLE_DOWNLOAD_HTML}`,
  );
  expect(determineRatio("table", "2 places in Mexico", "pledged")).toEqual(
    `Showing details about pledged climate-friendly ratios for 2 places in Mexico - ${TABLE_DOWNLOAD_HTML}`,
  );
});

test("determineSubstitution()", () => {
  expect(determineSubstitution("map", "2 places in Mexico", "adopted")).toEqual(
    "Showing 2 places in Mexico with adopted subtle substitutions",
  );
  expect(determineSubstitution("map", "2 places in Mexico", "pledged")).toEqual(
    "Showing 2 places in Mexico with pledged subtle substitutions",
  );

  expect(
    determineSubstitution("table", "2 places in Mexico", "adopted"),
  ).toEqual(
    `Showing details about adopted subtle substitutions for 2 places in Mexico - ${TABLE_DOWNLOAD_HTML}`,
  );
  expect(
    determineSubstitution("table", "2 places in Mexico", "pledged"),
  ).toEqual(
    `Showing details about pledged subtle substitutions for 2 places in Mexico - ${TABLE_DOWNLOAD_HTML}`,
  );
});

test("determineTitles()", () => {
  expect(determineTitles("map", "2 places in Mexico", "adopted")).toEqual(
    "Showing 2 places in Mexico with adopted tasty titles & descriptions",
  );
  expect(determineTitles("map", "2 places in Mexico", "pledged")).toEqual(
    "Showing 2 places in Mexico with pledged tasty titles & descriptions",
  );

  expect(determineTitles("table", "2 places in Mexico", "adopted")).toEqual(
    `Showing details about adopted tasty titles & descriptions for 2 places in Mexico - ${TABLE_DOWNLOAD_HTML}`,
  );
  expect(determineTitles("table", "2 places in Mexico", "pledged")).toEqual(
    `Showing details about pledged tasty titles & descriptions for 2 places in Mexico - ${TABLE_DOWNLOAD_HTML}`,
  );
});

test("determinePlacement()", () => {
  expect(determinePlacement("map", "2 places in Mexico", "adopted")).toEqual(
    "Showing 2 places in Mexico with adopted prime placements",
  );
  expect(determinePlacement("map", "2 places in Mexico", "pledged")).toEqual(
    "Showing 2 places in Mexico with pledged prime placements",
  );

  expect(determinePlacement("table", "2 places in Mexico", "adopted")).toEqual(
    `Showing details about adopted prime placements for 2 places in Mexico - ${TABLE_DOWNLOAD_HTML}`,
  );
  expect(determinePlacement("table", "2 places in Mexico", "pledged")).toEqual(
    `Showing details about pledged prime placements for 2 places in Mexico - ${TABLE_DOWNLOAD_HTML}`,
  );
});

test("determineOther()", () => {
  expect(determineOther("map", "2 places in Mexico", "adopted")).toEqual(
    "Showing 2 places in Mexico with adopted other nudges",
  );
  expect(determineOther("map", "2 places in Mexico", "pledged")).toEqual(
    "Showing 2 places in Mexico with pledged other nudges",
  );

  expect(determineOther("table", "2 places in Mexico", "adopted")).toEqual(
    `Showing details about adopted other nudges for 2 places in Mexico - ${TABLE_DOWNLOAD_HTML}`,
  );
  expect(determineOther("table", "2 places in Mexico", "pledged")).toEqual(
    `Showing details about pledged other nudges for 2 places in Mexico - ${TABLE_DOWNLOAD_HTML}`,
  );
});

test("determineAnyNudge()", () => {
  const assert = (
    args: {
      view: ViewState;
      matched: readonly NudgeType[];
      stateNudge: readonly NudgeType[];
      state: NudgeStatus;
    },
    expected: string,
  ): void => {
    const result = determineAnyNudge(
      args.view,
      "5 places in Mexico",
      new Set(args.matched),
      new Set(args.stateNudge),
      args.state,
    );
    expect(result).toEqual(expected);
  };

  assert(
    { view: "table", matched: [], stateNudge: [], state: "adopted" },
    `Showing an overview of adopted nudges in 5 places in Mexico - ${TABLE_DOWNLOAD_HTML}`,
  );
  assert(
    { view: "table", matched: [], stateNudge: [], state: "pledged" },
    `Showing an overview of pledged nudges in 5 places in Mexico - ${TABLE_DOWNLOAD_HTML}`,
  );

  // For map view, we only show nudge types that are both present in the matched places &
  // the user requested to see via `includedNudges`.
  assert(
    {
      view: "map",
      matched: ALL_NUDGE_TYPE,
      stateNudge: ALL_NUDGE_TYPE,
      state: "adopted",
    },
    "Showing 5 places in Mexico with 1+ adopted nudges:<ul><li>defaults</li><li>other nudges</li><li>placements</li><li>ratios</li><li>substitutions</li><li>titles</li></ul>",
  );
  assert(
    {
      view: "map",
      matched: ALL_NUDGE_TYPE,
      stateNudge: ALL_NUDGE_TYPE,
      state: "pledged",
    },
    "Showing 5 places in Mexico with 1+ pledged nudges:<ul><li>defaults</li><li>other nudges</li><li>placements</li><li>ratios</li><li>substitutions</li><li>titles</li></ul>",
  );

  assert(
    {
      view: "map",
      matched: ["plant-based default", "climate-friendly ratio"],
      stateNudge: ALL_NUDGE_TYPE,
      state: "adopted",
    },
    "Showing 5 places in Mexico with 1+ adopted nudges:<ul><li>defaults</li><li>ratios</li></ul>",
  );
  assert(
    {
      view: "map",
      matched: ALL_NUDGE_TYPE,
      stateNudge: ["plant-based default", "climate-friendly ratio"],
      state: "adopted",
    },
    "Showing 5 places in Mexico with 1+ adopted nudges:<ul><li>defaults</li><li>ratios</li></ul>",
  );

  assert(
    {
      view: "map",
      matched: ["plant-based default"],
      stateNudge: ALL_NUDGE_TYPE,
      state: "adopted",
    },
    "Showing 5 places in Mexico with adopted plant-based defaults",
  );
  assert(
    {
      view: "map",
      matched: ALL_NUDGE_TYPE,
      stateNudge: ["plant-based default"],
      state: "adopted",
    },
    "Showing 5 places in Mexico with adopted plant-based defaults",
  );
  assert(
    {
      view: "map",
      matched: ALL_NUDGE_TYPE,
      stateNudge: ["plant-based default"],
      state: "pledged",
    },
    "Showing 5 places in Mexico with pledged plant-based defaults",
  );
});
