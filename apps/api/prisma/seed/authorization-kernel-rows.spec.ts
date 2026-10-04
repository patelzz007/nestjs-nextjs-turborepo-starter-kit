import type { PolicyDefinition, ResourceAcl } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { AclService } from "../../src/modules/authorization/kernel/acl.service";
import { PolicyEngineService } from "../../src/modules/authorization/kernel/policy-engine.service";
import { PrismaService } from "../../src/prisma/prisma.service";
import { createTestTypedConfig } from "../../test/support/test-api-env";
import { buildKernelSeedRows, KERNEL_SEED_IDS } from "./authorization-kernel-rows";
import { ORGANIZATION_SEED_IDS } from "./organization-seed-ids";
import { REWARD_SEED_IDS } from "./rewards";

vi.mock("../../src/prisma/prisma.service", () => ({ PrismaService: class {} }));

const NOW = 1_800_000_000_000;
const rows = buildKernelSeedRows({ adminUserId: "admin", managerUserId: "manager", userRoleId: "user-role", managerRoleId: "manager-role" }, NOW);

const JsonSchema = z.json();
type Json = z.output<typeof JsonSchema>;
type Row = Record<string, Json>;

function isRecord(value: Json | undefined): value is Row {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A just-enough evaluator for the `where` shapes the kernel uses: equality, null, `in`, `gt`, `has`, `AND` / `OR`. */
function matches(row: Row, where: Row): boolean {
	return Object.entries(where).every(([key, expected]) => {
		if (key === "AND") return Array.isArray(expected) && expected.every((part) => isRecord(part) && matches(row, part));
		if (key === "OR") return Array.isArray(expected) && expected.some((part) => isRecord(part) && matches(row, part));
		const actual = row[key];
		if (isRecord(expected)) {
			const { in: inList, gt, has } = expected;
			if (inList !== undefined) return Array.isArray(inList) && actual !== undefined && inList.includes(actual);
			if (gt !== undefined) return typeof actual === "number" && typeof gt === "number" && actual > gt;
			if (has !== undefined) return Array.isArray(actual) && actual.includes(has);
		}
		return actual === expected;
	});
}

/** The kernel reads rows through a column-complete JSON view (every optional column present, `null` when unset). */
function view(input: object, columns: readonly string[]): Row {
	const parsed = z.record(z.string(), JsonSchema).parse(JSON.parse(JSON.stringify(input)));
	const complete: Row = {};
	for (const column of columns) complete[column] = parsed[column] ?? null;
	return { ...parsed, ...complete };
}

const ACL_COLUMNS: readonly string[] = ["resourceId", "scope", "organizationId", "locationId", "conditions", "expiresAt", "assignedBy", "reason", "deletedAt"];
const POLICY_COLUMNS: readonly string[] = ["description", "organizationId", "locationId", "conditions", "publishedAt", "publishedBy", "supersededBy", "deletedAt"];

const AclModelSchema = z.object({ id: z.string() }).loose();
const PolicyModelSchema = z.object({ id: z.string() }).loose();

function whereOf(args: { where?: object }): Row {
	return z.record(z.string(), JsonSchema).parse(JSON.parse(JSON.stringify(args.where ?? {})));
}

const aclViews: readonly Row[] = rows.acls.map((row) => ({ isDeleted: false, ...view(row, ACL_COLUMNS) }));
const policyViews: readonly Row[] = rows.policies.map((row) => ({ isDeleted: false, isActive: true, ...view(row, POLICY_COLUMNS) }));

/** Rebuild a typed Prisma model from a JSON view (bigint columns come back from numbers). */
function aclModel(row: Row): ResourceAcl {
	const base = AclModelSchema.parse(row);
	const number = (column: string): bigint | null => {
		const value = row[column];
		return typeof value === "number" ? BigInt(value) : null;
	};
	const text = (column: string): string | null => {
		const value = row[column];
		return typeof value === "string" ? value : null;
	};
	return {
		id: base.id,
		subjectType: text("subjectType") ?? "",
		subjectId: text("subjectId") ?? "",
		action: text("action") ?? "",
		resourceType: text("resourceType") ?? "",
		resourceId: text("resourceId"),
		effect: row.effect === "DENY" ? "DENY" : "ALLOW",
		scope: null,
		organizationId: text("organizationId"),
		locationId: text("locationId"),
		conditions: row.conditions ?? null,
		expiresAt: number("expiresAt"),
		assignedBy: text("assignedBy"),
		reason: text("reason"),
		isDeleted: row.isDeleted === true,
		deletedAt: number("deletedAt"),
		createdAt: 0n,
		updatedAt: 0n,
	};
}

function policyModel(row: Row): PolicyDefinition {
	const base = PolicyModelSchema.parse(row);
	const number = (column: string): bigint | null => {
		const value = row[column];
		return typeof value === "number" ? BigInt(value) : null;
	};
	const text = (column: string): string | null => {
		const value = row[column];
		return typeof value === "string" ? value : null;
	};
	const strings = (column: string): string[] => {
		const value = row[column];
		return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
	};
	return {
		id: base.id,
		name: text("name") ?? "",
		description: text("description"),
		version: typeof row.version === "number" ? row.version : 1,
		effect: row.effect === "DENY" ? "DENY" : "ALLOW",
		scope: "GLOBAL",
		actions: strings("actions"),
		resources: strings("resources"),
		organizationId: text("organizationId"),
		locationId: text("locationId"),
		conditions: row.conditions ?? null,
		isActive: row.isActive === true,
		publishedAt: number("publishedAt"),
		publishedBy: text("publishedBy"),
		supersededBy: text("supersededBy"),
		isDeleted: row.isDeleted === true,
		deletedAt: number("deletedAt"),
		createdAt: 0n,
		updatedAt: 0n,
	};
}

const prismaFake = {
	resourceAcl: { findMany: vi.fn((args: { where?: object }): Promise<ResourceAcl[]> => Promise.resolve(aclViews.filter((row) => matches(row, whereOf(args))).map(aclModel))) },
	policyDefinition: {
		findMany: vi.fn((args: { where?: object }): Promise<PolicyDefinition[]> => Promise.resolve(policyViews.filter((row) => matches(row, whereOf(args))).map(policyModel))),
	},
};

function createPrisma(): PrismaService {
	return Object.assign(new PrismaService(createTestTypedConfig()), prismaFake);
}

const engine = new PolicyEngineService(createPrisma());
const acl = new AclService(createPrisma(), engine);

const CASHIER_UPDATE_PRODUCT: Parameters<AclService["findApplicable"]>[0] = {
	userId: REWARD_SEED_IDS.mlkCashierUser,
	roleIds: [],
	action: "UPDATE",
	resource: "PRODUCT",
	resourceScope: { kind: "resource", id: KERNEL_SEED_IDS.productTarget },
	organizationId: ORGANIZATION_SEED_IDS.mlkOrganization,
	locationId: ORGANIZATION_SEED_IDS.mlkLocationBeruang,
};

function productRequest(status: string): Parameters<AclService["findApplicable"]>[1] {
	return {
		subject: { userId: REWARD_SEED_IDS.mlkCashierUser, organizationId: ORGANIZATION_SEED_IDS.mlkOrganization, locationId: ORGANIZATION_SEED_IDS.mlkLocationBeruang },
		action: "UPDATE",
		resource: "PRODUCT",
		resourceId: KERNEL_SEED_IDS.productTarget,
		resourceAttributes: { status },
	};
}

describe("seeded kernel rows are matched by the kernel services", () => {
	it("AclService denies the Beruang cashier on the archived target product and abstains otherwise", async () => {
		const archived = await acl.findApplicable(CASHIER_UPDATE_PRODUCT, productRequest("ARCHIVED"));
		expect(archived.denies.map((entry) => entry.id)).toEqual([KERNEL_SEED_IDS.productScopedAcl]);

		const active = await acl.findApplicable(CASHIER_UPDATE_PRODUCT, productRequest("ACTIVE"));
		expect(active.denies).toEqual([]);
	});

	it("the tenant-, location- and resource-bound ACL does not apply elsewhere, and the retired ACL never matches", async () => {
		const otherStore = await acl.findApplicable({ ...CASHIER_UPDATE_PRODUCT, locationId: ORGANIZATION_SEED_IDS.mlkLocationKatil }, productRequest("ARCHIVED"));
		expect(otherStore.denies).toEqual([]);
		const otherProduct = await acl.findApplicable({ ...CASHIER_UPDATE_PRODUCT, resourceScope: { kind: "resource", id: "another-product" } }, productRequest("ARCHIVED"));
		expect(otherProduct.denies).toEqual([]);

		const retired = await acl.findApplicable(
			{
				userId: REWARD_SEED_IDS.klOwnerUser,
				roleIds: [],
				action: "READ",
				resource: "PAYMENT",
				resourceScope: { kind: "typeWide" },
				organizationId: ORGANIZATION_SEED_IDS.klOrganization,
			},
			{ subject: { userId: REWARD_SEED_IDS.klOwnerUser }, action: "READ", resource: "PAYMENT" },
		);
		expect(retired.allows.map((entry) => entry.id)).not.toContain(KERNEL_SEED_IDS.retiredAcl);
	});

	it("PolicyEngineService applies the published v2 cap inside Bukit Beruang, never the superseded or deleted rows", async () => {
		const subject = { userId: "u", organizationId: ORGANIZATION_SEED_IDS.mlkOrganization, locationId: ORGANIZATION_SEED_IDS.mlkLocationBeruang };
		const policyIds = async (amount: number): Promise<Record<string, string>> => {
			const result = await engine.evaluate({ subject, action: "UPDATE", resource: "PAYMENT", resourceAttributes: { status: "PAID", amount } });
			const byPolicy: Record<string, string> = {};
			for (const step of result.evaluation) {
				const policyId = step.details?.policyId;
				if (typeof policyId === "string") byPolicy[policyId] = step.effect;
			}
			return byPolicy;
		};

		const within = await policyIds(150);
		expect(within[KERNEL_SEED_IDS.policyV2Published]).toBe("ALLOW");
		const over = await policyIds(300);
		expect(over[KERNEL_SEED_IDS.policyV2Published]).toBe("NO_MATCH");
		for (const seen of [within, over]) {
			expect(Object.keys(seen)).not.toContain(KERNEL_SEED_IDS.policyV1Superseded);
			expect(Object.keys(seen)).not.toContain(KERNEL_SEED_IDS.policyDeleted);
		}

		const elsewhere = await engine.evaluate({
			subject: { ...subject, locationId: ORGANIZATION_SEED_IDS.mlkLocationKatil },
			action: "UPDATE",
			resource: "PAYMENT",
			resourceAttributes: { status: "PAID", amount: 150 },
		});
		expect(elsewhere.evaluation.some((step) => step.details?.policyId === KERNEL_SEED_IDS.policyV2Published)).toBe(false);
	});

	it("covers every optional column: published/superseded/deleted policy fields and expiring, conditional, deleted ACL fields", () => {
		const v1 = rows.policies.find((row) => row.id === KERNEL_SEED_IDS.policyV1Superseded);
		expect(v1).toMatchObject({ supersededBy: KERNEL_SEED_IDS.policyV2Published, isActive: false, publishedBy: "admin" });
		expect(rows.policies.find((row) => row.id === KERNEL_SEED_IDS.policyDeleted)).toMatchObject({ isDeleted: true });
		expect(rows.acls.find((row) => row.id === KERNEL_SEED_IDS.retiredAcl)).toMatchObject({ isDeleted: true });
		expect(rows.acls.find((row) => row.id === KERNEL_SEED_IDS.productScopedAcl)).toMatchObject({ resourceId: KERNEL_SEED_IDS.productTarget });
	});
});
