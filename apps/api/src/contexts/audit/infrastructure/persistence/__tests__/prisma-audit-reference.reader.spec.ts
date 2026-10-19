import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestTypedConfig } from "../../../../../../test/support/test-api-env";
import { PrismaService } from "../../../../../prisma/prisma.service";
import { PrismaAuditReferenceReader } from "../prisma-audit-reference.reader";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const ORGANIZATION_ID = "33333333-3333-4333-8333-333333333333";

describe("PrismaAuditReferenceReader", () => {
	const findUsers = vi.fn();
	const findOrganizations = vi.fn();
	// The caller's transaction client: only the two delegates the reader reads are replaced.
	const tx: PrismaService = Object.assign(new PrismaService(createTestTypedConfig()), { user: { findMany: findUsers }, organization: { findMany: findOrganizations } });
	const reader = new PrismaAuditReferenceReader(tx);

	beforeEach(() => {
		vi.clearAllMocks();
		findUsers.mockResolvedValue([{ id: USER_ID, email: "admin@example.com", fullName: "Admin" }]);
		findOrganizations.mockResolvedValue([{ id: ORGANIZATION_ID, displayName: "Kopi Corner" }]);
	});

	it("loads the named users and organizations — soft-deleted ones included — indexed by id", async () => {
		const references = await reader.load({ userIds: [USER_ID], organizationIds: [ORGANIZATION_ID] });

		expect(findUsers).toHaveBeenCalledWith({ where: { id: { in: [USER_ID] } }, select: { id: true, email: true, fullName: true } });
		expect(findOrganizations).toHaveBeenCalledWith({ where: { id: { in: [ORGANIZATION_ID] } }, select: { id: true, displayName: true } });
		expect(references.users.get(USER_ID)?.fullName).toBe("Admin");
		expect(references.organizations.get(ORGANIZATION_ID)?.displayName).toBe("Kopi Corner");
	});

	it("does not query for an empty id list", async () => {
		const references = await reader.load({ userIds: [], organizationIds: [] });

		expect(findUsers).not.toHaveBeenCalled();
		expect(findOrganizations).not.toHaveBeenCalled();
		expect(references.users.size).toBe(0);
	});
});
