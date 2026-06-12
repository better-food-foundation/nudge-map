import {
  Tabulator,
  FilterModule,
  FormatModule,
  SortModule,
  ResizeColumnsModule,
  MoveColumnsModule,
  ExportModule,
  DownloadModule,
  ColumnDefinition,
  FrozenColumnsModule,
  PageModule,
  RowComponent,
  SortDirection,
  ColumnComponent,
  CellComponent,
} from "tabulator-tables";

import { PlaceFilterManager, NudgeTypeFilter, NudgeStatusFilter } from "./state/FilterState";
import { Date, ProcessedNudge } from "./model/types";
import { ViewStateObservable } from "./layout/viewToggle";
import { determineAllNudgeTypes } from "./model/data";

function formatBoolean(cell: CellComponent): string {
  const v = cell.getValue() as boolean;
  return v ? "✓" : "";
}

function formatDate(cell: CellComponent): string {
  const v = cell.getValue() as Date | null;
  return v ? v.format() : "";
}

export function compareDates(
  a: Date | undefined,
  b: Date | undefined,
  _aRow: RowComponent,
  _bRow: RowComponent,
  _col: ColumnComponent,
  dir: SortDirection,
): number {
  if (a === b) return 0;
  if (dir === "asc") {
    if (!a) return 1;
    if (!b) return -1;
  } else {
    if (!a) return -1;
    if (!b) return 1;
  }
  return a.parsed.valueOf() - b.parsed.valueOf();
}

function compareStringArrays(a: string[], b: string[]): number {
  return a.join(",").localeCompare(b.join(","));
}

function formatStringArrays(cell: CellComponent): string {
  const v = cell.getValue() as string[] | null;
  return v ? v.join("; ") : "";
}

const PLACE_COLUMNS: ColumnDefinition[] = [
  {
    title: "Place",
    field: "place",
    width: 200,
    frozen: true,
    formatter: "link",
    formatterParams: {
      urlField: "url",
      labelField: "place",
      target: "_blank",
    },
  },
  {
    title: "Type",
    field: "placeType",
    width: 150,
  },
  { title: "State", field: "state", width: 120 },
  { title: "Country", field: "country", width: 120 },
  {
    title: "Consumer Base",
    field: "consumer_base",
    sorter: "number",
    sorterParams: {
      // @ts-expect-error type hint is wrong
      thousandSeparator: ",",
    },
    width: 90,
  },
];

const DATE_COLUMN: ColumnDefinition = {
  title: "Date",
  field: "date",
  width: 110,
  formatter: formatDate,
  sorter: compareDates,
};

const SINGLE_NUDGE_COLUMNS: ColumnDefinition[] = [
  ...PLACE_COLUMNS,
  DATE_COLUMN,
  {
    title: "Status",
    field: "status",
    width: 120,
  },
  {
    title: "Org credit",
    field: "org_credit",
    width: 200,
    formatter: formatStringArrays,
    sorter: compareStringArrays,
  },
]

const ANY_NUDGE_COLUMNS: ColumnDefinition[] = [
  ...PLACE_COLUMNS,
  {
    title: "Plant-based default",
    field: "default",
    width: 120,
    formatter: formatBoolean,
    hozAlign: "center",
  },
  {
    title: "Climate-friendly ratio",
    field: "ratio",
    width: 120,
    formatter: formatBoolean,
    hozAlign: "center",
  },
  {
    title: "Subtle substitution",
    field: "sub",
    width: 120,
    formatter: formatBoolean,
    hozAlign: "center",
  },
  {
    title: "Tasty titles & descriptions",
    field: "titles",
    width: 120,
    formatter: formatBoolean,
    hozAlign: "center",
  },
  {
    title: "Prime placement",
    field: "placement",
    width: 120,
    formatter: formatBoolean,
    hozAlign: "center",
  },
  {
    title: "Other",
    field: "other",
    width: 120,
    formatter: formatBoolean,
    hozAlign: "center",
  },
];


export function tableDownloadFileName(
  nudgeType: NudgeTypeFilter,
  status: NudgeStatusFilter,
): string {
  const nudge = {
    "any nudge": "overview",
    "plant-based default": "defaults",
    "climate-friendly ratio": "ratios",
    "subtle substitution": "substitutions",
    "tasty titles & descriptions": "titles-descriptions",
    "prime placement": "placement",
    "other": "other",
  }[nudgeType];
  return `nudges--${nudge}--${status}.csv`;
}

function updateCounterDownload(
  table: Tabulator,
  nudgeType: NudgeTypeFilter,
  status: NudgeStatusFilter,
): void {
  const button = document.querySelector(".counter-table-download");
  if (!button) return;
  button.addEventListener("click", () =>
    table.download("csv", tableDownloadFileName(nudgeType, status)),
  );
}

export default function initTable(
  filterManager: PlaceFilterManager,
  viewToggle: ViewStateObservable,
): Tabulator {
  Tabulator.registerModule([
    FilterModule,
    FormatModule,
    FrozenColumnsModule,
    SortModule,
    ResizeColumnsModule,
    MoveColumnsModule,
    PageModule,
    ExportModule,
    DownloadModule,
  ]);
  
const dataAnyAdopted: any[] = [];
const dataAnyPledged: any[] = [];
const dataAnyAll: any[] = [];
const dataDefault: any[] = [];
const dataRatio: any[] = [];
const dataSub: any[] = [];
const dataTitles: any[] = [];
const dataPlacement: any[] = [];
const dataOther: any[] = [];
  
Object.entries(filterManager.entries).forEach(([placeId, entry]) => {
  const common = {
    placeId,
    place: entry.place.name,
    state: entry.place.state,
    country: entry.place.country,
    placeType: entry.place.type,
    consumer_base: entry.place.consumer_base.toLocaleString("en-us"),
    url: entry.place.url,
  };
  
  const adopted = determineAllNudgeTypes(entry, "adopted");
  dataAnyAdopted.push({
      ...common,
      default: adopted.includes("plant-based default"),
      ratio: adopted.includes("climate-friendly ratio"),
      sub: adopted.includes("subtle substitution"),
      titles: adopted.includes("tasty titles & descriptions"),
      placement: adopted.includes("prime placement"),
      other: adopted.includes("other"),
    });
  const pledged = determineAllNudgeTypes(entry, "pledged");
  dataAnyPledged.push({
      ...common,
      default: pledged.includes("plant-based default"),
      ratio: pledged.includes("climate-friendly ratio"),
      sub: pledged.includes("subtle substitution"),
      titles: pledged.includes("tasty titles & descriptions"),
      placement: pledged.includes("prime placement"),
      other: pledged.includes("other"),
  });
  const allAdoptedAndPledged = [
  ...determineAllNudgeTypes(entry, "adopted"),
  ...determineAllNudgeTypes(entry, "pledged"),
  ];
  dataAnyAll.push({
    ...common,
    default: allAdoptedAndPledged.includes("plant-based default"),
    ratio: allAdoptedAndPledged.includes("climate-friendly ratio"),
    sub: allAdoptedAndPledged.includes("subtle substitution"),
    titles: allAdoptedAndPledged.includes("tasty titles & descriptions"),
    placement: allAdoptedAndPledged.includes("prime placement"),
    other: allAdoptedAndPledged.includes("other"),
  });

  const saveNudge = (
    collection: any[],
    nudges: ProcessedNudge[] | undefined,
  ): void =>
    nudges?.forEach((nudge, i) =>
      collection.push({
        ...common,
        nudgeIdx: i,
        date: nudge.date,
        status: nudge.status,
        org_credit: nudge.org_credit,
      }),
    );

  saveNudge(dataDefault, entry.default);
  saveNudge(dataRatio, entry.ratio);
  saveNudge(dataSub, entry.sub);
  saveNudge(dataTitles, entry.titles);
  saveNudge(dataPlacement, entry.placement);
  saveNudge(dataOther, entry.other);
});

  const filterStateToConfig: Record<
    NudgeTypeFilter,
    Record<string, [ColumnDefinition[], any[]]>
  > = {
    "any nudge": {
      adopted: [ANY_NUDGE_COLUMNS, dataAnyAdopted],
      pledged: [ANY_NUDGE_COLUMNS, dataAnyPledged],
      "any status": [ANY_NUDGE_COLUMNS, dataAnyAll],
    },
    "plant-based default": {
      adopted: [SINGLE_NUDGE_COLUMNS, dataDefault],
      pledged: [SINGLE_NUDGE_COLUMNS, dataDefault],
      "any status": [SINGLE_NUDGE_COLUMNS, dataDefault],
    },
    "climate-friendly ratio": {
      adopted: [SINGLE_NUDGE_COLUMNS, dataRatio],
      pledged: [SINGLE_NUDGE_COLUMNS, dataRatio],
      "any status": [SINGLE_NUDGE_COLUMNS, dataRatio],
    },
    "subtle substitution": {
      adopted: [SINGLE_NUDGE_COLUMNS, dataSub],
      pledged: [SINGLE_NUDGE_COLUMNS, dataSub],
      "any status": [SINGLE_NUDGE_COLUMNS, dataSub],
    },
    "tasty titles & descriptions": {
      adopted: [SINGLE_NUDGE_COLUMNS, dataTitles],
      pledged: [SINGLE_NUDGE_COLUMNS, dataTitles],
      "any status": [SINGLE_NUDGE_COLUMNS, dataTitles],
    },
    "prime placement": {
      adopted: [SINGLE_NUDGE_COLUMNS, dataPlacement],
      pledged: [SINGLE_NUDGE_COLUMNS, dataPlacement],
      "any status": [SINGLE_NUDGE_COLUMNS, dataPlacement],
    },
    "other": {
      adopted: [SINGLE_NUDGE_COLUMNS, dataOther],
      pledged: [SINGLE_NUDGE_COLUMNS, dataOther],
      "any status": [SINGLE_NUDGE_COLUMNS, dataOther],
    },
  };
  
  // We track what the filter is currently set to. When the filter changes,
  // we need to load the new columns and data.
  let currentNudgeTypeFilter = filterManager.getState().nudgeTypeFilter;
  let currentStatus = filterManager.getState().status;

  const [columns, data] =
    filterStateToConfig[currentNudgeTypeFilter][currentStatus];
  const table = new Tabulator("#table", {
    data,
    columns: columns,
    layout: "fitColumns",
    movableColumns: true,
    // We use pagination to avoid performance issues.
    pagination: true,
    paginationSize: 100,
    paginationCounter: (
      _pageSize,
      _currentRow,
      currentPage,
      _totalRows,
      totalPages,
    ) => `Page ${currentPage} of ${totalPages}`,
  });

  // We use Tabulator's filter to add/remove records based on FilterState,
  // as it's much faster than resetting the data.
  //
  // Note that the same filter works for every NudgeTypeFilter, meaning we
  // don't need to re-set this up based on which is chosen.
  let tableBuilt = false;
  table.on("tableBuilt", () => {
    tableBuilt = true;
    table.setFilter((row) => {
      const entry = filterManager.matchedPlaces[row.placeId];
      if (!entry) return false;
      if (entry.type === "any") {
        return true;
      }
      // With search, we ignore the normal filters like country. However,
      // we do still have to pay attention to what dataset is loaded
      // (nudge type x status).
      if (entry.type === "search") {
        // With 'any nudge', each nudge status has a different dataset already.
        // So, it's safe to include the entry from search.
        if (currentNudgeTypeFilter === "any nudge") {
          return true;
        }
        return row.status === currentStatus;
      }
      return entry.matchingIndexes.includes(row.nudgeIdx);
    });
  });

  // Either re-filter the data or load an entirely new dataset.
  const updateData = (
    newNudgeTypeFilter: NudgeTypeFilter,
    newStatus: NudgeStatusFilter,
  ): void => {
    if (
      newNudgeTypeFilter === currentNudgeTypeFilter &&
      newStatus === currentStatus
    ) {
      table.refreshFilter();
    } else {
      currentNudgeTypeFilter = newNudgeTypeFilter;
      currentStatus = newStatus;
      const [columns2, data2] =
        filterStateToConfig[newNudgeTypeFilter][newStatus];
      table.setColumns(columns2);
      table.setData(data2);
    }
  };

  // When on map view, we should only lazily update the table the next time
  // we switch to table view.
  let dataRefreshQueued = false;

  filterManager.subscribe(
    "update table's records",
    ({ nudgeTypeFilter, status }) => {
      updateCounterDownload(table, nudgeTypeFilter, status);
      if (!tableBuilt) return;
      if (viewToggle.getValue() === "map") {
        dataRefreshQueued = true;
        return;
      }

      updateData(nudgeTypeFilter, status);
    },
  );

  viewToggle.subscribe((view) => {
    if (view === "map" || !dataRefreshQueued) return;
    dataRefreshQueued = false;
    const state = filterManager.getState();
    updateData(state.nudgeTypeFilter, state.status);
  }, "apply queued table data refresh");

  return table;
}
