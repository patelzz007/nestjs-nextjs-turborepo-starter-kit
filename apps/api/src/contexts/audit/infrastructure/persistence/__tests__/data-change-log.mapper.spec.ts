import type { DataChangeLog } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { toAuditLogReferences, type AuditLogReferences } from "../audit-references";
import { dataChangeLogReferenceIds, toDataChangeLogDetail, toDataChangeLogSummary } from "../data-change-log.mapper";
import { LIVE_ROW_FIELDS } from "../../../../../platform/infrastructure/persistence/__tests__/base-row-fields";

const OCCURRED_AT = 1_790_812_800_000;
const RECORD_ID = "55555555-5555-4555-8555-555555555555";
const ACTOR_ID = "11111111-1111-4111-8111-111111111111";
const ORGANIZATION_ID = "33333333-3333-4333-8333-333333333333";
const UNKNOWN_USER_ID = "44444444-4444-4444-8444-444444444444";

function changeRow(overrides: Partial<DataChangeLog> = {}): DataChangeLog {
	return {
		...LIVE_ROW_FIELDS,
		id: RECORD_ID,
		changeSequence: BigInt(42),
		occurredAt: BigInt(OCCURRED_AT),
		updatedAt: BigInt(OCCURRED_AT),
		transactionId: BigInt(9_001),
		tableName: "User",
		operation: "UPDATE",
		rowId: ACTOR_ID,
		changedColumns: ["fullName", "passwordHash"],
		oldData: { id: ACTOR_ID, fullName: "[PII]", passwordHash: "[REDACTED]" },
		newData: { id: ACTOR_ID, fullName: "[PII]", passwordHash: "[REDACTED]" },
		actorKind: "USER",
		actorUserId: ACTOR_ID,
		organizationId: ORGANIZATION_ID,
		apiKeyId: null,
		systemOperation: null,
		actorPurpose: "profile update",
		correlationId: "corr-1",
		databaseRole: "app_runtime",
		loginRole: "api",
		applicationName: null,
		clientAddress: "10.0.0.12",
		createdAt: BigInt(OCCURRED_AT + 1),
		...overrides,
	};
}

const REFERENCES: AuditLogReferences = toAuditLogReferences(
	[{ id: ACTOR_ID, email: "user@example.com", fullName: "Demo Customer" }],
	[{ id: ORGANIZATION_ID, displayName: "Kopi Corner" }],
);

describe("dataChangeLogReferenceIds", () => {
	it("collects each distinct non-null actor and organization id once", () => {
		const rows = [changeRow(), changeRow(), changeRow({ actorUserId: null, organizationId: null })];

		expect(dataChangeLogReferenceIds(rows)).toEqual({ userIds: [ACTOR_ID], organizationIds: [ORGANIZATION_ID] });
	});
});

describe("toDataChangeLogSummary", () => {
	it("maps bigints to numbers and resolves the actor and organization names", () => {
		expect(toDataChangeLogSummary(changeRow(), REFERENCES)).toEqual({
			id: RECORD_ID,
			changeSequence: 42,
			occurredAt: OCCURRED_AT,
			transactionId: 9_001,
			tableName: "User",
			operation: "UPDATE",
			rowId: ACTOR_ID,
			changedColumns: ["fullName", "passwordHash"],
			actorKind: "USER",
			actor: { id: ACTOR_ID, email: "user@example.com", fullName: "Demo Customer" },
			organization: { id: ORGANIZATION_ID, name: "Kopi Corner" },
			apiKeyId: null,
			systemOperation: null,
			correlationId: "corr-1",
			databaseRole: "app_runtime",
		});
	});

	it("keeps an actor id that no longer resolves, and an unattributed change has no actor at all", () => {
		expect(toDataChangeLogSummary(changeRow({ actorUserId: UNKNOWN_USER_ID }), REFERENCES).actor).toEqual({ id: UNKNOWN_USER_ID, email: null, fullName: null });
		expect(toDataChangeLogSummary(changeRow({ actorKind: "UNATTRIBUTED", actorUserId: null, organizationId: null }), REFERENCES)).toMatchObject({
			actor: null,
			organization: null,
		});
	});

	it("maps a TRUNCATE, which has no row id", () => {
		expect(toDataChangeLogSummary(changeRow({ operation: "TRUNCATE", rowId: null, changedColumns: [] }), REFERENCES)).toMatchObject({ operation: "TRUNCATE", rowId: null });
	});
});

describe("toDataChangeLogDetail", () => {
	it("adds the stored (already redacted) row images and the connection facts", () => {
		expect(toDataChangeLogDetail(changeRow(), REFERENCES)).toMatchObject({
			oldData: { id: ACTOR_ID, fullName: "[PII]", passwordHash: "[REDACTED]" },
			newData: { id: ACTOR_ID, fullName: "[PII]", passwordHash: "[REDACTED]" },
			actorPurpose: "profile update",
			loginRole: "api",
			applicationName: null,
			clientAddress: "10.0.0.12",
			createdAt: OCCURRED_AT + 1,
		});
	});

	it("keeps a missing image as null (an INSERT has no before, a DELETE no after)", () => {
		expect(toDataChangeLogDetail(changeRow({ operation: "INSERT", oldData: null, changedColumns: [] }), REFERENCES).oldData).toBeNull();
	});
});
