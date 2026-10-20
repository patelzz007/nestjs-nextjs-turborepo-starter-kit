import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { SystemOperationNameSchema } from "../platform/application/system-operation-names";

const SRC_DIR: string = fileURLToPath(new URL("..", import.meta.url));

/** The files that define the names themselves: the closed list and the registry of their tables. */
const DEFINITION_FILES: readonly string[] = ["platform/application/system-operation-names.ts", "prisma/system-operation.registry.ts"];

function sourceFiles(directory: string): readonly string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry): readonly string[] => {
		const entryPath = join(directory, entry.name);
		if (entry.isDirectory()) {
			return entry.name === "__tests__" ? [] : sourceFiles(entryPath);
		}
		return entry.name.endsWith(".ts") ? [entryPath] : [];
	});
}

/**
 * A system operation name is written as a string in at most ONE place outside its definition: a
 * named constant (a context's tokens file, or the platform list for a cross-context operation) that
 * the route decorator and every adapter running under it import. Two copies can drift — a route
 * renamed to one operation while its queries still run under another.
 */
describe("system operation names have a single source", () => {
	const files = sourceFiles(SRC_DIR)
		.map((path) => ({ path: relative(SRC_DIR, path), text: readFileSync(path, "utf8") }))
		.filter(({ path }) => !DEFINITION_FILES.includes(path));

	it.each(SystemOperationNameSchema.options)("%s is written in at most one file", (operation) => {
		const writers = files.filter(({ text }) => text.includes(`"${operation}"`)).map(({ path }) => path);

		expect(writers.length, `"${operation}" is written in: ${writers.join(", ")} — import one named constant instead`).toBeLessThanOrEqual(1);
	});
});
