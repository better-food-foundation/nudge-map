# Better Food Foundation Nudge Map data set

This folder contains the data used for https://better-food-foundation.github.io/nudge-map/, which records places that have implemented or pledged plant-based nudges.

## CSV files

There are seven CSV files. These CSVs only summarize the data; use the JSON file for the complete dataset.

- `overview_adopted.csv`: an overview of all places that have adopted nudges
- `overview_pledged.csv`: an overview of all places that have pledged new reforms
- `plant_based_defaults.csv`: plant-based defaults
- `climate_friendly_ratios.csv`: climate-friendly ratios
- `subtle_substitutions.csv`: subtle substitutions
- `tasty_titles.csv`: tasty titles & descriptions
- `prime_placement.csv`: prime placement
- `other.csv`: other nudges


## JSON

`complete-data.json` contains the full dataset with additional features not available in the CSVs, such as array support and citation information.

For working with JSON data, we recommend using [`jq`](https://jqlang.github.io/jq/tutorial/), a command-line tool for filtering and transforming JSON. Online tutorials and AI assistants like ChatGPT can help you create `jq` queries.

## Attribution

Please attribute to "Better Food Foundation" with a link to https://better-food-foundation.github.io/nudge-map/ and include the date of the data download.
