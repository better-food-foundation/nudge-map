/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable no-await-in-loop */

import { expect, type Page, test } from "@playwright/test";

import {
  loadMap,
  assertNumPlaces,
  getTotalNumPlaces,
  openFilter,
} from "./utils";
import { NudgeStatusFilter } from "../../src/js/state/FilterState";

type StringArrayOption = string[] | "all";

interface EdgeCase {
  desc: string;
  nudgeStatusFilter?: NudgeStatusFilter;
  includedNudge?: StringArrayOption;
  country?: StringArrayOption;
  year?: StringArrayOption;
  placeType?: StringArrayOption;
  expectedRange: [number, number] | "all";
}

// TODO: Add an EXPECTED_MAX_RANGE constant once we have more data

// The expected ranges can be updated as the data is updated!
const TESTS: EdgeCase[] = [
  {
    desc: "default: any",
    expectedRange: [1, 200],
  },
  {
    desc: "default: default",
    includedNudge: ["Plant-based default"],
    expectedRange: [1, 200],
  },
  {
    desc: "default: ratio",
    includedNudge: ["Climate-friendly ratio"],
    expectedRange: [1, 200],
  },
  {
    desc: "default: sub",
    includedNudge: ["Subtle substitution"],
    expectedRange: [1, 200],
  },
  {
    desc: "default: titles",
    includedNudge: ["Tasty titles & descriptions"],
    expectedRange: [1, 200],
  },
  {
    desc: "default: placement",
    includedNudge: ["Prime placement"],
    expectedRange: [1, 200],
  },
  {
    desc: "default: other",
    includedNudge: ["Other"],
    expectedRange: [1, 200],
  },
  {
    desc: "disabled filter",
    country: [],
    expectedRange: [0, 0],
  },
  {
    desc: "country filter",
    country: ["United States"],
    expectedRange: [1, 200],
  },
  {
    desc: "place type filter",
    placeType: ["Hospital"],
    expectedRange: [1, 200],
  },
  {
    desc: "status filter",
    includedNudge: ["Subtle substitution"],
    nudgeStatusFilter: "pledged",
    expectedRange: [0, 0],
  },
  {
    desc: "year filter",
    includedNudge: ["Climate-friendly ratio"],
    year: ["Unknown", "2025"],
    expectedRange: [1, 30],
  },
  {
    desc: "any status",
    nudgeStatusFilter: "any status",
    expectedRange: [20, 200],
  },
];

const selectIfSet = async (
  page: Page,
  selector: string,
  values?: StringArrayOption,
): Promise<void> => {
  if (!values) return;

  // First, expand the accordion
  await page.locator(`#filter-accordion-toggle-${selector}`).click();

  if (values === "all") {
    await page.locator(`#filter-${selector}-check-all`).click();
    return;
  }

  // Else, uncheck all options to reset the state.
  await page.locator(`#filter-${selector}-uncheck-all`).click();

  const labelSelector = `.filter-${selector} label`;

  // Then, get the checkboxes we need to check.
  const toClick = await page.evaluate(
    (data) => {
      // eslint-disable-next-line no-shadow
      const { labelSelector, values } = data;
      const indices: number[] = [];
      document.querySelectorAll(labelSelector).forEach((label, index) => {
        const text = label.querySelector("span")?.textContent || "";
        if (values.includes(text)) {
          indices.push(index);
        }
      });
      return indices;
    },
    {
      labelSelector,
      values,
    },
  );

  // Finally, click only the checkboxes we need
  for (const index of toClick) {
    await page.locator(labelSelector).nth(index).click();
  }
};

for (const edgeCase of TESTS) {
  test(`${edgeCase.desc}`, async ({ page }) => {
    await loadMap(page);
    await openFilter(page);

    if (
      edgeCase.nudgeStatusFilter &&
      edgeCase.nudgeStatusFilter !== "adopted"
    ) {
      await page
        .locator("#filter-status-dropdown")
        .selectOption(edgeCase.nudgeStatusFilter);
    }

    await selectIfSet(page, "nudge-change", edgeCase.includedNudge);
    await selectIfSet(page, "country", edgeCase.country);
    await selectIfSet(page, "year", edgeCase.year);
    await selectIfSet(page, "place-type", edgeCase.placeType);

    if (edgeCase.expectedRange === "all") {
      const expected = await getTotalNumPlaces();
      await assertNumPlaces(page, [expected, expected]);
    } else {
      await assertNumPlaces(page, edgeCase.expectedRange);
    }
  });
}

// `FilterState`'s option Sets are a single unified view across every dataset, so
// checked-but-hidden values must persist when the user switches datasets.
// "Uncheck all" therefore may only drop the options *visible* in the current
// dataset — not options that exist solely in a different dataset. A regression to
// naive `new Set()` semantics would wipe the entire set and silently reset the
// other datasets' selections.
//
// The specific years below can be updated as the data changes: "1960" must be a
// year present only in "reduce parking minimums", and "2020" a year present in
// both it and "remove parking minimums".
test("uncheck-all only affects the current dataset's options", async ({
  page,
}) => {
  await loadMap(page);
  await openFilter(page);

  // In the "adopted" dataset, uncheck all of its year options.
  await page.locator("#filter-status-dropdown").selectOption("adopted");
  await page.locator("#filter-accordion-toggle-year").click();
  await page.locator("#filter-year-uncheck-all").click();

  // Switch to the "pledged" dataset, whose year options differ.
  await page.locator("#filter-status-dropdown").selectOption("pledged");

  // "2027" exists only in this dataset, so uncheck-all above never touched it.
  await expect(
    page.locator('.filter-year input[data-value="2027"]'),
  ).toBeChecked();
  // "2020" exists in both datasets, so uncheck-all above did remove it.
  await expect(
    page.locator('.filter-year input[data-value="2020"]'),
  ).not.toBeChecked();
});
