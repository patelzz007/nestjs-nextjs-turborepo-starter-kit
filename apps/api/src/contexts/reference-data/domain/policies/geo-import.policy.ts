// ── Geo bulk import: the rules, with no database ───────────────────────────
// An import payload is untrusted JSON. Every row is validated with its
// entity's zod contract, its parents must be live rows, and with `upsert` a row
// that matches a live row (or an earlier row of the same import) by its natural
// key — the name within its parent — updates instead of inserting. The
// application service loads what these rules need (live parent ids, live
// natural keys) inside the import transaction and applies the plan they return.

import { isStringPrimitive, type GeoImportResult, type GeoImportValidateInput, type GeoImportValidationResult, type JsonObject } from "@workspace/shared";
import { z } from "zod";

import type { GeoEntityKind } from "../value-objects/geo-entity-kind.value-object";
import { sanitizeGeoName } from "./geo-name.policy";

/** Longest geo name the columns accept (`VarChar(255)`). */
export const GEO_NAME_MAX_LENGTH = 255;
/** ISO 3166-1 alpha-2 country codes are two characters (`VarChar(2)`). */
export const COUNTRY_CODE_MAX_LENGTH = 2;
/** City state codes (`VarChar(255)`). */
export const STATE_CODE_MAX_LENGTH = 255;
/** Row numbers in import reports are 1-based (the first row of `data` is row 1). */
const FIRST_ROW_NUMBER = 1;

const ImportNameSchema = z.string().transform(sanitizeGeoName).pipe(z.string().min(1).max(GEO_NAME_MAX_LENGTH));
const ImportIdSchema = z.number().int().nonnegative();

const RegionImportRowSchema = z.looseObject({ name: ImportNameSchema });
const SubregionImportRowSchema = z.looseObject({ name: ImportNameSchema, regionId: ImportIdSchema });
const CountryImportRowSchema = z.looseObject({ name: ImportNameSchema });
const StateImportRowSchema = z.looseObject({
	name: ImportNameSchema,
	countryId: ImportIdSchema,
	countryCode: z.string().max(COUNTRY_CODE_MAX_LENGTH).default(""),
});
const CityImportRowSchema = z.looseObject({
	name: ImportNameSchema,
	stateId: ImportIdSchema,
	countryId: ImportIdSchema,
	stateCode: z.string().max(STATE_CODE_MAX_LENGTH).default(""),
	countryCode: z.string().max(COUNTRY_CODE_MAX_LENGTH).default(""),
});

/** One validated import row, discriminated by entity. */
export type GeoImportRow =
	| { readonly entity: "region"; readonly row: z.output<typeof RegionImportRowSchema> }
	| { readonly entity: "subregion"; readonly row: z.output<typeof SubregionImportRowSchema> }
	| { readonly entity: "country"; readonly row: z.output<typeof CountryImportRowSchema> }
	| { readonly entity: "state"; readonly row: z.output<typeof StateImportRowSchema> }
	| { readonly entity: "city"; readonly row: z.output<typeof CityImportRowSchema> };

/** A row-level validation problem (the offending field, when the issue names one). */
export interface GeoRowIssue {
	readonly field: string | null;
	readonly message: string;
}

export type ParsedImportRow = { readonly ok: true; readonly value: GeoImportRow } | { readonly ok: false; readonly issues: readonly GeoRowIssue[] };

/** A valid row and its 1-based position in the payload. */
export interface NumberedImportRow {
	readonly rowNumber: number;
	readonly value: GeoImportRow;
}

/** One reported import error (1-based row). */
export type GeoImportRowError = GeoImportResult["errors"][number];

function issuesOf(error: z.ZodError): GeoRowIssue[] {
	return error.issues.map((issue): GeoRowIssue => {
		const [first] = issue.path;
		return { field: isStringPrimitive(first) ? first : null, message: issue.message };
	});
}

function toParsedRow<TRow>(result: z.ZodSafeParseResult<TRow>, toValue: (row: TRow) => GeoImportRow): ParsedImportRow {
	return result.success ? { ok: true, value: toValue(result.data) } : { ok: false, issues: issuesOf(result.error) };
}

function assertNever(value: never): never {
	throw new Error(`Unhandled geo import entity: ${JSON.stringify(value)}`);
}

/** Validates one raw row against its entity's contract. */
export function parseGeoImportRow(entity: GeoEntityKind, row: JsonObject): ParsedImportRow {
	switch (entity) {
		case "region":
			return toParsedRow(RegionImportRowSchema.safeParse(row), (parsed) => ({ entity: "region", row: parsed }));
		case "subregion":
			return toParsedRow(SubregionImportRowSchema.safeParse(row), (parsed) => ({ entity: "subregion", row: parsed }));
		case "country":
			return toParsedRow(CountryImportRowSchema.safeParse(row), (parsed) => ({ entity: "country", row: parsed }));
		case "state":
			return toParsedRow(StateImportRowSchema.safeParse(row), (parsed) => ({ entity: "state", row: parsed }));
		case "city":
			return toParsedRow(CityImportRowSchema.safeParse(row), (parsed) => ({ entity: "city", row: parsed }));
		default:
			return assertNever(entity);
	}
}

/**
 * The natural key a row is matched on for `upsert`: its name within its
 * parent. Regions and countries have no parent in the key (`parentId` null).
 */
export function geoNaturalKey(entity: GeoEntityKind, name: string, parentId: number | null): string {
	if (entity === "region" || entity === "country" || parentId === null) {
		return name;
	}
	return `${String(parentId)}:${name}`;
}

/** The parent id that scopes a row's natural key (subregion → region, state → country, city → state). */
export function naturalKeyParentId(row: GeoImportRow): number | null {
	switch (row.entity) {
		case "region":
		case "country":
			return null;
		case "subregion":
			return row.row.regionId;
		case "state":
			return row.row.countryId;
		case "city":
			return row.row.stateId;
		default:
			return assertNever(row);
	}
}

/** The natural key of a validated import row. */
export function geoImportNaturalKey(row: GeoImportRow): string {
	return geoNaturalKey(row.entity, row.row.name, naturalKeyParentId(row));
}

function issueMessage(issues: readonly GeoRowIssue[]): string {
	return issues.map((issue): string => (issue.field === null ? issue.message : `${issue.field}: ${issue.message}`)).join("; ");
}

/** Every row of `data` either validated (numbered) or reported as an error (one message per row). */
export function splitGeoImportRows(entity: GeoEntityKind, data: readonly JsonObject[]): { readonly valid: NumberedImportRow[]; readonly errors: GeoImportRowError[] } {
	const valid: NumberedImportRow[] = [];
	const errors: GeoImportRowError[] = [];
	data.forEach((raw: JsonObject, index: number): void => {
		const rowNumber = index + FIRST_ROW_NUMBER;
		const parsed = parseGeoImportRow(entity, raw);
		if (parsed.ok) {
			valid.push({ rowNumber, value: parsed.value });
		} else {
			errors.push({ row: rowNumber, message: issueMessage(parsed.issues) });
		}
	});
	return { valid, errors };
}

/** Dry run of an import: every issue of every row (one entry per issue), nothing written. */
export function validateGeoImport(input: GeoImportValidateInput): GeoImportValidationResult {
	const errors: GeoImportValidationResult["errors"] = [];
	let validRows = 0;
	input.data.forEach((raw: JsonObject, index: number): void => {
		const parsed = parseGeoImportRow(input.entity, raw);
		if (parsed.ok) {
			validRows += 1;
			return;
		}
		errors.push(...parsed.issues.map((issue) => ({ row: index + FIRST_ROW_NUMBER, field: issue.field, message: issue.message })));
	});
	return { valid: errors.length === 0, totalRows: input.data.length, validRows, errors };
}

/** The parent ids an import's valid rows reference, per parent table. */
export interface GeoImportParentIds {
	readonly regionIds: ReadonlySet<number>;
	readonly countryIds: ReadonlySet<number>;
	readonly stateIds: ReadonlySet<number>;
}

/** Which of those parent ids are live rows. */
export interface LiveGeoImportParents {
	readonly regions: ReadonlySet<number>;
	readonly countries: ReadonlySet<number>;
	readonly states: ReadonlySet<number>;
}

export function geoImportParentIds(rows: readonly NumberedImportRow[]): GeoImportParentIds {
	const regionIds = new Set<number>();
	const countryIds = new Set<number>();
	const stateIds = new Set<number>();
	for (const { value } of rows) {
		if (value.entity === "subregion") regionIds.add(value.row.regionId);
		if (value.entity === "state") countryIds.add(value.row.countryId);
		if (value.entity === "city") {
			stateIds.add(value.row.stateId);
			countryIds.add(value.row.countryId);
		}
	}
	return { regionIds, countryIds, stateIds };
}

/** Row number → error for every valid row whose parent ids do not reference live rows (a city missing both reports its country). */
export function missingGeoImportParents(rows: readonly NumberedImportRow[], live: LiveGeoImportParents): ReadonlyMap<number, string> {
	const missing = new Map<number, string>();
	for (const { rowNumber, value } of rows) {
		if (value.entity === "subregion" && !live.regions.has(value.row.regionId)) {
			missing.set(rowNumber, `regionId ${String(value.row.regionId)} does not reference an existing region`);
		}
		if (value.entity === "state" && !live.countries.has(value.row.countryId)) {
			missing.set(rowNumber, `countryId ${String(value.row.countryId)} does not reference an existing country`);
		}
		if (value.entity === "city" && !live.states.has(value.row.stateId)) {
			missing.set(rowNumber, `stateId ${String(value.row.stateId)} does not reference an existing state`);
		}
		if (value.entity === "city" && !live.countries.has(value.row.countryId)) {
			missing.set(rowNumber, `countryId ${String(value.row.countryId)} does not reference an existing country`);
		}
	}
	return missing;
}

/** Everything an import plan is decided from. */
export interface GeoImportPlanInput {
	readonly valid: readonly NumberedImportRow[];
	/** Rows already rejected by validation. */
	readonly invalid: readonly GeoImportRowError[];
	readonly missingParents: ReadonlyMap<number, string>;
	/** Natural key → id of the live rows (empty without `upsert`). */
	readonly existingKeys: ReadonlyMap<string, number>;
	readonly upsert: boolean;
}

/** What an import writes, and what it reports. */
export interface GeoImportPlan {
	readonly toCreate: readonly GeoImportRow[];
	/** Live rows an `upsert` matched: their `updatedAt` is stamped (the import carries no other column to change). */
	readonly toTouch: readonly number[];
	readonly result: GeoImportResult;
}

/**
 * Decides every valid row: a missing parent is an error (skipped); with
 * `upsert`, a row matching a live row or an earlier row of this import by its
 * natural key counts as `updated`; every other row is created. Errors are
 * reported in row order.
 */
export function planGeoImport(input: GeoImportPlanInput): GeoImportPlan {
	const errors: GeoImportRowError[] = [...input.invalid];
	const toCreate: GeoImportRow[] = [];
	const toTouch: number[] = [];
	const seenInImport = new Set<string>();
	let updated = 0;
	for (const { rowNumber, value } of input.valid) {
		const parentError: string | undefined = input.missingParents.get(rowNumber);
		if (parentError !== undefined) {
			errors.push({ row: rowNumber, message: parentError });
			continue;
		}
		const key: string = geoImportNaturalKey(value);
		const existingId: number | undefined = input.existingKeys.get(key);
		if (input.upsert && existingId !== undefined) {
			toTouch.push(existingId);
			updated += 1;
			continue;
		}
		if (input.upsert && seenInImport.has(key)) {
			updated += 1;
			continue;
		}
		seenInImport.add(key);
		toCreate.push(value);
	}
	errors.sort((left, right): number => left.row - right.row);
	return { toCreate, toTouch, result: { created: toCreate.length, updated, skipped: errors.length, errors } };
}
