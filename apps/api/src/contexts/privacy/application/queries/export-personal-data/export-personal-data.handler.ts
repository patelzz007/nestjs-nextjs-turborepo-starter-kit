import type { Readable } from "node:stream";

import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import { PERSONAL_DATA_EXPORT_CONTENT_TYPE, PERSONAL_DATA_EXPORT_FORMAT_VERSION, type PersonalDataManifest } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import { AuthorizationError } from "../../../../../platform/application/errors/app-error";
import { PersonalDataExportRegistry } from "../../../../../platform/application/personal-data/personal-data-export.registry";
import {
	PERSONAL_DATA_ARCHIVE,
	PERSONAL_DATA_EXPORT_AUDIT,
	type PersonalDataArchiveFile,
	type PersonalDataArchivePort,
	type PersonalDataExportAuditPort,
} from "../../ports/personal-data-export.ports";
import { ExportPersonalDataQuery } from "./export-personal-data.query";

/** The export as the controller streams it. */
export interface PersonalDataExport {
	readonly fileName: string;
	readonly contentType: string;
	readonly body: Readable;
}

/** `2026-11-03` from an instant, for the file name. */
function isoDate(instant: number): string {
	return new Date(instant).toISOString().slice(0, ISO_DATE_LENGTH);
}
const ISO_DATE_LENGTH = 10;

/**
 * Assembles "Download my data" from every registered exporter (each reads under the person's own RLS
 * context), records the audit row before anything is released, and hands back the ZIP stream. Only the
 * person themselves: a session impersonating them is refused, so support can't take someone's data that way.
 */
@QueryHandler(ExportPersonalDataQuery)
export class ExportPersonalDataHandler implements IQueryHandler<ExportPersonalDataQuery, PersonalDataExport> {
	public constructor(
		private readonly registry: PersonalDataExportRegistry,
		@Inject(PERSONAL_DATA_ARCHIVE) private readonly archive: PersonalDataArchivePort,
		@Inject(PERSONAL_DATA_EXPORT_AUDIT) private readonly audit: PersonalDataExportAuditPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute({ actor, request }: ExportPersonalDataQuery): Promise<PersonalDataExport> {
		if (actor.kind !== "user" || actor.impersonatorUserId !== null) {
			throw new AuthorizationError({ message: "Only the signed-in person can download their own data (never while impersonating)." });
		}
		const generatedAt = this.clock.now();
		const files: PersonalDataArchiveFile[] = [];
		const sections: PersonalDataManifest["sections"] = [];
		for (const exporter of this.registry.exporters()) {
			const content = await exporter.export({ actor, userId: actor.userId });
			const file = `${exporter.section}.json`;
			files.push({ file, data: content.data });
			sections.push({ name: exporter.section, file, description: exporter.description, records: content.records });
		}
		const manifest: PersonalDataManifest = {
			formatVersion: PERSONAL_DATA_EXPORT_FORMAT_VERSION,
			generatedAt,
			userId: actor.userId,
			sections,
		};
		await this.audit.recordExport(request, { export: "personal-data", sections: sections.map((section) => ({ name: section.name, records: section.records })) });
		return { fileName: `personal-data-${isoDate(generatedAt)}.zip`, contentType: PERSONAL_DATA_EXPORT_CONTENT_TYPE, body: this.archive.archive(manifest, files) };
	}
}
