import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * `pnpm db:generate` runs `db.ts schema` before `prisma generate`, so loading scripts/db.ts must not
 * need a generated Prisma client: after a fresh install (or one that re-created @prisma/client in a
 * new store folder) there is none yet, and a static import of it made the generator unable to run.
 */
const DB_CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "db.ts");

/** Every static `import … from "<module>"` of the file, type-only imports excluded (erased at runtime). */
function staticValueImports(source: string): readonly string[] {
	const imports: string[] = [];
	const pattern = /^import (?<kind>type )?[^;]*? from "(?<module>[^"]+)";$/gmu;
	for (let match = pattern.exec(source); match !== null; match = pattern.exec(source)) {
		const { kind, module } = match.groups ?? {};
		if (kind === undefined && module !== undefined) {
			imports.push(module);
		}
	}
	return imports;
}

describe("scripts/db.ts", () => {
	it("loads without a generated Prisma client: only the commands that read it import it", () => {
		const imports = staticValueImports(readFileSync(DB_CLI, "utf8"));

		expect(imports).toContain("../prisma/engine/schema-engine");
		expect(imports).not.toContain("@prisma/client");
		expect(imports).not.toContain("../src/prisma/system-operation.registry");
	});
});
