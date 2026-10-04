import { createHash } from "node:crypto";

import { Test } from "@nestjs/testing";
import { Prisma } from "@prisma/client";
import type { AdminCreateOrganizationInviteInput } from "@workspace/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import { PrismaService } from "../../../prisma/prisma.service";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { ORGANIZATION_DEFAULT_PLAN } from "../constants/organization-plan";
import { DEFAULT_TENANT_POLICY_AUDIT_ACTION } from "../utils/rewardhub-policy-seed.util";
import { OrganizationAuditService } from "./organization-audit.service";
import { OrganizationLifecycleEventRecorder } from "./organization-lifecycle-event.recorder";
import { ORGANIZATION_PROVISIONING_ERROR_CODES, OrganizationProvisioningService } from "./organization-provisioning.service";

vi.mock("../../../prisma/prisma.service", () => ({ PrismaService: class {} }));
vi.mock("../../../prisma/tenant-transaction.service", () => ({ TenantTransactionService: class {} }));

const ADMIN_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const OWNER_ID = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";
const ORG_ID = "6f0c1d2e-3a4b-4c5d-8e9f-0a1b2c3d4e5f";
const SEEDED_POLICY_VERSION = 3;
/** The correlation id the (fake) provisioning transaction runs under — `app.correlation_id`. */
const TRANSACTION_CORRELATION_ID = "corr-provisioning-1";

const PLATFORM_INVITE: AdminCreateOrganizationInviteInput = {
	email: "owner@brew.example",
	displayName: "Brew & Bean",
	slug: "brew-bean",
	intendedRole: "OWNER",
	city: "KUALA_LUMPUR",
	category: "cafe",
};

/** A fake transaction client: the spec's delegate mocks on top of a (module-mocked, connection-less) PrismaService. */
function asTransaction<TFake extends object>(fake: TFake): PrismaService & TFake {
	return Object.assign(new PrismaService(createTestTypedConfig()), fake);
}

function createTx(): {
	organization: { create: ReturnType<typeof vi.fn>; findFirst: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn> };
	organizationSlugHistory: { findFirst: ReturnType<typeof vi.fn> };
	organizationInvitation: { create: ReturnType<typeof vi.fn> };
	organizationMembership: { findFirst: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
	organizationLifecycleEvent: { create: ReturnType<typeof vi.fn> };
	authorizationPolicyDraft: { create: ReturnType<typeof vi.fn> };
	authorizationPolicyVersion: { findFirst: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; aggregate: ReturnType<typeof vi.fn> };
	organizationAuditLog: { create: ReturnType<typeof vi.fn> };
	authorizationAudit: { upsert: ReturnType<typeof vi.fn> };
	$queryRaw: ReturnType<typeof vi.fn>;
} {
	return {
		organization: { create: vi.fn().mockResolvedValue({ id: ORG_ID, slug: "brew-bean" }), findFirst: vi.fn().mockResolvedValue(null), updateMany: vi.fn() },
		organizationSlugHistory: { findFirst: vi.fn().mockResolvedValue(null) },
		organizationInvitation: { create: vi.fn().mockResolvedValue({ id: "invite-1" }) },
		organizationMembership: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: "membership-1" }) },
		organizationLifecycleEvent: { create: vi.fn().mockResolvedValue({}) },
		authorizationPolicyDraft: { create: vi.fn().mockResolvedValue({ id: "draft-1" }) },
		authorizationPolicyVersion: {
			findFirst: vi.fn().mockResolvedValue(null),
			create: vi.fn().mockResolvedValue({ id: "version-1" }),
			aggregate: vi.fn().mockResolvedValue({ _max: { version: SEEDED_POLICY_VERSION } }),
		},
		organizationAuditLog: { create: vi.fn().mockResolvedValue({}) },
		authorizationAudit: { upsert: vi.fn().mockResolvedValue({}) },
		$queryRaw: vi.fn().mockResolvedValue([{ correlation_id: TRANSACTION_CORRELATION_ID }]),
	};
}

describe("OrganizationProvisioningService", () => {
	let service: OrganizationProvisioningService;
	let tx: ReturnType<typeof createTx>;
	const tenantTx = { withSystemOperation: vi.fn() };

	beforeEach(async () => {
		vi.clearAllMocks();
		tx = createTx();
		tenantTx.withSystemOperation.mockImplementation(async (_context: object, work: (client: ReturnType<typeof createTx>) => Promise<object>) => work(tx));
		const moduleRef = await Test.createTestingModule({
			providers: [OrganizationProvisioningService, OrganizationAuditService, OrganizationLifecycleEventRecorder, { provide: TenantTransactionService, useValue: tenantTx }],
		}).compile();
		service = moduleRef.get(OrganizationProvisioningService);
	});

	describe("provisionFromPlatformInvite", () => {
		it("creates the organization from the validated input with NO address-less primary location", async () => {
			const result = await service.provisionFromPlatformInvite(ADMIN_ID, PLATFORM_INVITE);

			expect(tx.organization.create.mock.lastCall?.[0]).toMatchObject({
				data: {
					slug: "brew-bean",
					displayName: "Brew & Bean",
					lifecycleState: "PROVISIONING",
					merchantProfile: { create: { category: "cafe", city: "KUALA_LUMPUR", contactEmail: "owner@brew.example" } },
					entitlements: { create: { planCode: ORGANIZATION_DEFAULT_PLAN.planCode } },
				},
			});
			expect(tx.organization.create.mock.lastCall?.[0]).not.toHaveProperty("data.locations");
			expect(result.organizationId).toBe(ORG_ID);
			expect(result.inviteToken).toMatch(/^[0-9a-f]{64}$/);
		});

		it("publishes the default tenant policy as an explicit platform-template approval — never self-approved — and audits it", async () => {
			await service.provisionFromPlatformInvite(ADMIN_ID, PLATFORM_INVITE);

			expect(tx.authorizationPolicyDraft.create.mock.lastCall?.[0]).toMatchObject({
				data: { createdById: ADMIN_ID, approvedById: null, approvalKind: "PLATFORM_DEFAULT_TEMPLATE", status: "PUBLISHED" },
			});
			expect(tx.authorizationAudit.upsert.mock.lastCall?.[0]).toMatchObject({
				update: {},
				create: { actorId: ADMIN_ID, organizationId: ORG_ID, action: DEFAULT_TENANT_POLICY_AUDIT_ACTION, resourceId: "draft-1", policyIds: ["version-1"] },
			});
		});

		it("stores only the token hash and audits in the provisioning transaction with the admin actor and the seeded policy version", async () => {
			const result = await service.provisionFromPlatformInvite(ADMIN_ID, PLATFORM_INVITE);

			expect(tx.organizationInvitation.create.mock.lastCall?.[0]).toMatchObject({ data: { tokenHash: createHash("sha256").update(result.inviteToken).digest("hex") } });
			expect(tx.authorizationPolicyVersion.create).toHaveBeenCalled();
			expect(tx.organizationAuditLog.create.mock.lastCall).toMatchObject([
				{
					data: { action: "organization.provisioned", actorUserId: ADMIN_ID, organizationId: ORG_ID, policyVersion: SEEDED_POLICY_VERSION },
				},
			]);
		});

		it("records the PROVISIONING lifecycle event with the transaction's correlation id", async () => {
			await service.provisionFromPlatformInvite(ADMIN_ID, PLATFORM_INVITE);

			expect(tx.organization.create.mock.lastCall?.[0]).not.toHaveProperty("data.lifecycleEvents");
			expect(tx.organizationLifecycleEvent.create).toHaveBeenCalledWith({
				data: {
					organizationId: ORG_ID,
					fromState: null,
					toState: "PROVISIONING",
					actorUserId: ADMIN_ID,
					reason: "Platform invite created",
					correlationId: TRANSACTION_CORRELATION_ID,
				},
			});
		});

		it("answers a duplicate slug with 409 instead of claiming idempotency", async () => {
			tx.organization.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test" }));

			await expect(service.provisionFromPlatformInvite(ADMIN_ID, PLATFORM_INVITE)).rejects.toMatchObject({
				code: ORGANIZATION_PROVISIONING_ERROR_CODES.slugTaken,
				httpStatus: 409,
			});
		});
	});

	describe("provisionFromRewardHubAdminInvite", () => {
		it("leaves the business category empty (no 'retail' placeholder) and creates no location", async () => {
			await service.provisionFromRewardHubAdminInvite(ADMIN_ID, { email: "owner@brew.example", businessName: "Brew & Bean", city: "KUALA_LUMPUR" });

			expect(tx.organization.create.mock.lastCall?.[0]).toMatchObject({ data: { merchantProfile: { create: { category: null } } } });
			expect(tx.organization.create.mock.lastCall?.[0]).not.toHaveProperty("data.locations");
			expect(tx.organizationAuditLog.create.mock.lastCall).toMatchObject([{ data: { actorUserId: ADMIN_ID, policyVersion: SEEDED_POLICY_VERSION } }]);
			expect(tx.organizationLifecycleEvent.create.mock.lastCall).toMatchObject([
				{ data: { organizationId: ORG_ID, toState: "PROVISIONING", correlationId: TRANSACTION_CORRELATION_ID } },
			]);
		});
	});

	describe("ensureOwnerMembershipInTx", () => {
		it("creates an OWNER membership with an explicit ALL_LOCATIONS scope row and audits it", async () => {
			await service.ensureOwnerMembershipInTx(asTransaction(tx), ORG_ID, OWNER_ID);

			expect(tx.organizationMembership.create).toHaveBeenCalledWith({
				data: {
					organizationId: ORG_ID,
					userId: OWNER_ID,
					role: "OWNER",
					status: "ACTIVE",
					locationScopes: { create: [{ organizationId: ORG_ID, scopeType: "ALL_LOCATIONS" }] },
				},
			});
			expect(tx.organizationAuditLog.create.mock.lastCall).toMatchObject([{ data: { action: "membership.owner_created", actorUserId: OWNER_ID } }]);
		});

		it("is a no-op when the live membership already exists", async () => {
			tx.organizationMembership.findFirst.mockResolvedValue({ id: "membership-1" });

			await service.ensureOwnerMembershipInTx(asTransaction(tx), ORG_ID, OWNER_ID);

			expect(tx.organizationMembership.create).not.toHaveBeenCalled();
		});
	});

	describe("activateAfterOnboardingInTx", () => {
		it("activates only a PROVISIONING organization (compare-and-set) and audits", async () => {
			tx.organization.updateMany.mockResolvedValue({ count: 1 });

			await service.activateAfterOnboardingInTx(asTransaction(tx), ORG_ID, OWNER_ID);

			expect(tx.organization.updateMany.mock.lastCall).toMatchObject([{ where: { id: ORG_ID, lifecycleState: "PROVISIONING", isDeleted: false } }]);
			expect(tx.organizationLifecycleEvent.create).toHaveBeenCalledWith({
				data: {
					organizationId: ORG_ID,
					fromState: "PROVISIONING",
					toState: "ACTIVE",
					actorUserId: OWNER_ID,
					reason: "Onboarding complete",
					correlationId: TRANSACTION_CORRELATION_ID,
				},
			});
			expect(tx.organizationAuditLog.create.mock.lastCall).toMatchObject([{ data: { action: "organization.activated", actorUserId: OWNER_ID } }]);
		});

		it("fails with 409 when the organization is no longer provisioning", async () => {
			tx.organization.updateMany.mockResolvedValue({ count: 0 });

			await expect(service.activateAfterOnboardingInTx(asTransaction(tx), ORG_ID, OWNER_ID)).rejects.toMatchObject({
				code: ORGANIZATION_PROVISIONING_ERROR_CODES.notProvisioning,
				httpStatus: 409,
			});
			expect(tx.organizationLifecycleEvent.create).not.toHaveBeenCalled();
		});
	});
});
