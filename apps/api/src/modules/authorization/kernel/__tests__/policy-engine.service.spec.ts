import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PolicyDefinition, Prisma } from "@prisma/client";
import { LIST_SLOT_INDEX, PolicyConditionsSchema, type AuthorizationRequest, type PolicyOperator, type PolicyValue } from "@workspace/shared";

import { PrismaService } from "../../../../prisma/prisma.service";
import { applyPolicyOperator, matchesPolicyRule, PolicyEngineService } from "../policy-engine.service";
import { createTestTypedConfig } from "../../../../../test/support/test-api-env";

const mocks = vi.hoisted(() => ({
	policyFindMany: vi.fn<(args: Prisma.PolicyDefinitionFindManyArgs) => Promise<PolicyDefinition[]>>(),
}));

vi.mock("../../../../prisma/prisma.service", () => ({
	PrismaService: class {
		public readonly policyDefinition = { findMany: mocks.policyFindMany };
	},
}));

function policy(overrides: Partial<PolicyDefinition>): PolicyDefinition {
	return {
		id: "policy-1",
		name: "policy",
		description: null,
		version: 1,
		effect: "ALLOW",
		scope: "GLOBAL",
		actions: ["UPDATE"],
		resources: ["ORDER"],
		organizationId: null,
		locationId: null,
		conditions: null,
		isActive: true,
		publishedAt: null,
		publishedBy: null,
		supersededBy: null,
		isDeleted: false,
		deletedAt: null,
		createdAt: BigInt(0),
		updatedAt: BigInt(0),
		...overrides,
	};
}

function request(overrides: Partial<AuthorizationRequest> = {}): AuthorizationRequest {
	return {
		subject: { userId: "user-1", organizationId: "org-a" },
		action: "UPDATE",
		resource: "ORDER",
		resourceAttributes: { status: "PENDING", total: 250, organizationId: "org-a", tags: ["vip", "rush"] },
		...overrides,
	};
}

/** Stored `conditions` JSON, exactly as the `policy_definitions` row holds it. */
const statusIsCompleted: Prisma.JsonObject = { condition: { field: "order.status", operator: "equals", value: "COMPLETED" } };
const sameOrganization: Prisma.JsonObject = { condition: { field: "order.organizationId", operator: "equals", valueRef: "$user.organizationId" } };

describe("PolicyEngineService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("uses stored condition fixtures that are valid policy rules", () => {
		expect(PolicyConditionsSchema.safeParse(statusIsCompleted).success).toBe(true);
		expect(PolicyConditionsSchema.safeParse(sameOrganization).success).toBe(true);
	});

	it("abstains when no policy targets the request", async () => {
		mocks.policyFindMany.mockResolvedValue([]);

		const result = await new PolicyEngineService(new PrismaService(createTestTypedConfig())).evaluate(request());

		expect(result.decision).toBe("NOT_APPLICABLE");
	});

	it("abstains when only non-matching DENY policies exist (does not block everyone)", async () => {
		mocks.policyFindMany.mockResolvedValue([policy({ effect: "DENY", conditions: statusIsCompleted })]);

		const result = await new PolicyEngineService(new PrismaService(createTestTypedConfig())).evaluate(request());

		expect(result.decision).toBe("NOT_APPLICABLE");
	});

	it("denies when a DENY policy matches", async () => {
		mocks.policyFindMany.mockResolvedValue([policy({ effect: "DENY", conditions: statusIsCompleted })]);

		const result = await new PolicyEngineService(new PrismaService(createTestTypedConfig())).evaluate(request({ resourceAttributes: { status: "COMPLETED" } }));

		expect(result.decision).toBe("DENY");
		expect(result.evaluation.at(-1)?.details).toEqual({ policyId: "policy-1" });
	});

	it("requires at least one conditional ALLOW policy to match", async () => {
		mocks.policyFindMany.mockResolvedValue([policy({ conditions: sameOrganization })]);
		const engine = new PolicyEngineService(new PrismaService(createTestTypedConfig()));

		expect((await engine.evaluate(request())).decision).toBe("ALLOW");
		expect((await engine.evaluate(request({ resourceAttributes: { organizationId: "org-b" } }))).decision).toBe("DENY");
	});

	it("fails closed on malformed stored conditions", async () => {
		const legacyShape = { all: [{ operator: "gte", path: "context.hour", value: 9 }] };
		const engine = new PolicyEngineService(new PrismaService(createTestTypedConfig()));

		mocks.policyFindMany.mockResolvedValue([policy({ effect: "DENY", conditions: legacyShape })]);
		expect((await engine.evaluate(request())).decision).toBe("DENY");

		mocks.policyFindMany.mockResolvedValue([policy({ effect: "ALLOW", conditions: legacyShape })]);
		expect((await engine.evaluate(request())).decision).toBe("DENY");
	});

	it("reports unconditional DENY policies for list filters", async () => {
		mocks.policyFindMany.mockResolvedValue([policy({ effect: "DENY", conditions: null })]);

		expect(await new PolicyEngineService(new PrismaService(createTestTypedConfig())).hasUnconditionalDeny(request())).toBe(true);
	});

	it("scopes the policy query to the verified tenant", async () => {
		mocks.policyFindMany.mockResolvedValue([]);

		await new PolicyEngineService(new PrismaService(createTestTypedConfig())).evaluate(
			request({ subject: { userId: "user-1", organizationId: "org-a", locationId: "loc-1" } }),
		);

		expect(mocks.policyFindMany).toHaveBeenCalledTimes(1);
		expect(mocks.policyFindMany.mock.lastCall?.[LIST_SLOT_INDEX.first].where?.AND).toEqual([
			{ OR: [{ organizationId: null }, { organizationId: "org-a" }] },
			{ OR: [{ locationId: null }, { locationId: "loc-1" }] },
		]);
	});

	it("treats null stored conditions as unconditional", () => {
		const engine = new PolicyEngineService(new PrismaService(createTestTypedConfig()));

		expect(engine.matchesStoredConditions(null, request(), false)).toBe(true);
	});
});

describe("policy DSL evaluation", () => {
	it.each<[PolicyOperator, PolicyValue, PolicyValue, boolean]>([
		["equals", "a", "a", true],
		["not_equals", "a", "b", true],
		["in", "a", ["a", "b"], true],
		["in", "c", ["a", "b"], false],
		["not_in", "c", ["a", "b"], true],
		["contains", "hello", "ell", true],
		["contains", ["vip", "rush"], "vip", true],
		["not_contains", ["vip"], "rush", true],
		["starts_with", "hello", "he", true],
		["ends_with", "hello", "lo", true],
		["greater_than", 10, 5, true],
		["greater_than_or_equals", 5, 5, true],
		["less_than", 4, 5, true],
		["less_than_or_equals", 6, 5, false],
		["greater_than", "10", 5, false],
		["exists", "x", null, true],
		["exists", null, null, false],
		["not_exists", null, null, true],
	])("%s(%j, %j) → %s", (operator, field, compare, expected) => {
		expect(applyPolicyOperator(operator, field, compare)).toBe(expected);
	});

	it("evaluates nested all/any rules against resource and subject attributes", () => {
		const rule = PolicyConditionsSchema.parse({
			all: [
				{ condition: { field: "order.organizationId", operator: "equals", valueRef: "$user.organizationId" } },
				{
					any: [
						{ condition: { field: "$resource.total", operator: "less_than_or_equals", value: 500 } },
						{ condition: { field: "status", operator: "equals", value: "PAID" } },
					],
				},
			],
		});

		expect(matchesPolicyRule(rule, request())).toBe(true);
		expect(matchesPolicyRule(rule, request({ resourceAttributes: { organizationId: "org-a", total: 900, status: "PENDING" } }))).toBe(false);
	});

	it("rejects rules that are empty, mix branches, or use unknown keys", () => {
		expect(PolicyConditionsSchema.safeParse({}).success).toBe(false);
		expect(PolicyConditionsSchema.safeParse({ all: [], any: [] }).success).toBe(false);
		expect(PolicyConditionsSchema.safeParse({ condition: { field: "x", operator: "eval", value: "1" } }).success).toBe(false);
		expect(PolicyConditionsSchema.safeParse({ condition: { field: "x", operator: "equals", value: "1", code: "return true" } }).success).toBe(false);
	});
});
