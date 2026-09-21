import { expect, test } from "@playwright/test";

import {
  encodeFilterState,
  decodeFilterState,
  DEFAULT_FILTER_STATE,
  MERGED_STRING_SET_OPTIONS,
  COUNTRY_MAP,
  COUNTRY_NAME,
  NUDGE_TYPE_NAME,
  PLACE_TYPE_NAME,
  YEAR_NAME,
  ORG_NAME,
  IS_VERIFIED_NAME,
  STATUS_NAME,
  YEAR_MAP,
  PLACE_TYPE_MAP,
  NUDGE_TYPE_MAP,
  STATUS_MAP,
  ORG_CREDIT_MAP,
} from "../../src/js/state/urlEncoder";
import { FilterState } from "../../src/js/state/FilterState";

test.describe("encodeFilterState", () => {
  test("default state", () => {
    expect(encodeFilterState(DEFAULT_FILTER_STATE).size).toEqual(0);
  });

  test("set every value", () => {
    const state: FilterState = {
      ...DEFAULT_FILTER_STATE,
      includedNudges: new Set(["plant-based default"]),
      placeType: new Set(["Cafe"]),
      year: new Set(["2017"]),
      orgCredit: new Set(["C40 Good Food Cities"]),
      isVerified: false,
      status: "pledged",
      consumerBaseSliderIndexes: [1, 2],
      country: new Set(["Mexico", "Brazil"]),
    };
    const result = encodeFilterState(state);
    expect(result.get("cntry")).toEqual("mx.br");
    expect(result.get("inst")).toEqual("cfe");
    expect(result.get("nudges")).toEqual("pbd");
    expect(result.get("org")).toEqual("cgfc");
    expect(result.get("status")).toEqual("p");
    expect(result.get("verified")).toEqual("n");
    expect(result.get("yr")).toEqual("2017");
    expect(result.get("cb")).toEqual("1.2");

    // Check round-trip
    expect(decodeFilterState(result.toString())).toEqual(state);
  });
});

test.describe("decodeFilterState", () => {
  const assertDecode = (
    query: string,
    expected: FilterState,
    kwargs: { checkRoundTrip: boolean },
  ) => {
    const { checkRoundTrip } = kwargs;

    const decoded = decodeFilterState(query);
    expect(decoded).toEqual(expected);

    // Ensure round trip works.
    if (checkRoundTrip) {
      const reEncoded = encodeFilterState(decoded).toString();
      const originalAsParams = new URLSearchParams(query);
      originalAsParams.sort();
      expect(reEncoded).toEqual(originalAsParams.toString());
    }
  };

  test("default state", () => {
    assertDecode("", DEFAULT_FILTER_STATE, { checkRoundTrip: true });
  });

  test("set every value", () => {
    const url = [
      "cb=0.1",
      "inst=cfe",
      "nudges=pbd",
      "org=cgfc",
      "status=p",
      "verified=n",
      "yr=2017",
      "cntry=mx.br"].join("&");
    assertDecode(
      url,
      {
        ...DEFAULT_FILTER_STATE,
        includedNudges: new Set(["plant-based default"]),
        placeType: new Set(["Cafe"]),
        year: new Set(["2017"]),
        orgCredit: new Set(["C40 Good Food Cities"]),
        isVerified: false,
        status: "pledged",
        consumerBaseSliderIndexes: [0, 1],
        country: new Set(["Mexico", "Brazil"]),
      },
      { checkRoundTrip: true },
    );
  });

  test("illegal values", () => {
    const url = [
      NUDGE_TYPE_NAME,
      PLACE_TYPE_NAME,
      YEAR_NAME,
      ORG_NAME,
      IS_VERIFIED_NAME,
      STATUS_NAME,
      COUNTRY_NAME].map((x) => `${x}=foo`).join("&");
    assertDecode(url, DEFAULT_FILTER_STATE, {
      checkRoundTrip: false,
    });
  });

  test("some illegal array elements", () => {
    const url = ["nudges=foo.pbd", "inst=foo.cfe", "yr=1.2024", "cntry=foo.mx"].join("&");
    assertDecode(
      url,
      {
        ...DEFAULT_FILTER_STATE,
        includedNudges: new Set(["plant-based default"]),
        placeType: new Set(["Cafe"]),
        year: new Set(["2024"]),
        country: new Set(["Mexico"]),
      },
      {
        checkRoundTrip: false,
      },
    );
  });
});

test.describe("mappers are fully comprehensive", () => {
  test("country", () => {
    expect(COUNTRY_MAP.keys()).toEqual(MERGED_STRING_SET_OPTIONS.country);
  });
  test("year", () => {
    expect(YEAR_MAP.keys()).toEqual(MERGED_STRING_SET_OPTIONS.year);
  });
  test("place type", () => {
    expect(PLACE_TYPE_MAP.keys()).toEqual(MERGED_STRING_SET_OPTIONS.placeType);
  });
  test("nudge type", () => {
    expect(NUDGE_TYPE_MAP.keys()).toEqual(MERGED_STRING_SET_OPTIONS.includedNudges);
  });
  test("org credit", () => {
    expect(ORG_CREDIT_MAP.keys()).toEqual(MERGED_STRING_SET_OPTIONS.orgCredit);
  });
  test("status", () => {
    expect(STATUS_MAP.keys()).toEqual(new Set(["adopted", "pledged"]));
  });
});
