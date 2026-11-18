import { describe, expect, it } from "vitest";

import { settings } from "../../shared/settings.ts";
import { stagedFilesNote, touchesSecuritySql } from "../pre-commit.ts";

const INPUTS = ["db/security/", "db/schema.prisma"];

describe("touchesSecuritySql", () => {
	it("runs the security check when a staged file is in an input folder or is an input file", () => {
		expect(touchesSecuritySql("db/security/table-policies.ts\n", INPUTS)).toBe(true);
		expect(touchesSecuritySql("README.md\ndb/schema.prisma\n", INPUTS)).toBe(true);
	});

	it("skips it for every other change, including a file that only starts with an input file's name", () => {
		expect(touchesSecuritySql("web/page.tsx\ndb/schema.prisma.bak\ndb/securityx.ts\n", INPUTS)).toBe(false);
		expect(touchesSecuritySql("", INPUTS)).toBe(false);
	});

	it("covers this repository's security declarations, schema and generated SQL", () => {
		const { inputs } = settings.securitySql;
		expect(touchesSecuritySql("apps/api/prisma/security/table-policies.ts\n", inputs)).toBe(true);
		expect(touchesSecuritySql("apps/api/prisma/rls/04-policies.sql\n", inputs)).toBe(true);
		expect(touchesSecuritySql("apps/api/prisma/schema.prisma\n", inputs)).toBe(true);
		expect(touchesSecuritySql("packages/shared/src/authorization/permission.ts\n", inputs)).toBe(true);
		expect(touchesSecuritySql("apps/api/src/prisma/system-operation.registry.ts\n", inputs)).toBe(true);
		expect(touchesSecuritySql("apps/web/app/page.tsx\n", inputs)).toBe(false);
	});
});

describe("stagedFilesNote", () => {
	it("counts the staged files git lists", () => {
		expect(stagedFilesNote("a.ts\nb.ts\n")).toBe("2 staged files");
		expect(stagedFilesNote("a.ts\n")).toBe("1 staged file");
		expect(stagedFilesNote("")).toBe("0 staged files");
	});
});
