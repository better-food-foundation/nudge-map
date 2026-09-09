import { expect, test } from "@playwright/test";

import {
  radiusGivenZoom,
  determineIsPrimary,
} from "../../src/js/map-features/markerUtils";
import { ProcessedPlace, ProcessedCoreEntry } from "../../src/js/model/types";

test("determineIsPrimary", () => {
  const place: ProcessedPlace = {
    name: "",
    street: "",
    city: "",
    postal_code: "",
    state: "",
    country: "",
    type: "Cafe",
    encoded: "",
    consumer_base: 0,
    coord: [0, 0],
    url: "",
  };

  expect(determineIsPrimary({ place })).toEqual(false);

  // Plant-based default nudges are primary.
  expect(
    determineIsPrimary({
      place,
      default: [
        {
          status: "adopted",
          date: undefined,
          org_credit: [],
          is_verified: false,
        },
      ],
    }),
  ).toEqual(true);
  expect(
    determineIsPrimary({
      place,
      default: [
        {
          status: "pledged",
          date: undefined,
          org_credit: [],
          is_verified: false,
        },
      ],
    }),
  ).toEqual(true);
});

test.describe("radiusGivenZoom", () => {
  const place: ProcessedCoreEntry = {
    place: {
      name: "",
      street: "",
      city: "",
      postal_code: "",
      state: "",
      country: "",
      type: "Cafe",
      encoded: "",
      consumer_base: 10000,
      coord: [0, 0],
      url: "",
    },
  };

  test("calculates radius correctly for zoom levels and consumer base", () => {
    expect(radiusGivenZoom(3, place)).toBe(10);
    expect(radiusGivenZoom(7, place)).toBe(22);
    expect(radiusGivenZoom(10, place)).toBe(32);
  });
});
