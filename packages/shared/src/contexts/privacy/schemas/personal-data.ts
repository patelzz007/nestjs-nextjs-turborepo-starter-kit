import { z } from "zod";

import { EpochMsSchema } from "../../../schemas/api/common";

/** The personal-data export is one ZIP: a `manifest.json` and one JSON file per section (ADR 077). */
export const PERSONAL_DATA_EXPORT_CONTENT_TYPE = "application/zip";

/** A section's name: also its file name in the ZIP (`<name>.json`). */
export const PersonalDataSectionNameSchema = z.string().regex(/^[a-z]+(?:-[a-z]+)*$/u);
export type PersonalDataSectionName = z.output<typeof PersonalDataSectionNameSchema>;

/** The manifest's format version: bumped when a section's shape changes incompatibly. */
export const PERSONAL_DATA_EXPORT_FORMAT_VERSION = 1;

/** `manifest.json`: when the export was made, for whom, and what each section holds. */
export const PersonalDataManifestSchema = z.object({
	formatVersion: z.literal(PERSONAL_DATA_EXPORT_FORMAT_VERSION),
	/** Epoch milliseconds, like every timestamp of the API. */
	generatedAt: EpochMsSchema,
	userId: z.string(),
	sections: z.array(z.object({ name: PersonalDataSectionNameSchema, file: z.string(), description: z.string(), records: z.number().int().nonnegative() })),
});
export type PersonalDataManifest = z.output<typeof PersonalDataManifestSchema>;
