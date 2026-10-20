import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const CONTEXTS_DIR: string = fileURLToPath(new URL("../contexts", import.meta.url));

/** A repository read goes through a transaction. `this.prisma.` is a bare client (MT-31). */
const BARE_CLIENT = "this.prisma.";

function infrastructureSources(directory: string): readonly string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry): readonly string[] => {
		const entryPath = join(directory, entry.name);
		if (entry.isDirectory()) {
			return entry.name === "__tests__" ? [] : infrastructureSources(entryPath);
		}
		if (!entry.name.endsWith(".ts") || entry.name.endsWith(".spec.ts")) {
			return [];
		}
		const relativePath = relative(CONTEXTS_DIR, entryPath);
		return relativePath.split("/").includes("infrastructure") ? [relativePath] : [];
	});
}

describe("repository reads", () => {
	it("does not call the bare Prisma client from context infrastructure", () => {
		const offenders = infrastructureSources(CONTEXTS_DIR).flatMap((file): readonly string[] => {
			const text = readFileSync(join(CONTEXTS_DIR, file), "utf8");
			return text.includes(BARE_CLIENT) ? [file] : [];
		});

		expect(offenders).toEqual([]);
	});
});
