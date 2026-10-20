import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const SRC_DIR: string = fileURLToPath(new URL("..", import.meta.url));

/** Mode is parsed in config and bound in the tenancy infrastructure. Nowhere else branches on it. */
const ALLOWED_PREFIXES: readonly string[] = ["config/", "platform/infrastructure/tenancy/"];

/**
 * Every way code could ask which mode it is in: the variable, the type, the config field, a mode
 * predicate, or the default tenant itself (only the single-mode tenant source may read it).
 */
const MARKERS: readonly string[] = [
	"TENANCY_ENABLED",
	"TenancyMode",
	"tenancy.mode",
	"tenancy.defaultTenantId",
	"isSingleTenantMode",
	"isMultiTenantMode",
	"defaultTenantId(",
];

function sourceFiles(directory: string): readonly string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry): readonly string[] => {
		const entryPath = join(directory, entry.name);
		if (entry.isDirectory()) {
			return entry.name === "__tests__" ? [] : sourceFiles(entryPath);
		}
		if (!entry.name.endsWith(".ts") || entry.name.endsWith(".spec.ts")) {
			return [];
		}
		return [relative(SRC_DIR, entryPath)];
	});
}

describe("tenancy mode boundary", () => {
	it("keeps every mode check and the default tenant inside config and the tenancy sources", () => {
		const offenders = sourceFiles(SRC_DIR).flatMap((file): readonly string[] => {
			if (ALLOWED_PREFIXES.some((prefix) => file.startsWith(prefix))) {
				return [];
			}
			const text = readFileSync(join(SRC_DIR, file), "utf8");
			return MARKERS.filter((marker) => text.includes(marker)).map((marker) => `${file} contains ${marker}`);
		});

		expect(offenders).toEqual([]);
	});
});
