import { Readable } from "node:stream";

import type { PersonalDataManifest } from "@workspace/shared";

import { zipArchiveStream } from "../../../../platform/infrastructure/storage/utils/zip-archive.util";
import type { PersonalDataArchiveFile, PersonalDataArchivePort } from "../../application/ports/personal-data-export.ports";

/** Two-space JSON: the export is for people to read as well as machines. */
const JSON_INDENT = 2;

/** The export as one streamed ZIP (`manifest.json`, then each section), through the platform zip stream (fflate). */
export class ZipPersonalDataArchiveAdapter implements PersonalDataArchivePort {
	public archive(manifest: PersonalDataManifest, files: readonly PersonalDataArchiveFile[]): Readable {
		const modifiedAt = manifest.generatedAt;
		const entries = [{ file: "manifest.json", data: manifest }, ...files].map((entry) => ({
			name: entry.file,
			modifiedAt,
			open: (): Promise<Readable> => Promise.resolve(Readable.from([Buffer.from(`${JSON.stringify(entry.data, null, JSON_INDENT)}\n`, "utf8")])),
		}));
		return zipArchiveStream(entries);
	}
}
