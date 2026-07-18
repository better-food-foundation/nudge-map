import { expect, test } from "@playwright/test";

import { loadMap, onScreenMarkerPoints } from "./utils";
import { generateScorecard } from "../../src/js/map-features/scorecard";
import { ProcessedPlace } from "../../src/js/model/types";

test("scorecard pops up and closes", async ({ page }) => {
  await loadMap(page);
  const closeIcon = page.locator(".scorecard-close-icon-container");

  const scorecardIsVisible = async () =>
    page.$eval(
      ".scorecard-container",
      (el) => el instanceof HTMLElement && !el.hidden,
    );

  // Markers render on the canvas, so we click them at their projected pixel
  // coordinates rather than via a DOM selector.
  const points = await onScreenMarkerPoints(page);
  const firstMarker = points[0];
  const secondMarker = points[points.length - 1];
  expect(firstMarker).not.toEqual(secondMarker);

  // click on marker
  await page.mouse.click(firstMarker.x, firstMarker.y);
  expect(await scorecardIsVisible()).toBe(true);
  // close popup
  await closeIcon.click();
  expect(await scorecardIsVisible()).toBe(false);

  // click on marker
  await page.mouse.click(firstMarker.x, firstMarker.y);
  expect(await scorecardIsVisible()).toBe(true);
  // click on another marker
  await page.mouse.click(secondMarker.x, secondMarker.y);
  expect(await scorecardIsVisible()).toBe(true);
  // close popup
  await closeIcon.click();
  expect(await scorecardIsVisible()).toBe(false);

  // click on marker
  await page.mouse.click(secondMarker.x, secondMarker.y);
  expect(await scorecardIsVisible()).toBe(true);
  // click outside of popup (not a marker either)
  await page.click("#map-counter");
  expect(await scorecardIsVisible()).toBe(false);
});

test("generateScorecard()", () => {
  const place: ProcessedPlace = {
    name: "My City",
    state: "Arizona",
    country: "United States",
    encoded: "",
    coord: [0, 0],
    url: "https://my-site.org",
    type: "City/Government",
    consumer_base: 245132,
  };

  expect(
    generateScorecard({
      place,
    }),
  ).toEqual(
    `
    <header class="scorecard-header">
      <h2 class="scorecard-title">My City<br/><span class="scorecard-supplemental-place-info">Arizona, United States</span></h2>
      <button
        class="scorecard-close-icon-container"
        title="close the place details popup"
        aria-label="close the place details popup"
      >
        <svg aria-hidden="true" width="1em" height="1em"><use href="#icon-circle-xmark"></use></svg>
      </button>
    </header>
    <a class="external-link" target="_blank" href=https://my-site.org>Details and citations <svg aria-hidden="true" width="1em" height="1em"><use href="#icon-arrow-right"></use></svg></a>
    `,
  );
});
