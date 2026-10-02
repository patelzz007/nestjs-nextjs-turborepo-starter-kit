import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma, ResourceAcl } from "@prisma/client";
import { PolicyConditionsSchema, type AuthorizationRequest } from "@workspace/shared";

import { PrismaService } from "../../../../prisma/prisma.service";
import { AclService, type AclLookup } from "../acl.service";
import { PolicyEngineService } from "../policy-engine.service";
import { createTestTypedConfig } from "../../../../../test/support/test-api-env";

const mocks = vi.hoisted(() => ({
	aclFindMany: vi.fn<(args: Prisma.ResourceAclFindManyArgs) => Promise<ResourceAcl[]>>(),
	policyFindMany: vi.fn(),
}));

vi.mock("../../../../prisma/prisma.service", () => ({
	PrismaService: class {
		public readonly resourceAcl = { findMany: mocks.aclFindMany };
		public readonly policyDefinition = { findMany: mocks.policyFindMany };
	},
}));

function entry(overrides: Partial<ResourceAcl>): ResourceAcl {
	return {
		id: "acl-1",
		subjectType: "USER",
		subjectId: "user-1",
		action: "DELETE",
		resourceType: "ORDER",
		resourceId: "order-1",
		effect: "ALLOW",
		scope: null,
		organizationId: null,
		locationId: null,
		conditions: null,
		expiresAt: null,
		assignedBy: null,
		reason: null,
		isDeleted: false,
		deletedAt: null,
		createdAt: BigInt(0),
		updatedAt: BigInt(0),
		...overrides,
	};
}

const lookup: AclLookup = {
	userId: "user-1",
	roleIds: ["role-1"],
	action: "DELETE",
	resource: "ORDER",
	resourceScope: { kind: "resource", id: "order-1" },
	organizationId: "org-a",
};
const request: AuthorizationRequest = {
	subject: { userId: "user-1", organizationId: "org-a" },
	action: "DELETE",
	resource: "ORDER",
	resourceId: "order-1",
	resourceAttributes: { status: "PAID" },
};

function createService(): AclService {
	const prisma = new PrismaService(createTestTypedConfig());
	return new AclService(prisma, new PolicyEngineService(prisma));
}

describe("AclService.findApplicable", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.aclFindMany.mockResolvedValue([]);
	});

	it("queries user + role subjects, MANAGE, type-wide entries, and the verified tenant in one query", async () => {
		await createService().findApplicable(lookup, request);

		expect(mocks.aclFindMany).toHaveBeenCalledTimes(1);
		const where = mocks.aclFindMany.mock.lastCall?.[0].where;
		expect(where?.isDeleted).toBe(false);
		expect(where?.action).toEqual({ in: ["DELETE", "MANAGE"] });
		expect(where?.resourceType).toBe("ORDER");
		expect(where?.AND).toEqual(
			expect.arrayContaining([
				{
					OR: [
						{ subjectType: "USER", subjectId: "user-1" },
						{ subjectType: "ROLE", subjectId: { in: ["role-1"] } },
					],
				},
				{ OR: [{ organizationId: null }, { organizationId: "org-a" }] },
				{ OR: [{ locationId: null }] },
				{ OR: [{ resourceId: null }, { resourceId: "order-1" }] },
			]),
		);
	});

	it("only matches type-wide entries for global checks and every entry for list filters", async () => {
		const service = createService();

		await service.findApplicable({ ...lookup, resourceScope: { kind: "typeWide" } }, request);
		expect(mocks.aclFindMany.mock.lastCall?.[0].where?.AND).toContainEqual({ resourceId: null });

		await service.findApplicable({ ...lookup, resourceScope: { kind: "everyResource" } }, request);
		expect(mocks.aclFindMany.mock.lastCall?.[0].where?.AND).toContainEqual({});
	});

	it("splits entries by effect and drops entries whose conditions do not match", async () => {
		const requiresPending: Prisma.JsonObject = { condition: { field: "status", operator: "equals", value: "PENDING" } };
		// The fixture must be a VALID rule, so the drop below proves a non-match, not fail-closed parsing.
		expect(PolicyConditionsSchema.safeParse(requiresPending).success).toBe(true);
		mocks.aclFindMany.mockResolvedValue([
			entry({ id: "deny-1", effect: "DENY" }),
			entry({ id: "allow-1", effect: "ALLOW" }),
			entry({ id: "allow-conditional", effect: "ALLOW", conditions: requiresPending }),
		]);

		const matches = await createService().findApplicable(lookup, request);

		expect(matches.denies.map((acl) => acl.id)).toEqual(["deny-1"]);
		expect(matches.allows.map((acl) => acl.id)).toEqual(["allow-1"]);
	});

	it("keeps DENY entries with malformed conditions (fail closed)", async () => {
		mocks.aclFindMany.mockResolvedValue([entry({ id: "deny-bad", effect: "DENY", conditions: { eval: "true" } })]);

		const matches = await createService().findApplicable(lookup, request);

		expect(matches.denies.map((acl) => acl.id)).toEqual(["deny-bad"]);
	});
});
