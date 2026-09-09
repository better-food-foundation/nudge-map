/* eslint-disable no-console */
/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable no-await-in-loop */

import fs from "fs/promises";

import { groupBy, kebabCase } from "lodash-es";
import { updateItem } from "@directus/sdk";
import NodeGeocoder from "node-geocoder";

import {
  initDirectus,
  DirectusClient,
  Institution as DirectusPlace,
  Citation as DirectusCitation,
  readItemsBatched,
  readCitationsFilesBatched,
  Nudge,
} from "./lib/directus";
import {
  PlaceId as PlaceStringId,
  NudgeType,
  RawNudge,
} from "../src/js/model/types";
import { getLongLat, initGeocoder } from "./lib/geocoder";
import {
  DirectusFile,
  Citation,
  ExtendedNudge,
  RawCompleteEntry,
  RawCompleteNudge,
  readRawCoreData,
} from "./lib/data";
import { saveOptionValues } from "./lib/optionValues";
import { COUNTRY_MAPPING } from "../src/js/model/data";
import {
  determinePlaceIdForDirectus,
  encodePlaceId,
} from "../src/js/model/placeId";

// --------------------------------------------------------------------------
// Read prior data
// --------------------------------------------------------------------------

async function readPriorEncodedPlaceIds(): Promise<
  Partial<Record<PlaceStringId, string>>
> {
  const data = await readRawCoreData();
  return Object.fromEntries(
    Object.entries(data).map(([placeId, entry]) => [
      placeId,
      entry.place.encoded,
    ]),
  );
}

// --------------------------------------------------------------------------
// Read Directus
// --------------------------------------------------------------------------

async function readPlacesAndEnsureCoordinates(
  client: DirectusClient,
  geocoder: NodeGeocoder.Geocoder,
): Promise<{
  directusIdToStringId: Record<number, PlaceStringId>;
  stringIdToPlace: Record<PlaceStringId, Partial<DirectusPlace>>;
}> {
  const records = await readItemsBatched(client, "institutions", [
    "id",
    "name",
    "street",
    "city",
    "state",
    "postal_code",
    "country_code",
    "type",
    "consumer_base",
    "coordinates",
  ]);
  const directusIdToStringId: Record<number, PlaceStringId> = {};
  const stringIdToPlace: Record<PlaceStringId, Partial<DirectusPlace>> = {};
  for (const record of records) {
    const stringId = determinePlaceIdForDirectus(record);

    if (!record.coordinates) {
      console.log(`Getting coordinates for ${stringId}`);
      const longLat = await getLongLat(
        record.name,
        record.street,
        record.city,
        record.state,
        record.postal_code,
        record.country_code,
        geocoder,
      );
      if (!longLat) {
        throw new Error(
          `Failed to get coordinates for ${stringId} (place ID ${record.id}). You can manually add the coordinates to Directus and try the sync again.`,
        );
      }
      const coordinates = { type: "Point" as const, coordinates: longLat };
      record.coordinates = coordinates;
      await client.request(
        updateItem("institutions", record.id, {
          coordinates,
        }),
      );
    }

    directusIdToStringId[record.id] = stringId;
    stringIdToPlace[stringId] = record;
  }
  return {
    directusIdToStringId,
    stringIdToPlace,
  };
}

async function readNudges(
  client: DirectusClient,
  placeDirectusIdToStringId: Record<number, PlaceStringId>,
): Promise<Record<PlaceStringId, Array<Partial<Nudge>>>> {
  const records = await readItemsBatched(
    client,
    "nudges",
    [
      "id",
      "institution",
      "archived",
      "last_verified_at",
      "status",
      "summary",
      "reporter",
      "date",
      "citations",
      "notes",
      "org_credit",
      "org_credit_expanded",
      "type",
    ],
    100,
    {
      _and: [
        { last_verified_at: { _nnull: true } },
        { archived: { _eq: false } },
      ],
    },
  );
  return groupBy(
    records,
    (record) => placeDirectusIdToStringId[record.institution],
  );
}

async function readCitations(
  client: DirectusClient,
): Promise<Record<number, Partial<DirectusCitation>>> {
  const rawCitations = await readItemsBatched(client, "citations", [
    "id",
    "source_description",
    "type",
    "notes",
    "url",
    "broken_url",
    "attachments",
  ]);
  return Object.fromEntries(rawCitations.map((record) => [record.id, record]));
}

async function readCitationsByJunctionId(
  client: DirectusClient,
  citations: Record<number, Partial<DirectusCitation>>,
  table: "nudges_citations",
): Promise<Record<number, Partial<DirectusCitation>>> {
  const junctionRecords = await readItemsBatched(
    client,
    table,
    ["id", "citations_id"],
    300,
  );
  const citationIdsByJunctionIds = Object.fromEntries(
    junctionRecords.map((record) => [record.id, record.citations_id]),
  );
  return Object.fromEntries(
    Object.entries(citationIdsByJunctionIds).map(([junctionId, citationId]) => [
      junctionId,
      citations[citationId],
    ]),
  );
}

interface FileMetadata {
  id: string;
  mimeType: string | null;
}

async function readFilesByAttachmentJunctionId(
  client: DirectusClient,
): Promise<Record<number, FileMetadata>> {
  const rawFiles = await readCitationsFilesBatched(client, ["id", "type"], 300);
  const fileTypesById = Object.fromEntries(
    rawFiles.map((record) => [record.id, record.type]),
  );

  const rawCitationFileJunctions = await readItemsBatched(
    client,
    "citations_files",
    ["id", "directus_files_id"],
    300,
  );
  const fileIdsByCitationJunctionId = Object.fromEntries(
    rawCitationFileJunctions.map((record) => [
      record.id,
      record.directus_files_id,
    ]),
  );

  return Object.fromEntries(
    Object.entries(fileIdsByCitationJunctionId).map(([junctionId, fileId]) => [
      junctionId,
      { id: fileId, mimeType: fileTypesById[fileId] },
    ]),
  );
}

// --------------------------------------------------------------------------
// Combine data
// --------------------------------------------------------------------------

function mimeTypeToFileExtension(metadata: FileMetadata): string {
  if (!metadata.mimeType) {
    throw new Error(`Missing mime type for file ID ${metadata.id}`);
  }
  const result = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      "docx",
    "application/pdf": "pdf",
  }[metadata.mimeType];
  if (!result) {
    throw new Error(
      `Unrecognized mime type ${metadata.mimeType} for file ${metadata.id}`,
    );
  }
  return result;
}

interface AttachmentFileNameArgsBase {
  placeId: string;
  hasDistinctNudgeTypes: boolean;
  nudgeType: NudgeType;
  /// The index of nudge records for the current `nudgeType`. If
  /// there is only one record for the `nudgeType`, this value should
  /// be set to `null`.
  nudgeRecordIdx: number | null;
}

type AttachmentFileNameArgs = AttachmentFileNameArgsBase & {
  /// The index of citations for the current nudge record. If
  /// there is only one citation for the nudge record, this value
  /// should be set to `null`.
  citationIdx: number | null;
};

export function createAttachments(
  filesByAttachmentJunctionId: Record<number, FileMetadata>,
  attachmentJunctionIds: number[],
  fileNameArgs: AttachmentFileNameArgs,
): { attachments: DirectusFile[]; screenshots: DirectusFile[] } {
  const attachmentIds: Array<{ directusId: string; extension: string }> = [];
  const screenshotIds: Array<{ directusId: string; extension: string }> = [];
  attachmentJunctionIds.forEach((attachmentJunctionId) => {
    const fileMetadata = filesByAttachmentJunctionId[attachmentJunctionId];
    const fileExtension = mimeTypeToFileExtension(fileMetadata);
    const result = { extension: fileExtension, directusId: fileMetadata.id };
    if (fileExtension === "pdf" || fileExtension === "docx") {
      attachmentIds.push(result);
    } else {
      screenshotIds.push(result);
    }
  });

  let fileNamePrefix = kebabCase(fileNameArgs.placeId);
  if (
    fileNameArgs.hasDistinctNudgeTypes ||
    fileNameArgs.nudgeRecordIdx !== null
  ) {
    const nudgeType = {
      "plant-based default": "default",
      "climate-friendly ratio": "ratio",
      "subtle substitution": "sub",
      "tasty titles & descriptions": "titles",
      "prime placement": "placement",
      other: "other",
    }[fileNameArgs.nudgeType];
    const recordIdx =
      fileNameArgs.nudgeRecordIdx === null
        ? ""
        : `${fileNameArgs.nudgeRecordIdx + 1}`;
    fileNamePrefix += `-${nudgeType}${recordIdx}`;
  }
  if (fileNameArgs.citationIdx !== null) {
    fileNamePrefix += `-citation${fileNameArgs.citationIdx + 1}`;
  }

  const attachments: DirectusFile[] = attachmentIds.map(
    ({ directusId, extension }, idx) => {
      const fileIndex = attachmentIds.length === 1 ? "" : `${idx + 1}`;
      const fileName = `${fileNamePrefix}-attachment${fileIndex}.${extension}`;
      return { fileName, directusId };
    },
  );
  const screenshots: DirectusFile[] = screenshotIds.map(
    ({ directusId, extension }, idx) => {
      const fileIndex = screenshotIds.length === 1 ? "" : `${idx + 1}`;
      const fileName = `${fileNamePrefix}-screenshot${fileIndex}.${extension}`;
      return { fileName, directusId };
    },
  );
  return { attachments, screenshots };
}

function createCitations(
  citationJunctionIds: number[],
  citationsByJunctionId: Record<number, Partial<DirectusCitation>>,
  filesByAttachmentJunctionId: Record<number, FileMetadata>,
  fileNameArgs: AttachmentFileNameArgsBase,
): Citation[] {
  return citationJunctionIds.map((junctionId, citationIdx) => {
    const citationRecord = citationsByJunctionId[junctionId];
    if (!citationRecord.type) {
      throw new Error(
        `Missing citation type for citation junction ${junctionId}`,
      );
    }
    const { attachments, screenshots } = createAttachments(
      filesByAttachmentJunctionId,
      citationRecord.attachments!,
      {
        ...fileNameArgs,
        citationIdx: citationJunctionIds.length === 1 ? null : citationIdx,
      },
    );
    const url = citationRecord.broken_url === true ? null : citationRecord.url!;
    return {
      id: citationRecord.id!,
      type: citationRecord.type,
      description: citationRecord.source_description!,
      url,
      notes: citationRecord.notes!,
      attachments,
      screenshots,
    };
  });
}

function parseOrgCredit(raw: string | null | undefined): string[] | undefined {
  if (!raw) return undefined;
  const orgs = raw
    .split(",")
    .map((org) => org.trim())
    .filter(Boolean);
  return orgs.length > 0 ? orgs : undefined;
}

function combineData(
  priorEncodedPlaceIds: Partial<Record<PlaceStringId, string>>,
  places: Record<PlaceStringId, Partial<DirectusPlace>>,
  nudges: Record<PlaceStringId, Array<Partial<Nudge>>>,
  citationsByNudgeJunctionId: Record<number, Partial<DirectusCitation>>,
  filesByAttachmentJunctionId: Record<number, FileMetadata>,
): Record<PlaceStringId, RawCompleteEntry> {
  return Object.fromEntries(
    Object.entries(places)
      .map(([placeId, place]): [PlaceStringId, RawCompleteEntry] => {
        let numDefault = 0;
        let numRatio = 0;
        let numSub = 0;
        let numTitles = 0;
        let numPlacement = 0;
        let numOther = 0;
        if (nudges[placeId]) {
          nudges[placeId].forEach((record) => {
            if (record.type === "plant-based default") numDefault += 1;
            if (record.type === "climate-friendly ratio") numRatio += 1;
            if (record.type === "subtle substitution") numSub += 1;
            if (record.type === "tasty titles & descriptions") numTitles += 1;
            if (record.type === "prime placement") numPlacement += 1;
            if (record.type === "other") numOther += 1;
          });
        }
        const hasDistinctNudgeTypes =
          [
            numDefault,
            numRatio,
            numSub,
            numTitles,
            numPlacement,
            numOther,
          ].filter(Boolean).length > 1;

        const defaultNudge: Array<RawCompleteNudge> = [];
        const ratio: Array<RawCompleteNudge> = [];
        const sub: Array<RawCompleteNudge> = [];
        const titles: Array<RawCompleteNudge> = [];
        const placement: Array<RawCompleteNudge> = [];
        const other: Array<RawCompleteNudge> = [];

        if (nudges[placeId]) {
          nudges[placeId].forEach((record) => {
            console.log(`Type for ${placeId}:`, JSON.stringify(record.type));
            const [collection, numNudgeRecords] = {
              "plant-based default": [defaultNudge, numDefault] as const,
              "climate-friendly ratio": [ratio, numRatio] as const,
              "subtle substitution": [sub, numSub] as const,
              "tasty titles & descriptions": [titles, numTitles] as const,
              "prime placement": [placement, numPlacement] as const,
              other: [other, numOther] as const,
            }[record.type!];
            const nudgeRecordIdx =
              numNudgeRecords > 1 ? collection.length : null;
            const nudge = {
              summary: record.summary!,
              status: record.status!,
              date: record.date! ?? undefined,
              reporter: record.reporter!,
              org_credit: parseOrgCredit(record.org_credit),
              org_credit_expanded: record.org_credit_expanded! ?? undefined,
              is_verified: record.citations!.some((junctionId) => {
                const citation = citationsByNudgeJunctionId[junctionId];
                if (!citation.type) {
                  throw new Error(
                    `Missing citation type for citation junction ${junctionId}`,
                  );
                }
                return citation.type !== "Advocate report";
              }),
              citations: createCitations(
                record.citations!,
                citationsByNudgeJunctionId,
                filesByAttachmentJunctionId,
                {
                  placeId,
                  hasDistinctNudgeTypes,
                  nudgeType: record.type!,
                  nudgeRecordIdx,
                },
              ),
            };
            collection.push(nudge);
          });
        }

        const result: RawCompleteEntry = {
          place: {
            name: place.name!,
            street: place.street!,
            city: place.city!,
            state: place.state!,
            postal_code: place.postal_code!,
            country:
              COUNTRY_MAPPING[place.country_code!] ?? place.country_code!,
            type: place.type!,
            encoded: priorEncodedPlaceIds[placeId] ?? encodePlaceId(placeId),
            consumer_base: place.consumer_base!,
            coord: place.coordinates!.coordinates,
          },
          ...(defaultNudge.length && { default: defaultNudge }),
          ...(ratio.length && { ratio }),
          ...(sub.length && { sub }),
          ...(titles.length && { titles }),
          ...(placement.length && { placement }),
          ...(other.length && { other }),
        };
        return [placeId, result];
      })
      // Filter out places without any nudge records.
      .filter(
        ([, entry]) =>
          entry.default?.length ||
          entry.ratio?.length ||
          entry.sub?.length ||
          entry.titles?.length ||
          entry.placement?.length ||
          entry.other?.length,
      )
      .sort(),
  );
}

// --------------------------------------------------------------------------
// Save results
// --------------------------------------------------------------------------

async function saveCoreData(
  result: Record<PlaceStringId, RawCompleteEntry>,
): Promise<void> {
  const formatNudge = (record: RawNudge) => ({
    status: record.status,
    date: record.date,
    org_credit: record.org_credit,
    is_verified: record.is_verified,
  });

  const pruned = Object.fromEntries(
    Object.entries(result).map(([placeId, entry]) => [
      placeId,
      {
        place: {
          name: entry.place.name,
          street: entry.place.street,
          city: entry.place.city,
          state: entry.place.state,
          postal_code: entry.place.postal_code,
          country: entry.place.country,
          type: entry.place.type,
          encoded: entry.place.encoded,
          consumer_base: entry.place.consumer_base,
          coord: entry.place.coord,
        },
        ...(entry.default && {
          default: entry.default.map(formatNudge),
        }),
        ...(entry.ratio && {
          ratio: entry.ratio.map(formatNudge),
        }),
        ...(entry.sub && {
          sub: entry.sub.map(formatNudge),
        }),
        ...(entry.titles && {
          titles: entry.titles.map(formatNudge),
        }),
        ...(entry.placement && {
          placement: entry.placement.map(formatNudge),
        }),
        ...(entry.other && {
          other: entry.other.map(formatNudge),
        }),
      },
    ]),
  );
  const json = JSON.stringify(pruned, null, 2);
  console.log("Writing data/core.json");
  await fs.writeFile("data/core.json", json);
}

async function saveExtendedData(
  result: Record<PlaceStringId, RawCompleteEntry>,
): Promise<void> {
  const formatNudge = (record: ExtendedNudge) => ({
    summary: record.summary,
    reporter: record.reporter,
    citations: record.citations,
  });

  const pruned = Object.fromEntries(
    Object.entries(result).map(([placeId, entry]) => [
      placeId,
      {
        ...(entry.default && { default: entry.default.map(formatNudge) }),
        ...(entry.ratio && { ratio: entry.ratio.map(formatNudge) }),
        ...(entry.sub && { sub: entry.sub.map(formatNudge) }),
        ...(entry.titles && { titles: entry.titles.map(formatNudge) }),
        ...(entry.placement && { placement: entry.placement.map(formatNudge) }),
        ...(entry.other && { other: entry.other.map(formatNudge) }),
      },
    ]),
  );
  const json = JSON.stringify(pruned, null, 2);
  console.log("Writing data/extended.json");
  await fs.writeFile("data/extended.json", json);
}

// --------------------------------------------------------------------------
// Main
// --------------------------------------------------------------------------

async function main(): Promise<void> {
  const client = await initDirectus();
  const geocoder = initGeocoder();

  const priorEncodedPlaceIds = await readPriorEncodedPlaceIds();

  const places = await readPlacesAndEnsureCoordinates(client, geocoder);
  const nudges = await readNudges(client, places.directusIdToStringId);
  const citations = await readCitations(client);
  const citationsByNudgeJunctionId = await readCitationsByJunctionId(
    client,
    citations,
    "nudges_citations",
  );
  const filesByAttachmentJunctionId =
    await readFilesByAttachmentJunctionId(client);

  const result = combineData(
    priorEncodedPlaceIds,
    places.stringIdToPlace,
    nudges,
    citationsByNudgeJunctionId,
    filesByAttachmentJunctionId,
  );

  await saveCoreData(result);
  await saveExtendedData(result);
  await saveOptionValues(Object.values(result));
  process.exit(0);
}

if (process.env.NODE_ENV !== "test") {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
