import { describe, expect, it } from "vitest";

import { AUDIT_RECORD_RETENTION_OPERATION } from "../../../src/contexts/audit/application/ports/audit-retention.port";
import { SystemOperationNameSchema } from "../../../src/platform/application/system-operation-names";
import { RECORD_RETENTION_DAYS } from "../../../src/platform/domain/record-retention";
import { AUDIT_RETENTION_FUNCTIONS } from "../generator/functions/audit-retention";

const SQL = AUDIT_RETENTION_FUNCTIONS.map((fn) => fn.definition).join("\n");

describe("the audit retention function (generator/functions/audit-retention.ts)", () => {
	it("enforces the same retention as the application (RECORD_RETENTION_DAYS) inside the database", () => {
		const days = /retention_days CONSTANT integer := (?<days>\d+);/u.exec(SQL)?.groups?.days;
		expect(Number(days)).toBe(RECORD_RETENTION_DAYS);
	});

	it("insists on the registered retention operation", () => {
		expect(SQL).toContain(`IS DISTINCT FROM '${AUDIT_RECORD_RETENTION_OPERATION}'`);
		expect(SystemOperationNameSchema.options).toContain(AUDIT_RECORD_RETENTION_OPERATION);
	});

	it("runs with app_retention's rights, and only roles granted EXECUTE may call it", () => {
		expect(AUDIT_RETENTION_FUNCTIONS.map((fn) => [fn.owner, fn.revokeFromPublic])).toStrictEqual([["app_retention", true]]);
	});
});
