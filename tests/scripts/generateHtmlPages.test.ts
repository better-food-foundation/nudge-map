import { readFile } from "fs/promises";

import { expect, test } from "@playwright/test";

// This test uses snapshot testing (https://jestjs.io/docs/snapshot-testing#updating-snapshots). If the tests fail and the changes
// are valid, run `npm test -- --update-snapshots`.

// eslint-disable-next-line no-empty-pattern
test("generate html page", async ({}, testInfo) => {
  // Normally, Playwright saves the operating system name in the snapshot results.
  // Our test is OS-independent, so turn this off.
  // eslint-disable-next-line no-param-reassign
  testInfo.snapshotSuffix = "";

  const assertPlace = async (normalizedPlaceId: string): Promise<void> => {
    const content = await readFile(`place-detail/${normalizedPlaceId}.html`);
    const snapshotName = normalizedPlaceId.toLowerCase().replace("_", "-");
    expect(content).toMatchSnapshot(`${snapshotName}.html`);
  };

  await assertPlace("north-vancouver-district-bc-canada");
  await assertPlace("california-state-los-angeles-ca-united-states");
  await assertPlace("university-of-north-texas-tx-united-states");
  await assertPlace("hennepin-county-minnesota-mn-united-states");
});
