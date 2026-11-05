import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { RECORD_RETENTION_DAYS } from "../../../src/platform/domain/record-retention";
import { AUDIT_RECORD_RETENTION_OPERATION } from "../../../src/contexts/audit/application/ports/audit-retention.port";
import { SystemOperationNameSchema } from "../../../src/platform/application/system-operation-names";

const SQL = readFileSync(join(import.meta.dirname, "..", "70-audit-retention.sql"), "utf8");

describe("70-audit-retention.sql", () => {
	it("enforces the same retention as the application (RECORD_RETENTION_DAYS) inside the database", () => {
		const days = /retention_days CONSTANT integer := (?<days>\d+);/u.exec(SQL)?.groups?.days;
		expect(Number(days)).toBe(RECORD_RETENTION_DAYS);
	});

	it("insists on the registered retention operation", () => {
		expect(SQL).toContain(`IS DISTINCT FROM '${AUDIT_RECORD_RETENTION_OPERATION}'`);
		expect(SystemOperationNameSchema.options).toContain(AUDIT_RECORD_RETENTION_OPERATION);
	});
});
