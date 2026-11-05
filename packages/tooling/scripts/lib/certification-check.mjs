/**
 * The checker behind `pnpm certify:check` (enhancement 7.6, docs/technical/certification-exercise.md): whether a
 * field was added to the sample category in every layer. Pure: it gets the files' contents and answers which
 * layers are done, so it is unit-tested without a repository.
 */

/** The files a correct solution touches (relative to the repository root). */
export const CERTIFICATION_FILES = {
	contract: "packages/shared/src/contexts/catalog/schemas/sample-category.ts",
	schema: "apps/api/prisma/schema.prisma",
	seed: "apps/api/prisma/seed/platform-records.ts",
};

/** A field name: camelCase, starting with a letter. */
const FIELD = /^[a-z][a-zA-Z0-9]*$/u;

/** The `model SampleCategory { … }` block of a Prisma schema, or "" when there is none. */
function sampleCategoryModel(schema) {
	const start = schema.indexOf("model SampleCategory {");
	if (start === -1) {
		return "";
	}
	const end = schema.indexOf("\n}", start);
	return schema.slice(start, end === -1 ? undefined : end);
}

/**
 * Each layer and whether it is done.
 *
 * @param {string} field
 * @param {{ contract: string, schema: string, seed: string, migrations: readonly string[], tests: readonly string[], adminSources: readonly string[] }} sources
 *   `migrations`: every migration's SQL; `tests`: every test file's source; `adminSources`: the admin catalog files.
 * @returns {readonly { layer: string, done: boolean, hint: string }[]}
 */
export function certificationLayers(field, sources) {
	if (!FIELD.test(field)) {
		throw new Error(`--field must be a camelCase name (got "${field}")`);
	}
	const column = new RegExp(`"${field}"`, "u");
	const word = new RegExp(`\\b${field}\\b`, "u");
	const model = sampleCategoryModel(sources.schema);
	return [
		{ layer: "Contract", done: word.test(sources.contract), hint: `add ${field} to the sample category schemas (${CERTIFICATION_FILES.contract})` },
		{ layer: "Database", done: new RegExp(`^\\s+${field}\\s`, "mu").test(model), hint: `add ${field} to model SampleCategory in schema.prisma` },
		{
			layer: "Migration",
			done: sources.migrations.some((sql) => /"SampleCategory"/u.test(sql) && column.test(sql)),
			hint: "generate the migration: pnpm --filter @workspace/api db:migrate:create",
		},
		{ layer: "Seed", done: word.test(sources.seed), hint: `give at least one seeded category a ${field} (${CERTIFICATION_FILES.seed})` },
		{ layer: "Admin", done: sources.adminSources.some((source) => word.test(source)), hint: `show and edit ${field} in the admin catalog (apps/admin/contexts/catalog)` },
		{
			layer: "Tests",
			done: sources.tests.some((source) => word.test(source)),
			hint: `test ${field} in the schema, the API and the form (in __tests__/ folders and apps/api/test)`,
		},
	];
}
