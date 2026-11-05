import { Injectable } from "@nestjs/common";
import { PersonalDataSectionNameSchema, type JsonValue, type PersonalDataSectionName } from "@workspace/shared";

import type { ActorContext } from "../actor-context";

/** What one section of a person's export holds: its rows (as API-shaped JSON) and how many records they are. */
export interface PersonalDataSectionContent {
	readonly records: number;
	readonly data: JsonValue;
}

/** Whose data an export is: the signed-in person (checked by the privacy context before any exporter runs). */
export interface PersonalDataSubject {
	/** Their own actor: exporters read under its RLS context. */
	readonly actor: ActorContext;
	readonly userId: string;
}

/**
 * One context's part of "Download my data" (ADR 077). It reads **under the person's own RLS context**, so an
 * export can only ever contain what that person may read, and it never includes secrets (password hashes,
 * 2FA secrets, push tokens, session tokens), only the facts about them.
 */
export interface PersonalDataExporter {
	/** The section's name, also its file in the ZIP (`<name>.json`). */
	readonly section: PersonalDataSectionName;
	/** One line a person can read: what the section holds. */
	readonly description: string;
	export(subject: PersonalDataSubject): Promise<PersonalDataSectionContent>;
}

/**
 * Every context registers its exporter here from its module's `onModuleInit` (the registry pattern of
 * `FileCategoryAccessRegistry`), so the privacy context assembles an export without importing any context.
 */
@Injectable()
export class PersonalDataExportRegistry {
	private readonly bySection = new Map<PersonalDataSectionName, PersonalDataExporter>();

	public register(exporter: PersonalDataExporter): void {
		const section = PersonalDataSectionNameSchema.parse(exporter.section);
		if (this.bySection.has(section)) {
			throw new Error(`Two exporters claim the personal-data section "${section}"`);
		}
		this.bySection.set(section, exporter);
	}

	/** Every registered exporter, by section name (a stable order for the ZIP and the manifest). */
	public exporters(): readonly PersonalDataExporter[] {
		return [...this.bySection.values()].sort((left, right) => left.section.localeCompare(right.section));
	}
}
