/** Config for Eleventy to generate the details pages. */

// @ts-ignore
import CleanCSS from "clean-css";
import { compileString as compileStringSass } from "sass";
import { capitalize } from "lodash-es";

import {
  Citation,
  ProcessedCompleteNudge,
  readProcessedCompleteData,
} from "./scripts/lib/data.js";
import { generateSEO } from "./scripts/lib/staticPages.js";
import { determinesupplementalPlaceInfo } from "./src/js/model/placeId.js";
import { NudgeStatus } from "./src/js/model/types.js";

function dateLabel(status: NudgeStatus): string {
  return (
    {
      adopted: "Adoption date",
      pledged: "Pledge date",
    }[status] ?? "Nudge date"
  );
}

function processCitations(citations: Citation[]): object[] {
  return citations.map((citation) => ({
    urlDomain: citation.url ? new URL(citation.url).hostname : null,
    ...citation,
  }));
}

function processNudge(policy: ProcessedCompleteNudge): object {
  return {
    summary: policy.summary,
    dateLabel: dateLabel(policy.status),
    date: policy.date?.format(),
    status: capitalize(policy.status),
    reporter: policy.reporter,
    citations: processCitations(policy.citations),
  };
}

export default async function (eleventyConfig: any) {
  eleventyConfig.setLiquidOptions({
    jsTruthy: true,
  });

  eleventyConfig.addFilter(
    "scss_compile",
    (code: any) => compileStringSass(code).css,
  );
  eleventyConfig.addFilter(
    "cssmin",
    (code: any) => new CleanCSS({}).minify(code).styles,
  );

  const completeData = await readProcessedCompleteData();
  const entries = Object.entries(completeData).map(([placeId, entry]) => ({
    placeId,
    escapedPlaceId: entry.place.encoded,
    seo: generateSEO(placeId, entry),
    place: {
      name: entry.place.name,
      supplemental: determinesupplementalPlaceInfo(entry.place),
    },
    consumer_base: entry.place.consumer_base.toLocaleString("en-us"),
    default: entry.default?.map(processNudge) || [],
    ratio: entry.ratio?.map(processNudge) || [],
    sub: entry.sub?.map(processNudge) || [],
    titles: entry.titles?.map(processNudge) || [],
    placement: entry.placement?.map(processNudge) || [],
    other: entry.other?.map(processNudge),
  }));

  eleventyConfig.addGlobalData("entries", entries);

  return {
    dir: {
      input: "scripts/11ty",
      output: "city_detail",
    },
  };
}
