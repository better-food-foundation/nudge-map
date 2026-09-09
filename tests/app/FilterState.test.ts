import { expect, test } from "@playwright/test";

import {
  FilterState,
  PlaceFilterManager,
} from "../../src/js/state/FilterState";
import {
  PlaceId,
  ProcessedCoreEntry,
  ProcessedNudge,
  Date,
  ALL_NUDGE_TYPE,
} from "../../src/js/model/types";
import { POPULATION_MAX_INDEX } from "../../src/js/filter-features/consumerBaseSlider";

test.describe("PlaceFilterManager.matchedNudgeRecords()", () => {
  function defaultState(): FilterState {
    return {
      searchInput: null,
      status: "adopted",
      isVerified: true,
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
          street: null,
          city: "Chicago",
          postal_code: null,
          state: null,
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
            is_verified: true,
          },
        ],
      },
      "Place 2": {
        place: {
          name: "Place 2",
          street: null,
          city: "Brasilia",
          postal_code: null,
          state: null,
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
            is_verified: true,
          },
        ],
        sub: [
          {
            status: "adopted",
            date: new Date("2023"),
            org_credit: ["org2"],
            is_verified: true,
          },
        ],
        titles: [
          {
            status: "adopted",
            date: new Date("2023"),
            org_credit: ["org2"],
            is_verified: true,
          },
        ],
        placement: [
          {
            status: "adopted",
            date: new Date("2023"),
            org_credit: ["org2"],
            is_verified: true,
          },
        ],
        other: [
          {
            status: "adopted",
            date: new Date("2023"),
            org_credit: ["org2"],
            is_verified: true,
          },
        ],
      },
    };
  }

  test("matches places across all filter fields", () => {
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

    // Year is now applied per-nudge-record, so
    // clearing it excludes everything.
    manager.update({ year: new Set() });
    expect(manager.matchedPlaces).toEqual({});
    manager.update({ year: defaultState().year });

    // Narrowing year to only what Place 2's nudges use should drop Place 1
    // (its "default" nudge is dated 2024).
    manager.update({ year: new Set(["2023"]) });
    expect(manager.matchedPlaces).toEqual({
      "Place 2": expectedPlace2Match,
    });
    manager.update({ year: defaultState().year });

    // Org credit is likewise applied per-nudge-record now.
    manager.update({ orgCredit: new Set(["org1"]) });
    expect(manager.matchedPlaces).toEqual({
      "Place 1": expectedPlace1Match,
    });
    manager.update({ orgCredit: defaultState().orgCredit });

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

  test("any status", () => {
    // With "any status", both adopted and pledged nudges should be included
    const manager = new PlaceFilterManager(defaultEntries(), {
      ...defaultState(),
      status: "any status",
    });
    expect(manager.matchedPlaces).toEqual({
      "Place 1": {
        type: "any",
        hasDefault: true,
        hasRatio: false,
        hasSub: false,
        hasTitles: false,
        hasPlacement: false,
        hasOther: false,
      },
      "Place 2": {
        type: "any",
        hasDefault: false,
        hasRatio: true,
        hasSub: true,
        hasTitles: true,
        hasPlacement: true,
        hasOther: true,
      },
    });
  });

  test("verified filter excludes places with only advocate reports", () => {
    const entries = defaultEntries();
    const placeTwo = entries["Place 2"];
    const advocateOnly = (nudges: ProcessedNudge[] | undefined) =>
      (nudges ?? []).map((nudge) => ({
        ...nudge,
        is_verified: false,
      }));
    placeTwo.ratio = advocateOnly(placeTwo.ratio);
    placeTwo.sub = advocateOnly(placeTwo.sub);
    placeTwo.titles = advocateOnly(placeTwo.titles);
    placeTwo.placement = advocateOnly(placeTwo.placement);
    placeTwo.other = advocateOnly(placeTwo.other);
    const manager = new PlaceFilterManager(entries, defaultState());

    expect(manager.placeIds).toEqual(new Set(["Place 1"]));

    manager.update({ isVerified: false });
    expect(manager.placeIds).toEqual(new Set(["Place 1", "Place 2"]));
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
