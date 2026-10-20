import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestTypedConfig } from "../../../../../../test/support/test-api-env";
import { PrismaService } from "../../../../../prisma/prisma.service";
import { PrismaAuditReferenceReader } from "../prisma-audit-reference.reader";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const TENANT_ID = "33333333-3333-4333-8333-333333333333";

describe("PrismaAuditReferenceReader", () => {
	const findUsers = vi.fn();
	const findTenants = vi.fn();
	// The caller's transaction client: only the two delegates the reader reads are replaced.
	const tx: PrismaService = Object.assign(new PrismaService(createTestTypedConfig()), { user: { findMany: findUsers }, tenant: { findMany: findTenants } });
	const reader = new PrismaAuditReferenceReader(tx);

	beforeEach(() => {
		vi.clearAllMocks();
		findUsers.mockResolvedValue([{ id: USER_ID, email: "admin@example.com", fullName: "Admin" }]);
		findTenants.mockResolvedValue([{ id: TENANT_ID, displayName: "Kopi Corner" }]);
	});

	it("loads the named users and tenants — soft-deleted ones included — indexed by id", async () => {
		const references = await reader.load({ userIds: [USER_ID], tenantIds: [TENANT_ID] });

		expect(findUsers).toHaveBeenCalledWith({ where: { id: { in: [USER_ID] } }, select: { id: true, email: true, fullName: true } });
		expect(findTenants).toHaveBeenCalledWith({ where: { id: { in: [TENANT_ID] } }, select: { id: true, displayName: true } });
		expect(references.users.get(USER_ID)?.fullName).toBe("Admin");
		expect(references.tenants.get(TENANT_ID)?.displayName).toBe("Kopi Corner");
	});

	it("does not query for an empty id list", async () => {
		const references = await reader.load({ userIds: [], tenantIds: [] });

		expect(findUsers).not.toHaveBeenCalled();
		expect(findTenants).not.toHaveBeenCalled();
		expect(references.users.size).toBe(0);
	});
});
