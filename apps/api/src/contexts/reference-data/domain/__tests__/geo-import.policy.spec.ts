import type { JsonObject } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import {
	COUNTRY_CODE_MAX_LENGTH,
	GEO_NAME_MAX_LENGTH,
	geoImportNaturalKey,
	geoImportParentIds,
	geoNaturalKey,
	missingGeoImportParents,
	naturalKeyParentId,
	parseGeoImportRow,
	planGeoImport,
	splitGeoImportRows,
	validateGeoImport,
	type GeoImportRow,
	type NumberedImportRow,
	type ParsedImportRow,
} from "../policies/geo-import.policy";

/** The validated row, or a test failure naming the issues. */
function valid(parsed: ParsedImportRow): GeoImportRow {
	if (!parsed.ok) {
		throw new Error(`expected a valid row, got ${JSON.stringify(parsed.issues)}`);
	}
	return parsed.value;
}

function issueFields(parsed: ParsedImportRow): readonly (string | null)[] {
	return parsed.ok ? [] : parsed.issues.map((issue) => issue.field);
}

function numbered(entity: Parameters<typeof parseGeoImportRow>[0], rows: readonly JsonObject[]): NumberedImportRow[] {
	return splitGeoImportRows(entity, rows).valid;
}

describe("parseGeoImportRow — names", () => {
	it("strips HTML and trims before checking the length", () => {
		expect(valid(parseGeoImportRow("region", { name: "  <b>Asia</b> " })).row.name).toBe("Asia");
	});

	it.each<[string, string]>([
		["empty", ""],
		["whitespace only", "   "],
		["only tags", "<b></b>"],
	])("rejects a name that is %s", (_label, name) => {
		expect(issueFields(parseGeoImportRow("region", { name }))).toEqual(["name"]);
	});

	it(`accepts ${String(GEO_NAME_MAX_LENGTH)} characters and rejects one more`, () => {
		expect(parseGeoImportRow("country", { name: "a".repeat(GEO_NAME_MAX_LENGTH) }).ok).toBe(true);
		expect(issueFields(parseGeoImportRow("country", { name: "a".repeat(GEO_NAME_MAX_LENGTH + 1) }))).toEqual(["name"]);
	});

	it("measures the length after sanitising (tags do not count)", () => {
		expect(parseGeoImportRow("region", { name: `<b>${"a".repeat(GEO_NAME_MAX_LENGTH)}</b>` }).ok).toBe(true);
	});

	it.each<[string, JsonObject]>([
		["missing", {}],
		["a number", { name: 7 }],
		["null", { name: null }],
	])("rejects a name that is %s", (_label, row) => {
		expect(issueFields(parseGeoImportRow("region", row))).toEqual(["name"]);
	});

	it("keeps unknown columns (loose rows) without validating them", () => {
		expect(valid(parseGeoImportRow("region", { name: "Asia", wikiDataId: "Q48" })).row).toMatchObject({ name: "Asia", wikiDataId: "Q48" });
	});
});

describe("parseGeoImportRow — parents and codes", () => {
	it("requires a subregion's regionId", () => {
		expect(issueFields(parseGeoImportRow("subregion", { name: "South-Eastern Asia" }))).toEqual(["regionId"]);
		expect(valid(parseGeoImportRow("subregion", { name: "South-Eastern Asia", regionId: 3 }))).toEqual({
			entity: "subregion",
			row: { name: "South-Eastern Asia", regionId: 3 },
		});
	});

	it.each<[string, number | string]>([
		["negative", -1],
		["fractional", 1.5],
		["a string", "3"],
	])("rejects a parent id that is %s", (_label, regionId) => {
		expect(issueFields(parseGeoImportRow("subregion", { name: "X", regionId }))).toEqual(["regionId"]);
	});

	it("accepts parent id 0 (the smallest non-negative id)", () => {
		expect(parseGeoImportRow("subregion", { name: "X", regionId: 0 }).ok).toBe(true);
	});

	it("defaults a state's countryCode to empty and caps it at two characters", () => {
		expect(valid(parseGeoImportRow("state", { name: "Selangor", countryId: 132 })).row).toMatchObject({ countryCode: "" });
		expect(parseGeoImportRow("state", { name: "Selangor", countryId: 132, countryCode: "M".repeat(COUNTRY_CODE_MAX_LENGTH) }).ok).toBe(true);
		expect(issueFields(parseGeoImportRow("state", { name: "Selangor", countryId: 132, countryCode: "MYS" }))).toEqual(["countryCode"]);
	});

	it("requires a city's stateId and countryId, and defaults both codes", () => {
		expect(issueFields(parseGeoImportRow("city", { name: "Shah Alam" }))).toEqual(["stateId", "countryId"]);
		expect(valid(parseGeoImportRow("city", { name: "Shah Alam", stateId: 1, countryId: 2 })).row).toMatchObject({ stateCode: "", countryCode: "" });
	});

	it("rejects a city countryCode of three characters", () => {
		expect(issueFields(parseGeoImportRow("city", { name: "Shah Alam", stateId: 1, countryId: 2, countryCode: "MYS" }))).toEqual(["countryCode"]);
	});

	it("reports every problem of a row, each with its field", () => {
		expect(issueFields(parseGeoImportRow("city", { name: "", stateId: -1, countryId: 2 }))).toEqual(["name", "stateId"]);
	});
});

describe("natural keys", () => {
	it("is the bare name for regions and countries", () => {
		expect(geoImportNaturalKey(valid(parseGeoImportRow("region", { name: "Asia" })))).toBe("Asia");
		expect(geoImportNaturalKey(valid(parseGeoImportRow("country", { name: "Malaysia" })))).toBe("Malaysia");
	});

	it("is scoped by the parent for subregions (region), states (country) and cities (state)", () => {
		expect(geoImportNaturalKey(valid(parseGeoImportRow("subregion", { name: "SE Asia", regionId: 3 })))).toBe("3:SE Asia");
		expect(geoImportNaturalKey(valid(parseGeoImportRow("state", { name: "Selangor", countryId: 132 })))).toBe("132:Selangor");
		expect(geoImportNaturalKey(valid(parseGeoImportRow("city", { name: "Klang", stateId: 9, countryId: 132 })))).toBe("9:Klang");
	});

	it("matches the key built from a live row's columns", () => {
		const row = valid(parseGeoImportRow("city", { name: "Klang", stateId: 9, countryId: 132 }));
		expect(geoNaturalKey("city", "Klang", naturalKeyParentId(row))).toBe(geoImportNaturalKey(row));
		expect(geoNaturalKey("region", "Asia", null)).toBe("Asia");
	});

	it("never scopes a region or country by a parent id", () => {
		expect(geoNaturalKey("country", "Malaysia", 3)).toBe("Malaysia");
	});

	it("tells the same name under two parents apart", () => {
		expect(geoNaturalKey("state", "Victoria", 1)).not.toBe(geoNaturalKey("state", "Victoria", 2));
	});
});

describe("splitGeoImportRows", () => {
	it("numbers rows from 1 and reports each invalid row once, issues joined", () => {
		const { valid: rows, errors } = splitGeoImportRows("subregion", [{ name: "A", regionId: 1 }, { name: "" }, { name: "C", regionId: 2 }]);
		expect(rows.map((row) => row.rowNumber)).toEqual([1, 3]);
		expect(errors).toHaveLength(1);
		expect(errors.map((error) => error.row)).toEqual([2]);
		expect(errors.map((error) => error.message).join()).toMatch(/^name: .+; regionId: .+$/);
	});
});

describe("validateGeoImport", () => {
	it("is valid when every row is", () => {
		expect(validateGeoImport({ entity: "region", data: [{ name: "Asia" }, { name: "Europe" }] })).toEqual({ valid: true, totalRows: 2, validRows: 2, errors: [] });
	});

	it("lists one entry per issue with its row and field", () => {
		const result = validateGeoImport({ entity: "city", data: [{ name: "Klang", stateId: 1, countryId: 2 }, { name: "" }] });
		expect(result).toMatchObject({ valid: false, totalRows: 2, validRows: 1 });
		expect(result.errors.map((error) => [error.row, error.field])).toEqual([
			[2, "name"],
			[2, "stateId"],
			[2, "countryId"],
		]);
	});
});

describe("import parents", () => {
	const rows = [
		...numbered("city", [
			{ name: "Klang", stateId: 9, countryId: 132 },
			{ name: "Ghost", stateId: 404, countryId: 132 },
			{ name: "Lost", stateId: 9, countryId: 999 },
			{ name: "Gone", stateId: 404, countryId: 999 },
		]),
	];

	it("collects every parent id the rows reference, per table", () => {
		expect(geoImportParentIds(rows)).toEqual({ regionIds: new Set(), countryIds: new Set([132, 999]), stateIds: new Set([9, 404]) });
		expect(geoImportParentIds(numbered("subregion", [{ name: "A", regionId: 1 }]))).toEqual({ regionIds: new Set([1]), countryIds: new Set(), stateIds: new Set() });
		expect(geoImportParentIds(numbered("state", [{ name: "A", countryId: 5 }]))).toEqual({ regionIds: new Set(), countryIds: new Set([5]), stateIds: new Set() });
		expect(geoImportParentIds(numbered("region", [{ name: "A" }]))).toEqual({ regionIds: new Set(), countryIds: new Set(), stateIds: new Set() });
	});

	it("flags every row whose parent is not live; a city missing both reports its country", () => {
		const missing = missingGeoImportParents(rows, { regions: new Set(), countries: new Set([132]), states: new Set([9]) });
		expect([...missing.entries()]).toEqual([
			[2, "stateId 404 does not reference an existing state"],
			[3, "countryId 999 does not reference an existing country"],
			[4, "countryId 999 does not reference an existing country"],
		]);
	});

	it("flags subregions and states by their own parent", () => {
		const subregions = numbered("subregion", [{ name: "A", regionId: 1 }]);
		expect([...missingGeoImportParents(subregions, { regions: new Set(), countries: new Set(), states: new Set() }).values()]).toEqual([
			"regionId 1 does not reference an existing region",
		]);
		const states = numbered("state", [{ name: "A", countryId: 5 }]);
		expect(missingGeoImportParents(states, { regions: new Set(), countries: new Set([5]), states: new Set() }).size).toBe(0);
	});
});

describe("planGeoImport", () => {
	const NO_MISSING: ReadonlyMap<number, string> = new Map();
	const NO_KEYS: ReadonlyMap<string, number> = new Map();

	it("creates every valid row without upsert, duplicates included", () => {
		const plan = planGeoImport({
			valid: numbered("region", [{ name: "Asia" }, { name: "Asia" }]),
			invalid: [],
			missingParents: NO_MISSING,
			existingKeys: NO_KEYS,
			upsert: false,
		});
		expect(plan.toCreate).toHaveLength(2);
		expect(plan.result).toEqual({ created: 2, updated: 0, skipped: 0, errors: [] });
	});

	it("ignores existing keys without upsert", () => {
		const plan = planGeoImport({
			valid: numbered("region", [{ name: "Asia" }]),
			invalid: [],
			missingParents: NO_MISSING,
			existingKeys: new Map([["Asia", 1]]),
			upsert: false,
		});
		expect(plan.toTouch).toEqual([]);
		expect(plan.result.created).toBe(1);
	});

	it("with upsert, touches a matching live row instead of inserting it", () => {
		const plan = planGeoImport({
			valid: numbered("region", [{ name: "Asia" }, { name: "Europe" }]),
			invalid: [],
			missingParents: NO_MISSING,
			existingKeys: new Map([["Asia", 7]]),
			upsert: true,
		});
		expect(plan.toTouch).toEqual([7]);
		expect(plan.toCreate.map((row) => row.row.name)).toEqual(["Europe"]);
		expect(plan.result).toEqual({ created: 1, updated: 1, skipped: 0, errors: [] });
	});

	it("with upsert, a repeat of an earlier row of the same import counts as updated, not created", () => {
		const plan = planGeoImport({
			valid: numbered("region", [{ name: "Asia" }, { name: "Asia" }]),
			invalid: [],
			missingParents: NO_MISSING,
			existingKeys: NO_KEYS,
			upsert: true,
		});
		expect(plan.toCreate).toHaveLength(1);
		expect(plan.result).toMatchObject({ created: 1, updated: 1 });
	});

	it("matches by name within the parent: the same name under another parent is a new row", () => {
		const plan = planGeoImport({
			valid: numbered("state", [
				{ name: "Victoria", countryId: 1 },
				{ name: "Victoria", countryId: 2 },
			]),
			invalid: [],
			missingParents: NO_MISSING,
			existingKeys: new Map([["1:Victoria", 10]]),
			upsert: true,
		});
		expect(plan.toTouch).toEqual([10]);
		expect(plan.toCreate).toHaveLength(1);
	});

	it("skips rows with a missing parent and reports every error in row order", () => {
		const plan = planGeoImport({
			valid: numbered("subregion", [
				{ name: "A", regionId: 1 },
				{ name: "B", regionId: 2 },
				{ name: "C", regionId: 1 },
			]),
			invalid: [{ row: 2, message: "late validation error" }],
			missingParents: new Map([
				[3, "regionId 1 does not reference an existing region"],
				[1, "regionId 1 does not reference an existing region"],
			]),
			existingKeys: NO_KEYS,
			upsert: false,
		});
		expect(plan.result.errors.map((error) => error.row)).toEqual([1, 2, 3]);
		expect(plan.result).toMatchObject({ created: 1, updated: 0, skipped: 3 });
	});

	it("never counts a skipped row as seen: its duplicate later in the import is still created", () => {
		const plan = planGeoImport({
			valid: numbered("subregion", [
				{ name: "A", regionId: 1 },
				{ name: "A", regionId: 1 },
			]),
			invalid: [],
			missingParents: new Map([[1, "missing"]]),
			existingKeys: NO_KEYS,
			upsert: true,
		});
		expect(plan.result).toMatchObject({ created: 1, updated: 0, skipped: 1 });
	});

	it("plans nothing for an import whose every row is invalid", () => {
		const { valid: rows, errors } = splitGeoImportRows("region", [{ name: "" }, {}]);
		const plan = planGeoImport({ valid: rows, invalid: errors, missingParents: NO_MISSING, existingKeys: NO_KEYS, upsert: true });
		expect(plan.toCreate).toEqual([]);
		expect(plan.toTouch).toEqual([]);
		expect(plan.result).toMatchObject({ created: 0, updated: 0, skipped: 2 });
	});
});
