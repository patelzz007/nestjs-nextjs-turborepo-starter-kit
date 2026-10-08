import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { isStringPrimitive, LIST_SLOT_INDEX } from "@workspace/shared";
import { SupportAccessGrantStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestTypedConfig } from "../../../test/support/test-api-env";
import { RequestContextService } from "../../common/context/request-context";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantTransactionService } from "../../prisma/tenant-transaction.service";
import { CedarWasmPolicyEngine } from "../authorization-cedar/engine/cedar-wasm-policy-engine";
import { CedarPolicyEvaluatorService } from "../authorization-cedar/services/cedar-policy-evaluator.service";
import { OrganizationAuditService } from "../organization/services/organization-audit.service";
import { SupportAccessService } from "./support-access.service";

interface GrantRow {
	readonly id: string;
	readonly organizationId: string;
	readonly supportUserId: string;
	status: SupportAccessGrantStatus;
	readonly expiresAt: number;
	tenantApprovedById: string | null;
}

interface MembershipWhere {
	readonly organizationId: string;
	readonly userId: string;
	readonly role: string;
	readonly status: string;
	readonly isDeleted: boolean;
	readonly user: { readonly isActive: boolean; readonly isDeleted: boolean };
}

interface GrantUpdateWhere {
	readonly id: string;
	readonly organizationId?: string;
	readonly status: SupportAccessGrantStatus | { readonly in: readonly SupportAccessGrantStatus[] };
	readonly expiresAt?: { readonly gt: number };
	readonly supportUserId?: { readonly not: string };
}

interface FakeDatabase {
	readonly grants: Map<string, GrantRow>;
	/** Live OWNER memberships as `organizationId:userId` (ACTIVE, not deleted, account active). */
	readonly liveOwners: Set<string>;
	readonly membershipQueries: MembershipWhere[];
	readonly auditRows: object[];
	readonly operations: string[];
}

const db = vi.hoisted((): FakeDatabase => ({ grants: new Map<string, GrantRow>(), liveOwners: new Set<string>(), membershipQueries: [], auditRows: [], operations: [] }));

function statusMatches(row: GrantRow, status: GrantUpdateWhere["status"]): boolean {
	return isStringPrimitive(status) ? row.status === status : status.in.includes(row.status);
}

/** Whether `row` satisfies the conditional-update `where` (each optional clause only when present). */
function grantMatches(row: GrantRow, where: GrantUpdateWhere): boolean {
	if (!statusMatches(row, where.status)) {
		return false;
	}
	if (where.organizationId !== undefined && row.organizationId !== where.organizationId) {
		return false;
	}
	if (where.expiresAt !== undefined && row.expiresAt <= where.expiresAt.gt) {
		return false;
	}
	return where.supportUserId === undefined ? true : row.supportUserId !== where.supportUserId.not;
}

function transactionClient(): object {
	return {
		organization: {
			findFirst: (args: { readonly where: { readonly id: string } }): Promise<{ readonly id: string } | null> =>
				Promise.resolve(args.where.id === ORG_ID ? { id: ORG_ID } : null),
		},
		organizationMembership: {
			findFirst: (args: { readonly where: MembershipWhere }): Promise<{ readonly id: string } | null> => {
				db.membershipQueries.push(args.where);
				return Promise.resolve(db.liveOwners.has(`${args.where.organizationId}:${args.where.userId}`) ? { id: "membership-1" } : null);
			},
		},
		supportAccessGrant: {
			create: (args: { readonly data: Omit<GrantRow, "id" | "tenantApprovedById"> }): Promise<GrantRow & { readonly createdAt: number; readonly mode: string }> => {
				const row: GrantRow = { ...args.data, id: "grant-new", tenantApprovedById: null };
				db.grants.set(row.id, row);
				return Promise.resolve({ ...row, createdAt: NOW, mode: "READ_ONLY" });
			},
			findUnique: (args: { readonly where: { readonly id: string } }): Promise<GrantRow | null> => Promise.resolve(db.grants.get(args.where.id) ?? null),
			updateMany: (args: {
				readonly where: GrantUpdateWhere;
				readonly data: { readonly status: SupportAccessGrantStatus; readonly tenantApprovedById?: string };
			}): Promise<{ readonly count: number }> => {
				const row = db.grants.get(args.where.id);
				const matches = row !== undefined && grantMatches(row, args.where);
				if (row !== undefined && matches) {
					row.status = args.data.status;
					row.tenantApprovedById = args.data.tenantApprovedById ?? row.tenantApprovedById;
				}
				return Promise.resolve({ count: matches ? 1 : 0 });
			},
		},
		organizationAuditLog: {
			create: (args: { readonly data: object }): Promise<object> => {
				db.auditRows.push(args.data);
				return Promise.resolve({});
			},
		},
	};
}

vi.mock("../../prisma/tenant-transaction.service", () => ({
	TenantTransactionService: class {
		public async withSystemOperation<T>(context: { readonly operation: string }, handler: (tx: object) => Promise<T>): Promise<T> {
			db.operations.push(context.operation);
			return handler(transactionClient());
		}
	},
}));

vi.mock("../../prisma/prisma.service", () => ({ PrismaService: class {} }));

vi.mock("../authorization-cedar/services/cedar-policy-evaluator.service", () => ({
	CedarPolicyEvaluatorService: class {
		public readonly getActivePolicyVersion = (): Promise<number> => Promise.resolve(POLICY_VERSION);
	},
}));

const ORG_ID = "org-1";
const OTHER_ORG_ID = "org-2";
const OWNER_ID = "owner-1";
const SUPPORT_USER_ID = "support-1";
const POLICY_VERSION = 7;
const NOW = Date.now();

function createService(): SupportAccessService {
	const tenantTx = new TenantTransactionService(new PrismaService(createTestTypedConfig()), new RequestContextService());
	return new SupportAccessService(tenantTx, new OrganizationAuditService(), new CedarPolicyEvaluatorService(tenantTx, new CedarWasmPolicyEngine()));
}

function seedGrant(status: SupportAccessGrantStatus, overrides: Partial<GrantRow> = {}): GrantRow {
	const row: GrantRow = {
		id: "grant-1",
		organizationId: ORG_ID,
		supportUserId: SUPPORT_USER_ID,
		status,
		expiresAt: NOW + 60 * 60_000,
		tenantApprovedById: null,
		...overrides,
	};
	db.grants.set(row.id, row);
	return row;
}

describe("SupportAccessService", () => {
	beforeEach(() => {
		db.grants.clear();
		db.liveOwners.clear();
		db.liveOwners.add(`${ORG_ID}:${OWNER_ID}`);
		db.membershipQueries.length = 0;
		db.auditRows.length = 0;
		db.operations.length = 0;
	});

	describe("tenantApprove", () => {
		it("approves with the organization taken from the grant record and audits it in the same transaction with the real actor + policy version", async () => {
			seedGrant("PENDING_TENANT_APPROVAL");

			await createService().tenantApprove("grant-1", OWNER_ID);

			expect(db.grants.get("grant-1")).toMatchObject({ status: "ACTIVE", tenantApprovedById: OWNER_ID });
			expect(db.membershipQueries[LIST_SLOT_INDEX.first]).toMatchObject({ organizationId: ORG_ID, userId: OWNER_ID, role: "OWNER", status: "ACTIVE", isDeleted: false });
			expect(db.auditRows).toEqual([
				expect.objectContaining({
					organizationId: ORG_ID,
					actorUserId: OWNER_ID,
					policyVersion: POLICY_VERSION,
					action: "support.grant_approved",
					resourceId: "grant-1",
				}),
			]);
			expect(db.operations).toContain("support_access.approve");
		});

		it("refuses an owner of a DIFFERENT organization (no client-supplied organization id can redirect the check)", async () => {
			seedGrant("PENDING_TENANT_APPROVAL", { organizationId: OTHER_ORG_ID });

			await expect(createService().tenantApprove("grant-1", OWNER_ID)).rejects.toBeInstanceOf(ForbiddenException);

			expect(db.membershipQueries[LIST_SLOT_INDEX.first]).toMatchObject({ organizationId: OTHER_ORG_ID });
			expect(db.grants.get("grant-1")?.status).toBe("PENDING_TENANT_APPROVAL");
			expect(db.auditRows).toEqual([]);
		});

		it("only accepts a live (not soft-deleted, active-account) owner membership", async () => {
			seedGrant("PENDING_TENANT_APPROVAL");
			db.liveOwners.clear();

			await expect(createService().tenantApprove("grant-1", OWNER_ID)).rejects.toMatchObject({ response: { error: "SUPPORT_ACCESS_APPROVER_NOT_OWNER" } });
			expect(db.membershipQueries[LIST_SLOT_INDEX.first]).toMatchObject({ isDeleted: false, user: { isActive: true, isDeleted: false } });
		});

		it.each(["REVOKED", "ACTIVE", "EXPIRED", "DENIED"] satisfies SupportAccessGrantStatus[])(
			"never revives or re-approves a %s grant (compare-and-set on status)",
			async (status: SupportAccessGrantStatus) => {
				seedGrant(status);

				await expect(createService().tenantApprove("grant-1", OWNER_ID)).rejects.toBeInstanceOf(ConflictException);

				expect(db.grants.get("grant-1")?.status).toBe(status);
				expect(db.auditRows).toEqual([]);
			},
		);

		it("refuses to approve an expired pending grant", async () => {
			seedGrant("PENDING_TENANT_APPROVAL", { expiresAt: NOW - 1 });

			await expect(createService().tenantApprove("grant-1", OWNER_ID)).rejects.toBeInstanceOf(ConflictException);
		});

		it("answers 404 for an unknown grant", async () => {
			await expect(createService().tenantApprove("missing", OWNER_ID)).rejects.toBeInstanceOf(NotFoundException);
		});
	});

	describe("revoke", () => {
		it("revokes a pending or active grant and audits it in the same transaction", async () => {
			seedGrant("ACTIVE");

			await createService().revoke("grant-1", SUPPORT_USER_ID);

			expect(db.grants.get("grant-1")?.status).toBe("REVOKED");
			expect(db.auditRows).toEqual([expect.objectContaining({ action: "support.grant_revoked", actorUserId: SUPPORT_USER_ID, policyVersion: POLICY_VERSION })]);
			expect(db.operations).toContain("support_access.revoke");
		});

		it("refuses to re-revoke a terminal grant", async () => {
			seedGrant("REVOKED");

			await expect(createService().revoke("grant-1", SUPPORT_USER_ID)).rejects.toMatchObject({ response: { error: "SUPPORT_ACCESS_GRANT_NOT_REVOCABLE" } });
			expect(db.auditRows).toEqual([]);
		});
	});

	describe("requestGrant", () => {
		it("creates the grant and its audit row in one transaction under the support_access.grant operation", async () => {
			const grant = await createService().requestGrant(SUPPORT_USER_ID, {
				organizationId: ORG_ID,
				reason: "Investigating ticket 4521",
				mode: "READ_ONLY",
				durationMinutes: 60,
			});

			expect(grant.status).toBe("PENDING_TENANT_APPROVAL");
			expect(db.auditRows).toEqual([expect.objectContaining({ action: "support.grant_requested", actorUserId: SUPPORT_USER_ID, resourceId: "grant-new" })]);
			expect(db.operations).toEqual(["support_access.grant"]);
		});

		it("refuses an unknown or deleted organization and writes nothing", async () => {
			await expect(
				createService().requestGrant(SUPPORT_USER_ID, { organizationId: OTHER_ORG_ID, reason: "Investigating ticket 4521", mode: "READ_ONLY", durationMinutes: 60 }),
			).rejects.toBeInstanceOf(NotFoundException);
			expect(db.auditRows).toEqual([]);
		});
	});
});
