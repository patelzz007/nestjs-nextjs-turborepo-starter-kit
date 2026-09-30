import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { buildManifestTableToProfileMap, collectRlsEnabledTableNames, computeRlsManifestDrift, listAllManifestTables, parsePrismaSchemaModels } from "./manifest-index";

const apiDir = resolve(import.meta.dirname, "..", "..");
const schemaFile = resolve(apiDir, "prisma", "schema.prisma");
const rlsBundleFile = resolve(apiDir, "prisma", "rls.sql");

describe("RLS manifest index", () => {
	it("maps each manifest table to exactly one profile", () => {
		const map = buildManifestTableToProfileMap();
		const tables = listAllManifestTables();
		expect(map.size).toBe(tables.length);
	});

	it("has no drift against schema.prisma and rls.sql", () => {
		const schemaContent = readFileSync(schemaFile, "utf8");
		const rlsSqlContent = readFileSync(rlsBundleFile, "utf8");

		const prismaModels = parsePrismaSchemaModels(schemaContent);
		const report = computeRlsManifestDrift({
			prismaModels,
			manifestTables: listAllManifestTables(),
			rlsEnabledTables: collectRlsEnabledTableNames(rlsSqlContent),
		});

		expect(report.missingFromManifest).toEqual([]);
		expect(report.unknownManifestTables).toEqual([]);
		expect(report.orgModelsMissingManifest).toEqual([]);
		expect(report.locationProfileMismatch).toEqual([]);
	});
});
