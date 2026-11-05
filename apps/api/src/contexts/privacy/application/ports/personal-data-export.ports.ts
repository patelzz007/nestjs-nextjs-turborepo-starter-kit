import type { Readable } from "node:stream";

import type { JsonValue, PersonalDataManifest } from "@workspace/shared";
import type { FastifyRequest } from "fastify";

/** One section of the export, ready to write: its file name and its JSON. */
export interface PersonalDataArchiveFile {
	readonly file: string;
	readonly data: JsonValue;
}

/** Writes the export as one ZIP (`manifest.json` first, then one JSON file per section), streamed. */
export interface PersonalDataArchivePort {
	archive(manifest: PersonalDataManifest, files: readonly PersonalDataArchiveFile[]): Readable;
}

/**
 * Records the export as the request's sensitive-read audit row (ADR 025, rules/10), BEFORE anything leaves
 * the server: which sections and how many records, never the data. Throws when the row can't be written,
 * so nothing is released unaudited.
 */
export interface PersonalDataExportAuditPort {
	recordExport(request: FastifyRequest, summary: JsonValue): Promise<void>;
}

export const PERSONAL_DATA_ARCHIVE = Symbol("PERSONAL_DATA_ARCHIVE");
export const PERSONAL_DATA_EXPORT_AUDIT = Symbol("PERSONAL_DATA_EXPORT_AUDIT");
