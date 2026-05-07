import { expect, test } from "@playwright/test";

import {
  sortCountries,
  determineOptionValues,
} from "../../scripts/lib/optionValues";
import { RawCoreEntry, UNKNOWN_YEAR } from "../../src/js/model/types";

test("determineOptionValues()", () => {
  const commonPlace = {
    name: "n/a",
    state: "n/a",
    encoded: "",
    coord: [0, 0] as [number, number],
    consumer_base: 0,
  };
  const input: RawCoreEntry[] = [
    {
      place: {
        ...commonPlace,
        country: "United States",
        type: "Hotel",
      },
      default: [
        {
          status: "adopted",
          date: undefined,
        },
      ],
      ratio: [
        {
          status: "pledged",
          date: "2022-02-13",
        },
      ],
    },
    {
      place: {
        ...commonPlace,
        country: "Brazil",
        type: "Cafe",
      },
      sub: [
        {
          status: "adopted",
          date: undefined,
        },
        {
          status: "pledged",
          date: "2025",
        },
      ],
      titles: [{ status: "adopted", date: "1997" }],
    },
  ];
  const expected = {
    merged: {
      placeType: ["cafe", "hotel"],
      country: ["United States", "Brazil"],
      year: [UNKNOWN_YEAR, "2025", "2022", "1997"],
    },
    anyAdopted: {
      placeType: ["cafe", "hotel"],
      country: ["United States", "Brazil"],
      year: [UNKNOWN_YEAR, "1997"],
    },
    anyPledged: {
      placeType: ["cafe", "hotel"],
      country: ["United States", "Brazil"],
      year: ["2025", "2022"],
    },
    defaultAdopted: {
      placeType: ["hotel"],
      country: ["United States"],
      year: [UNKNOWN_YEAR],
    },
    defaultPledged: {
      placeType: [],
      country: [],
      year: [],
    },
    ratioAdopted: {
      placeType: [],
      country: [],
      year: [],
    },
    ratioPledged: {
      placeType: ["hotel"],
      country: ["United States"],
      year: ["2022"],
    },
    subAdopted: {
      placeType: ["cafe"],
      country: ["Brazil"],
      year: [UNKNOWN_YEAR],
    },
    subPledged: {
      placeType: ["cafe"],
      country: ["Brazil"],
      year: ["2025"],
    },
    titlesAdopted: {
      placeType: ["cafe"],
      country: ["Brazil"],
      year: ["1997"],
    },
    titlesPledged: {
      placeType: [],
      country: [],
      year: [],
    },
    placementAdopted: {
      placeType: [],
      country: [],
      year: [],
    },
    placementPledged: {
      placeType: [],
      country: [],
      year: [],
    },
    otherAdopted: {
      placeType: [],
      country: [],
      year: [],
    },
    otherPledged: {
      placeType: [],
      country: [],
      year: [],
    },
  };
  expect(determineOptionValues(input)).toEqual(expected);
});

test("sortCountries", () => {
  const withUS = new Set(["Canada", "Brazil", "United States", "Argentina"]);
  expect(sortCountries(withUS)).toEqual([
    "United States",
    "Argentina",
    "Brazil",
    "Canada",
  ]);

  const withoutUS = new Set(["Canada", "Brazil", "Argentina"]);
  expect(sortCountries(withoutUS)).toEqual(["Argentina", "Brazil", "Canada"]);
});
