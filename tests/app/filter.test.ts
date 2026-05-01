/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable no-await-in-loop */

import { Page, test } from "@playwright/test";

import {
  loadMap,
  assertNumPlaces,
  getTotalNumPlaces,
  openFilter,
} from "./utils";
import { NudgeTypeFilter } from "../../src/js/state/FilterState";
import { NudgeStatus } from "../../src/js/model/types";

type StringArrayOption = string[] | "all";

interface EdgeCase {
  desc: string;
  nudgeTypeFilter: NudgeTypeFilter;
  status?: NudgeStatus;
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
    nudgeTypeFilter: "any nudge",
    expectedRange: [1, 8],
  },
  {
    desc: "default: default",
    nudgeTypeFilter: "plant-based default",
    expectedRange: [1, 8],
  },
  {
    desc: "default: ratio",
    nudgeTypeFilter: "climate-friendly ratio",
    expectedRange: [1, 8],
  },
  {
    desc: "default: sub",
    nudgeTypeFilter: "subtle substitution",
    expectedRange: [1, 8],
  },
  {
    desc: "default: titles",
    nudgeTypeFilter: "tasty titles & descriptions",
    expectedRange: [1, 8],
  },
  {
    desc: "default: placement",
    nudgeTypeFilter: "prime placement",
    expectedRange: [1, 8],
  },
  {
    desc: "default: other",
    nudgeTypeFilter: "other",
    expectedRange: [1, 8],
  },
  {
    desc: "disabled filter",
    nudgeTypeFilter: "any nudge",
    country: [],
    expectedRange: [0, 0],
  },
  {
    desc: "any nudge: nudge change filter",
    nudgeTypeFilter: "any nudge",
    includedNudge: ["Plant-based default"],
    expectedRange: [1, 8],
  },
  {
    desc: "country filter",
    nudgeTypeFilter: "any nudge",
    country: ["United States"],
    expectedRange: [1, 8],
  },
  {
    desc: "place type filter",
    nudgeTypeFilter: "any nudge",
    placeType: ["Cafe"],
    expectedRange: [1, 8],
  },
  {
    desc: "status filter",
    nudgeTypeFilter: "subtle substitution",
    status: "pledged",
    expectedRange: [1, 8],
  },
  {
    desc: "year filter",
    nudgeTypeFilter: "prime placement",
    year: ["Unknown", "2023"],
    expectedRange: [1, 4],
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

    if (edgeCase.nudgeTypeFilter !== "any nudge") {
      await page
        .locator("#filter-nudge-type-dropdown")
        .selectOption(edgeCase.nudgeTypeFilter);
    }

    if (edgeCase.status && edgeCase.status !== "adopted") {
      await page
        .locator("#filter-status-dropdown")
        .selectOption(edgeCase.status);
    }

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
