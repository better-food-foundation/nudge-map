import { expect, test } from "@playwright/test";

import {
  sortCountries,
  determineOptionValues,
} from "../../scripts/lib/optionValues";
import {
  RawCoreEntry,
  UNKNOWN_ORG,
  UNKNOWN_YEAR,
} from "../../src/js/model/types";

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
          org_credit: undefined,
        },
      ],
      ratio: [
        {
          status: "pledged",
          date: "2022-02-13",
          org_credit: ["org1"],
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
          org_credit: undefined,
        },
        {
          status: "pledged",
          date: "2025",
          org_credit: ["org2"],
        },
      ],
      titles: [{ status: "adopted", date: "1997", org_credit: ["org3"] }],
    },
  ];
  const expected = {
    merged: {
      placeType: ["Cafe", "Hotel"],
      country: ["United States", "Brazil"],
      year: [UNKNOWN_YEAR, "2025", "2022", "1997"],
      orgCredit: [UNKNOWN_ORG, "org1", "org2", "org3"],
    },
    anyAdopted: {
      placeType: ["Cafe", "Hotel"],
      country: ["United States", "Brazil"],
      year: [UNKNOWN_YEAR, "1997"],
      orgCredit: [UNKNOWN_ORG, "org3"],
    },
    anyPledged: {
      placeType: ["Cafe", "Hotel"],
      country: ["United States", "Brazil"],
      year: ["2025", "2022"],
      orgCredit: ["org1", "org2"],
    },
    defaultAdopted: {
      placeType: ["Hotel"],
      country: ["United States"],
      year: [UNKNOWN_YEAR],
      orgCredit: [UNKNOWN_ORG],
    },
    defaultPledged: {
      placeType: [],
      country: [],
      year: [],
      orgCredit: [],
    },
    ratioAdopted: {
      placeType: [],
      country: [],
      year: [],
      orgCredit: [],
    },
    ratioPledged: {
      placeType: ["Hotel"],
      country: ["United States"],
      year: ["2022"],
      orgCredit: ["org1"],
    },
    subAdopted: {
      placeType: ["Cafe"],
      country: ["Brazil"],
      year: [UNKNOWN_YEAR],
      orgCredit: [UNKNOWN_ORG],
    },
    subPledged: {
      placeType: ["Cafe"],
      country: ["Brazil"],
      year: ["2025"],
      orgCredit: ["org2"],
    },
    titlesAdopted: {
      placeType: ["Cafe"],
      country: ["Brazil"],
      year: ["1997"],
      orgCredit: ["org3"],
    },
    titlesPledged: {
      placeType: [],
      country: [],
      year: [],
      orgCredit: [],
    },
    placementAdopted: {
      placeType: [],
      country: [],
      year: [],
      orgCredit: [],
    },
    placementPledged: {
      placeType: [],
      country: [],
      year: [],
      orgCredit: [],
    },
    otherAdopted: {
      placeType: [],
      country: [],
      year: [],
      orgCredit: [],
    },
    otherPledged: {
      placeType: [],
      country: [],
      year: [],
      orgCredit: [],
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
