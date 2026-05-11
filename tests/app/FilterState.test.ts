import { expect, test } from "@playwright/test";

import {
  FilterState,
  PlaceFilterManager,
} from "../../src/js/state/FilterState";
import {
  PlaceId,
  ProcessedCoreEntry,
  Date,
  ALL_NUDGE_TYPE,
} from "../../src/js/model/types";
import { POPULATION_MAX_INDEX } from "../../src/js/filter-features/consumerBaseSlider";

test.describe("PlaceFilterManager.matchedNudgeRecords()", () => {
  function defaultState(): FilterState {
    return {
      searchInput: null,
      nudgeTypeFilter: "any nudge",
      status: "adopted",
      placeType: new Set(["Transit Station", "Cafe"]),
      includedNudges: new Set(ALL_NUDGE_TYPE),
      year: new Set(["1997", "2023", "2024"]),
      country: new Set(["United States", "Brazil"]),
      consumerBaseSliderIndexes: [0, POPULATION_MAX_INDEX],
      orgCredit: new Set(["org1", "org2"]),
    };
  }

  function defaultEntries(): Record<PlaceId, ProcessedCoreEntry> {
    return {
      "Place 1": {
        place: {
          name: "Place 1",
          state: "",
          country: "United States",
          encoded: "",
          coord: [0, 0],
          url: "",
          type: "Cafe",
          consumer_base: 48100,
        },
        default: [
          {
            status: "adopted",
            date: new Date("2024"),
            org_credit: ["org1"],
          },
        ],
      },
      "Place 2": {
        place: {
          name: "Place 2",
          state: "",
          country: "Brazil",
          encoded: "",
          coord: [0, 0],
          url: "",
          type: "Transit Station",
          consumer_base: 400,
        },
        ratio: [
          {
            status: "pledged",
            date: new Date("2023"),
            org_credit: ["org2"],
          },
        ],
        sub: [
          {
            status: "adopted",
            date: new Date("2023"),
            org_credit: ["org2"],
          },
        ],
        titles: [
          {
            status: "adopted",
            date: new Date("2023"),
            org_credit: ["org2"],
          },
        ],
        placement: [
          {
            status: "adopted",
            date: new Date("2023"),
            org_credit: ["org2"],
          },
        ],
        other: [
          {
            status: "adopted",
            date: new Date("2023"),
            org_credit: ["org2"],
          },
        ],
      },
    };
  }

  test("any nudge", () => {
    const expectedPlace1Match = {
      type: "any",
      hasDefault: true,
      hasRatio: false,
      hasSub: false,
      hasTitles: false,
      hasPlacement: false,
      hasOther: false,
    };
    const expectedPlace2Match = {
      type: "any",
      hasDefault: false,
      hasRatio: false,
      hasSub: true,
      hasTitles: true,
      hasPlacement: true,
      hasOther: true,
    };

    const manager = new PlaceFilterManager(defaultEntries(), defaultState());
    expect(manager.matchedPlaces).toEqual({
      "Place 1": expectedPlace1Match,
      "Place 2": expectedPlace2Match,
    });

    // The below filters should have no impact.
    manager.update({
      year: new Set(),
    });
    expect(manager.matchedPlaces).toEqual({
      "Place 1": expectedPlace1Match,
      "Place 2": expectedPlace2Match,
    });

    manager.update({
      includedNudges: new Set(["plant-based default"]),
    });
    expect(manager.matchedPlaces).toEqual({
      "Place 1": expectedPlace1Match,
    });
    manager.update({
      includedNudges: defaultState().includedNudges,
    });

    manager.update({ country: new Set(["United States"]) });
    expect(manager.matchedPlaces).toEqual({
      "Place 1": expectedPlace1Match,
    });
    manager.update({ country: defaultState().country });

    manager.update({ consumerBaseSliderIndexes: [0, 1] });
    expect(manager.matchedPlaces).toEqual({
      "Place 2": expectedPlace2Match,
    });
    manager.update({
      consumerBaseSliderIndexes: defaultState().consumerBaseSliderIndexes,
    });

    manager.update({ placeType: new Set(["Transit Station"]) });
    expect(manager.matchedPlaces).toEqual({
      "Place 2": expectedPlace2Match,
    });
    manager.update({
      placeType: defaultState().placeType,
    });

    manager.update({ status: "pledged" });
    expect(manager.matchedPlaces).toEqual({
      "Place 2": {
        type: "any",
        hasDefault: false,
        hasRatio: true,
        hasSub: false,
        hasTitles: false,
        hasPlacement: false,
        hasOther: false,
      },
    });
    manager.update({
      status: defaultState().status,
    });
  });

  test("plant-based default", () => {
    const manager = new PlaceFilterManager(defaultEntries(), {
      ...defaultState(),
      nudgeTypeFilter: "plant-based default",
      // Should be ignored.
      includedNudges: new Set(),
    });
    expect(manager.matchedPlaces).toEqual({
      "Place 1": {
        type: "single nudge",
        nudgeType: "plant-based default",
        matchingIndexes: [0],
      },
    });

    manager.update({ status: "pledged" });
    expect(manager.matchedPlaces).toEqual({});
    manager.update({ status: defaultState().status });

    manager.update({ year: new Set(["2023"]) });
    expect(manager.matchedPlaces).toEqual({});
    manager.update({ year: defaultState().year });
  });

  test("climate-friendly ratio", () => {
    const manager = new PlaceFilterManager(defaultEntries(), {
      ...defaultState(),
      nudgeTypeFilter: "climate-friendly ratio",
      // Should be ignored.
      includedNudges: new Set(),
    });
    expect(manager.matchedPlaces).toEqual({});

    manager.update({ status: "pledged" });
    expect(manager.matchedPlaces).toEqual({
      "Place 2": {
        type: "single nudge",
        nudgeType: "climate-friendly ratio",
        matchingIndexes: [0],
      },
    });
    manager.update({ status: defaultState().status });

    manager.update({ year: new Set(["2024"]) });
    expect(manager.matchedPlaces).toEqual({});
    manager.update({ year: defaultState().year });
  });

  test("subtle substitution", () => {
    const manager = new PlaceFilterManager(defaultEntries(), {
      ...defaultState(),
      nudgeTypeFilter: "subtle substitution",
      // Should be ignored.
      includedNudges: new Set(),
    });

    expect(manager.matchedPlaces).toEqual({
      "Place 2": {
        type: "single nudge",
        nudgeType: "subtle substitution",
        matchingIndexes: [0],
      },
    });
    manager.update({ status: defaultState().status });

    manager.update({ year: new Set(["2024"]) });
    expect(manager.matchedPlaces).toEqual({});
    manager.update({ year: defaultState().year });
  });

  test("tasty titles & descriptions", () => {
    const manager = new PlaceFilterManager(defaultEntries(), {
      ...defaultState(),
      nudgeTypeFilter: "tasty titles & descriptions",
      // Should be ignored.
      includedNudges: new Set(),
    });

    expect(manager.matchedPlaces).toEqual({
      "Place 2": {
        type: "single nudge",
        nudgeType: "tasty titles & descriptions",
        matchingIndexes: [0],
      },
    });
    manager.update({ status: defaultState().status });

    manager.update({ year: new Set(["2024"]) });
    expect(manager.matchedPlaces).toEqual({});
    manager.update({ year: defaultState().year });
  });

  test("prime placement", () => {
    const manager = new PlaceFilterManager(defaultEntries(), {
      ...defaultState(),
      nudgeTypeFilter: "prime placement",
      // Should be ignored.
      includedNudges: new Set(),
    });

    expect(manager.matchedPlaces).toEqual({
      "Place 2": {
        type: "single nudge",
        nudgeType: "prime placement",
        matchingIndexes: [0],
      },
    });
    manager.update({ status: defaultState().status });

    manager.update({ year: new Set(["2024"]) });
    expect(manager.matchedPlaces).toEqual({});
    manager.update({ year: defaultState().year });
  });

  test("other", () => {
    const manager = new PlaceFilterManager(defaultEntries(), {
      ...defaultState(),
      nudgeTypeFilter: "other",
      // Should be ignored.
      includedNudges: new Set(),
    });

    expect(manager.matchedPlaces).toEqual({
      "Place 2": {
        type: "single nudge",
        nudgeType: "other",
        matchingIndexes: [0],
      },
    });
    manager.update({ status: defaultState().status });

    manager.update({ year: new Set(["2024"]) });
    expect(manager.matchedPlaces).toEqual({});
    manager.update({ year: defaultState().year });
  });

  test("search", () => {
    // Start with a state that does not match anything to prove that search overrides filters.
    const manager = new PlaceFilterManager(defaultEntries(), {
      ...defaultState(),
      country: new Set(),
    });
    expect(manager.matchedPlaces).toEqual({});

    manager.update({ searchInput: "Place 1" });
    expect(manager.matchedPlaces).toEqual({
      "Place 1": { type: "search" },
    });

    // Unrecognized search should match nothing (although, the UI should prevent this from happening anyways).
    manager.update({ searchInput: "Unknown" });
    expect(manager.matchedPlaces).toEqual({});
  });
});
