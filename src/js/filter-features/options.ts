import { capitalize } from "lodash-es";

import {
  ALL_NUDGE_STATUS_FILTER,
  FilterState,
  PlaceFilterManager,
  NudgeStatusFilter,
} from "../state/FilterState";
import Observable from "../state/Observable";
import {
  BaseAccordionElements,
  AccordionState,
  generateAccordion,
  generateCheckbox,
  updateAccordionUI,
} from "../layout/accordion";
import optionValuesData from "../../../data/option-values.json" with {
  type: "json",
};
import { ALL_NUDGE_STATUS, ALL_NUDGE_TYPE, NudgeStatus } from "../model/types";
import { initConsumerBaseSlider } from "./consumerBaseSlider";
import { createIcon } from "../layout/icons";

/** These option values change depending on which dataset is loaded.
 *
 * Note that some datasets may not actually use a particular option group, but
 * we still include it to make the modeling simpler.
 *
 * Keep in alignment with FilterState.
 */
type DataSetSpecificOptions = {
  includedNudges: readonly string[];
  country: string[];
  year: string[];
  placeType: string[];
  orgCredit: string[];
};

export interface FilterOptions {
  readonly merged: DataSetSpecificOptions;
  readonly datasets: Record<NudgeStatus, DataSetSpecificOptions>;
  getOptions(status: NudgeStatusFilter): DataSetSpecificOptions;
  enabled(status: NudgeStatusFilter): boolean;
}

function mergeDataSetOptions(
  ...datasets: DataSetSpecificOptions[]
): DataSetSpecificOptions {
  const keys = Object.keys(datasets[0]) as (keyof DataSetSpecificOptions)[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Object.fromEntries(
    keys.map((key) => [key, [...new Set(datasets.flatMap((d) => d[key]))]]),
  ) as unknown as DataSetSpecificOptions;
}

export const FILTER_OPTIONS: FilterOptions = {
  merged: {
    includedNudges: ALL_NUDGE_TYPE,
    ...optionValuesData.merged,
  },

  datasets: {
    adopted: {
      includedNudges: ALL_NUDGE_TYPE,
      ...optionValuesData.anyAdopted,
    },
    pledged: {
      includedNudges: ALL_NUDGE_TYPE,
      ...optionValuesData.anyPledged,
    },
  },

  getOptions(status: NudgeStatusFilter): DataSetSpecificOptions {
    if (status === "any status") {
      return mergeDataSetOptions(
        ...ALL_NUDGE_STATUS.map((s) => this.datasets[s]),
      );
    }
    return this.datasets[status];
  },

  enabled(status: NudgeStatusFilter): boolean {
    if (status === "any status") {
      return ALL_NUDGE_STATUS.some(
        (s) => this.datasets[s].placeType.length > 0,
      );
    }
    return this.datasets[status].placeType.length > 0;
  },
} as const;

function getVisibleCheckboxes(
  fieldset: HTMLFieldSetElement,
): Array<HTMLInputElement> {
  const allCheckboxes = fieldset.querySelectorAll<HTMLInputElement>(
    'input[type="checkbox"]',
  );
  return Array.from(allCheckboxes).filter(
    (checkbox) => !checkbox.parentElement?.hidden,
  );
}

export function determineSupplementalTitle(
  fieldset: HTMLFieldSetElement,
): string {
  const visibleCheckboxes = getVisibleCheckboxes(fieldset);
  const total = visibleCheckboxes.length;
  const checked = visibleCheckboxes.filter(
    (checkbox) => checkbox.checked,
  ).length;
  return ` (${checked}/${total})`;
}

type FilterGroupAccordionElements = BaseAccordionElements & {
  fieldSet: HTMLFieldSetElement;
  checkAllButton: HTMLButtonElement;
  uncheckAllButton: HTMLButtonElement;
};

type FilterGroupParams = {
  htmlName: string;
  filterStateKey: keyof DataSetSpecificOptions;
  legend: string | ((state: FilterState) => string);
  /// If not set to true, the option will use Lodash's `capitalize()`. This
  /// only impacts the UI and not the underlying data.
  preserveCapitalization?: boolean;
  useTwoColumns?: boolean;
  hide?: (state: FilterState) => boolean;
};

function generateAccordionForFilterGroup(
  filterState: FilterState,
  params: FilterGroupParams,
): [FilterGroupAccordionElements, Observable<AccordionState>] {
  const baseElements = generateAccordion(params.htmlName);

  const fieldSet = document.createElement("fieldset");
  fieldSet.className = `filter-${params.htmlName}`;
  baseElements.contentContainer.appendChild(fieldSet);

  const groupSelectorButtons = document.createElement("div");
  groupSelectorButtons.className = "filter-group-selectors-container";
  fieldSet.appendChild(groupSelectorButtons);

  const checkAllButton = document.createElement("button");
  checkAllButton.type = "button";
  checkAllButton.textContent = "Check all";
  checkAllButton.id = `filter-${params.htmlName}-check-all`;
  groupSelectorButtons.appendChild(checkAllButton);

  const uncheckAllButton = document.createElement("button");
  uncheckAllButton.type = "button";
  uncheckAllButton.textContent = "Uncheck all";
  uncheckAllButton.id = `filter-${params.htmlName}-uncheck-all`;
  groupSelectorButtons.appendChild(uncheckAllButton);

  const filterOptionsContainer = document.createElement("div");
  filterOptionsContainer.className = "filter-checkbox-options-container";
  if (params.useTwoColumns) {
    filterOptionsContainer.className = "filter-checkbox-options-two-columns";
  }
  fieldSet.appendChild(filterOptionsContainer);

  // When setting up the filter group, we use `merged` to add every option in the universe.
  // However, we use the initial filterState to determine if it should be checked.
  FILTER_OPTIONS.merged[params.filterStateKey].forEach((val, i) => {
    const inputId = `filter-${params.htmlName}-option-${i}`;
    const checked = filterState[params.filterStateKey].has(val);
    const description = params.preserveCapitalization ? val : capitalize(val);
    const [label, input] = generateCheckbox(
      inputId,
      params.htmlName,
      checked,
      description,
    );
    input.dataset.value = val;
    filterOptionsContainer.appendChild(label);
  });

  const elements = {
    ...baseElements,
    fieldSet,
    checkAllButton,
    uncheckAllButton,
  };

  const accordionState = new Observable<AccordionState>(
    `filter accordion ${params.htmlName}`,
    {
      hidden: false,
      expanded: false,
      title:
        typeof params.legend === "string"
          ? params.legend
          : params.legend(filterState),
      supplementalTitle: determineSupplementalTitle(fieldSet),
    },
  );
  accordionState.subscribe((state) => updateAccordionUI(elements, state));
  baseElements.accordionButton.addEventListener("click", () => {
    const priorState = accordionState.getValue();
    accordionState.setValue({
      ...priorState,
      expanded: !priorState.expanded,
    });
  });
  accordionState.initialize();

  return [elements, accordionState];
}

function updateCheckboxStats(
  observable: Observable<AccordionState>,
  fieldSet: HTMLFieldSetElement,
): void {
  const accordionPriorState = observable.getValue();
  observable.setValue({
    ...accordionPriorState,
    supplementalTitle: determineSupplementalTitle(fieldSet),
  });
}

/**
 * Hide all options not in the dataset.
 */
function updateCheckboxVisibility(
  optionsInDataset: readonly string[],
  fieldSet: HTMLFieldSetElement,
): void {
  const validOptions = new Set(optionsInDataset);
  fieldSet
    .querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
    .forEach((checkbox) => {
      checkbox.parentElement!.hidden = !validOptions.has(
        checkbox.dataset.value!,
      );
    });
}

function initFilterGroup(
  filterManager: PlaceFilterManager,
  optionsContainer: HTMLDivElement,
  params: FilterGroupParams,
): void {
  const [accordionElements, accordionState] = generateAccordionForFilterGroup(
    filterManager.getState(),
    params,
  );
  optionsContainer.appendChild(accordionElements.outerContainer);

  const currentValues = (): Set<string> =>
    filterManager.getState()[params.filterStateKey];
  const visibleValues = (): Set<string> =>
    new Set(
      getVisibleCheckboxes(accordionElements.fieldSet).map(
        (input) => input.dataset.value!,
      ),
    );
  accordionElements.fieldSet.addEventListener("change", (event) => {
    const input = event.target as HTMLInputElement;
    const { value } = input.dataset;
    if (value === undefined) return;
    const next = new Set(currentValues());
    if (input.checked) {
      next.add(value);
    } else {
      next.delete(value);
    }
    filterManager.update({ [params.filterStateKey]: next });
  });

  accordionElements.checkAllButton.addEventListener("click", () => {
    const next = new Set([...currentValues(), ...visibleValues()]);
    filterManager.update({ [params.filterStateKey]: next });
  });

  accordionElements.uncheckAllButton.addEventListener("click", () => {
    const visible = visibleValues();
    const next = new Set(
      [...currentValues()].filter((value) => !visible.has(value)),
    );
    filterManager.update({ [params.filterStateKey]: next });
  });
  filterManager.subscribe(
    `possibly update ${params.htmlName} filter UI`,
    (state) => {
      accordionElements.fieldSet
        .querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
        .forEach((input) => {
          input.checked = state[params.filterStateKey].has(
            input.dataset.value!,
          );
        });
      updateCheckboxVisibility(
        FILTER_OPTIONS.getOptions(state.status)[params.filterStateKey],
        accordionElements.fieldSet,
      );
      updateCheckboxStats(accordionState, accordionElements.fieldSet);

      const priorAccordionState = accordionState.getValue();
      const hidden = params.hide ? params.hide(state) : false;
      const title =
        typeof params.legend === "string"
          ? params.legend
          : params.legend(state);
      accordionState.setValue({ ...priorAccordionState, title, hidden });
    },
  );
}

function initOutermostContainers(
  filterManager: PlaceFilterManager,
  filterPopup: HTMLFormElement,
): {
  datasetDiv: HTMLDivElement;
  optionsDiv: HTMLDivElement;
} {
  const datasetDiv = document.createElement("div");

  const disabledDatasetDiv = document.createElement("div");
  disabledDatasetDiv.classList.add("filter-illegal-dataset-container");
  disabledDatasetDiv.hidden = true;
  const warningIcon = createIcon("triangle-exclamation");
  const warningText = document.createElement("span");
  warningText.textContent =
    " This dataset has no entries. To fix, change either the 'nudge type' or 'status'.";
  disabledDatasetDiv.append(warningIcon);
  disabledDatasetDiv.append(warningText);

  const optionsDiv = document.createElement("div");

  filterManager.subscribe(`possibly disable dataset`, ({ status }) => {
    const enabled = FILTER_OPTIONS.enabled(status);
    disabledDatasetDiv.hidden = enabled;
    optionsDiv.hidden = !enabled;
  });

  filterPopup.append(datasetDiv);
  filterPopup.append(disabledDatasetDiv);
  filterPopup.append(optionsDiv);
  return {
    datasetDiv,
    optionsDiv,
  };
}

function initStatusDropdown(
  filterManager: PlaceFilterManager,
  dropdownContainer: HTMLDivElement,
): void {
  const id = "filter-status-dropdown";

  const container = document.createElement("div");
  container.className = "filter-status-dropdown-container";

  const label = document.createElement("label");
  label.htmlFor = id;
  label.textContent = "Status";

  const select = document.createElement("select");
  select.id = id;
  select.name = id;

  ALL_NUDGE_STATUS_FILTER.forEach((option) => {
    const element = document.createElement("option");
    element.value = option;
    element.textContent = capitalize(option);
    select.append(element);
  });

  // Set initial value.
  select.value = filterManager.getState().status;

  select.addEventListener("change", () => {
    const status = select.value as NudgeStatus;
    filterManager.update({ status });
  });

  container.append(label);
  container.append(select);
  dropdownContainer.append(container);
}

function initVerifiedFilter(
  filterManager: PlaceFilterManager,
  optionsContainer: HTMLDivElement,
): void {
  const outerContainer = document.createElement("div");

  const [label, input] = generateCheckbox(
    "filter-verified-option",
    "verified",
    filterManager.getState().isVerified,
    "Only nudges with public citations (vs internal reports)",
  );
  label.id = "filter-verified-option-label";
  outerContainer.append(label);
  optionsContainer.append(outerContainer);

  input.addEventListener("change", () => {
    filterManager.update({
      isVerified: input.checked,
    });
  });
}

export function initFilterOptions(filterManager: PlaceFilterManager): void {
  // Note that the order of this function determines the order of the filter.
  const filterPopup = document.querySelector<HTMLFormElement>("#filter-popup");
  if (!filterPopup) return;

  const { datasetDiv, optionsDiv } = initOutermostContainers(
    filterManager,
    filterPopup,
  );

  // Top-level option
  initStatusDropdown(filterManager, datasetDiv);
  initVerifiedFilter(filterManager, optionsDiv);

  // Options about the nudge
  initFilterGroup(filterManager, optionsDiv, {
    htmlName: "nudge-change",
    filterStateKey: "includedNudges",
    legend: "Nudge types",
  });
  initFilterGroup(filterManager, optionsDiv, {
    htmlName: "year",
    filterStateKey: "year",
    legend: ({ status }) => {
      const mapping: Record<NudgeStatus | "any status", string> = {
        "any status": "Years",
        adopted: "Adoption years",
        pledged: "Pledge years",
      };
      return mapping[status];
    },
    useTwoColumns: true,
  });
  initFilterGroup(filterManager, optionsDiv, {
    htmlName: "org-credit",
    filterStateKey: "orgCredit",
    legend: "Organization credit",
    preserveCapitalization: true,
    useTwoColumns: false,
  });

  // Options about the Place
  initFilterGroup(filterManager, optionsDiv, {
    htmlName: "country",
    filterStateKey: "country",
    legend: "Countries",
    preserveCapitalization: true,
  });
  initFilterGroup(filterManager, optionsDiv, {
    htmlName: "place-type",
    filterStateKey: "placeType",
    legend: "Institution types",
    preserveCapitalization: true,
    useTwoColumns: false,
  });

  initConsumerBaseSlider(filterManager, optionsDiv);
}
