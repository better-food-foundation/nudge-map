import type { PlaceId, ProcessedCoreEntry } from "../../src/js/model/types";
import { determineAllNudgeTypes } from "../../src/js/model/data";

interface SEO {
  title: string;
  description: string;
}

export function generateSEO(placeId: PlaceId, entry: ProcessedCoreEntry): SEO {
  const adopted = determineAllNudgeTypes(entry, "adopted");
  const proposed = determineAllNudgeTypes(entry, "pledged");

  const listFormatter = new Intl.ListFormat("en", {
    style: "long",
    type: "conjunction",
  });
  let nudgeDescription: string;
  if (adopted.length) {
    nudgeDescription = listFormatter.format(
      adopted.map(
        (v) =>
          ({
            "plant-based default": "implemented plant-based defaults",
            "climate-friendly ratio": "implemented climate-friendly ratios",
            "subtle substitution": "implemented subtle substitutions",
            "tasty titles & descriptions": "implemented tasty titles and descriptions",
            "prime placement": "implemented prime placement",
            "other": "implemented other nudges",
          })[v],
      ),
    );
  } else if (proposed.length) {
    const mapped = proposed.map(
      (v) =>
        ({
          "plant-based default": "implementing plant-based defaults",
          "climate-friendly ratio": "implementing climate-friendly ratios",
          "subtle substitution": "implementing subtle substitutions",
          "tasty titles & descriptions": "implementing tasty titles and descriptions",
          "prime placement": "implementing prime placement",
          "other": "implementing other nudges",
        })[v],
    );
    nudgeDescription = `proposed ${listFormatter.format(mapped)}`;
  } else {
    throw new Error(`No nudges found for ${placeId}`);
  }

  const description = `${entry.place.name} ${nudgeDescription}. View implementation details.`;
  return {
    title: `Nudges in ${placeId} | Better Food Foundation`,
    description,
  };
}
