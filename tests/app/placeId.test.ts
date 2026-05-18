import { expect, test } from "@playwright/test";

import {
  encodePlaceId,
  encodedPlaceToUrl,
  determinePlaceIdForDirectus,
  determinesupplementalPlaceInfo,
} from "../../src/js/model/placeId";

test.describe("determinePlaceIdForDirectus", () => {
  test("valid IDs", () => {
    expect(
      determinePlaceIdForDirectus({
        name: "Tucson",
        state: "Arizona",
        country_code: "US",
      }),
    ).toEqual("Tucson, Arizona, United States");
    expect(
      determinePlaceIdForDirectus({
        name: "London",
        state: null,
        country_code: "UK",
      }),
    ).toEqual("London, United Kingdom");
    expect(
      determinePlaceIdForDirectus({
        name: "Germany",
        state: null,
        country_code: "DE",
      }),
    ).toEqual("Germany");

    expect(
      determinePlaceIdForDirectus({
        name: "Scotland",
        state: null,
        country_code: "UK",
      }),
    ).toEqual("Scotland, United Kingdom");
  });

  test("unrecognized country code", () => {
    expect(() =>
      determinePlaceIdForDirectus({
        name: "Tucson",
        state: "Arizona",
        country_code: "BAD",
      }),
    ).toThrow();
  });
});

test("determinesupplementalPlaceInfo", () => {
  expect(
    determinesupplementalPlaceInfo({
      name: "Tucson",
      state: "Arizona",
      country: "United States",
    }),
  ).toEqual("Arizona, United States");
  expect(
    determinesupplementalPlaceInfo({
      name: "Tucson",
      state: null,
      country: "United States",
    }),
  ).toEqual("United States");
  expect(
    determinesupplementalPlaceInfo({
      name: "Scotland",
      state: null,
      country: "United Kingdom",
    }),
  ).toEqual("United Kingdom");
  expect(
    determinesupplementalPlaceInfo({
      name: "United States",
      state: null,
      country: "United States",
    }),
  ).toBeNull();
});

test("encodePlaceId", () => {
  expect(encodePlaceId("Tucson, Arizona, United States")).toEqual(
    "tucson-arizona-united-states",
  );
  expect(encodePlaceId("São Paulo, Brazil")).toEqual("sao-paulo-brazil");
  expect(encodePlaceId("Creek's Hill, Montréal")).toEqual(
    "creeks-hill-montreal",
  );
  expect(encodePlaceId("Șäñțô  ,")).toEqual("santo");
});

test("encodedPlaceToUrl", () => {
  expect(encodedPlaceToUrl("tucson-arizona-united-states")).toEqual(
    "https://parkingreform.org/mandates-map/city_detail/tucson-arizona-united-states.html",
  );
});
