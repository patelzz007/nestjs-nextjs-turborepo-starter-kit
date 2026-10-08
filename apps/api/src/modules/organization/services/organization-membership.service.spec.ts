import { ForbiddenException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Prisma } from "@prisma/client";
import { LIST_SLOT_INDEX, MERCHANT_CAPABILITY, ReviewOrganizationAccessRequestSchema, type OrganizationMemberInviteInput } from "@workspace/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthorizationError, ConflictError, NotFoundError } from "../../../common/errors/app-error";
import { TypedConfigService } from "../../../config/typed-config.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { CryptoService } from "../../auth/services/crypto.service";
import { EmailVerificationService } from "../../auth/services/email-verification.service";
import { UserProvisioningService } from "../../auth/services/user-provisioning.service";
import { CedarPolicyEvaluatorService } from "../../authorization-cedar/services/cedar-policy-evaluator.service";
import { LogService } from "../../logs/logs.service";
import { EmailSenderService } from "../../notifications/email/email-sender.service";
import { OrganizationInviteRepository, type TeamInviteRow } from "../repositories/organization-invite.repository";
import { OrganizationAuditService } from "./organization-audit.service";
import { OrganizationMembershipService, ORGANIZATION_MEMBERSHIP_ERROR_CODES, type OrganizationTeamActor } from "./organization-membership.service";
import { OrganizationRewardAuthService } from "./organization-reward-auth.service";

vi.mock("../../../prisma/prisma.service", () => ({ PrismaService: class {} }));
vi.mock("../../../prisma/tenant-transaction.service", () => ({ TenantTransactionService: class {} }));
vi.mock("../../../config/typed-config.service", () => ({ TypedConfigService: class {} }));
vi.mock("../../auth/services/crypto.service", () => ({ CryptoService: class {} }));
vi.mock("../../auth/services/email-verification.service", () => ({ EmailVerificationService: class {} }));
vi.mock("../../auth/services/user-provisioning.service", () => ({ UserProvisioningService: class {} }));
vi.mock("../../authorization-cedar/services/cedar-policy-evaluator.service", () => ({ CedarPolicyEvaluatorService: class {} }));
vi.mock("../../logs/logs.service", () => ({ LogService: class {} }));
vi.mock("../../notifications/email/email-sender.service", () => ({ EmailSenderService: class {} }));
vi.mock("./organization-reward-auth.service", () => ({ OrganizationRewardAuthService: class {} }));

const ORG_ID = "6f0c1d2e-3a4b-4c5d-8e9f-0a1b2c3d4e5f";
const ACTOR_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const REQUESTER_ID = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";
const REQUEST_ID = "c3d4e5f6-a7b8-4c9d-8e1f-2a3b4c5d6e7f";
const INVITE_ID = "d4e5f6a7-b8c9-4d0e-9f2a-3b4c5d6e7f80";
const STORE_A = "e5f6a7b8-c9d0-4e1f-8a3b-4c5d6e7f8091";
const STORE_B = "f6a7b8c9-d0e1-4f2a-9b4c-5d6e7f8091a2";
const ACTOR_POLICY_VERSION = 7;
const ORG_POLICY_VERSION = 4;
const INVITE_TOKEN = "0123456789abcdef0123456789abcdef";
const HOUR_MS = 60 * 60 * 1000;

const OWNER_ACTOR: OrganizationTeamActor = {
	userId: ACTOR_ID,
	organizationId: ORG_ID,
	role: "OWNER",
	locationScopeType: "ALL_LOCATIONS",
	locationIds: [],
	policyVersion: ACTOR_POLICY_VERSION,
};

const STORE_SCOPED_ADMIN: OrganizationTeamActor = { ...OWNER_ACTOR, role: "ADMIN", locationScopeType: "SELECTED", locationIds: [STORE_A] };

function uniqueViolation(): Prisma.PrismaClientKnownRequestError {
	return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test" });
}

/** The delegates the service touches on a transaction client. */
function createTx(): {
	organizationAccessRequest: { findFirst: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
	organizationMembership: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
	organizationInvitation: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
	organizationLocation: { count: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
	organizationAuditLog: { create: ReturnType<typeof vi.fn> };
	user: { findUnique: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
} {
	return {
		organizationAccessRequest: { findFirst: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
		organizationMembership: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]), create: vi.fn() },
		organizationInvitation: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
		organizationLocation: { count: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
		organizationAuditLog: { create: vi.fn().mockResolvedValue({}) },
		user: { findUnique: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
	};
}

function teamInvite(overrides: Partial<TeamInviteRow> = {}): TeamInviteRow {
	return {
		id: INVITE_ID,
		organizationId: ORG_ID,
		email: "staff@example.com",
		tokenHash: "hash",
		kind: "TEAM_MEMBER",
		intendedRole: "CASHIER",
		locationScopeType: "SELECTED",
		status: "PENDING",
		createdByAdminId: ACTOR_ID,
		acceptedByUserId: null,
		expiresAt: BigInt(Date.now() + HOUR_MS),
		acceptedAt: null,
		documentsSubmittedAt: null,
		createdAt: 0n,
		updatedAt: 0n,
		organization: { id: ORG_ID, slug: "brew", displayName: "Brew" },
		locationScopes: [{ locationId: STORE_A, location: { id: STORE_A, name: "Bangsar" } }],
		createdByAdmin: { id: ACTOR_ID, fullName: "Owner" },
		...overrides,
	};
}

describe("OrganizationMembershipService", () => {
	let service: OrganizationMembershipService;
	let tx: ReturnType<typeof createTx>;
	/** Names of the system operations the service opened, in order. */
	let systemOperations: string[];
	const tenantTx = { withSystemOperation: vi.fn(), withTenantTransaction: vi.fn() };
	const auth = { requireMembershipCapability: vi.fn<OrganizationRewardAuthService["requireMembershipCapability"]>() };
	const cedar = { getActivePolicyVersion: vi.fn<CedarPolicyEvaluatorService["getActivePolicyVersion"]>() };
	const emailSender = { send: vi.fn() };
	const logService = { warn: vi.fn() };
	const crypto = { hash: vi.fn<CryptoService["hash"]>() };
	const userProvisioning = { createConsumerAccountInTx: vi.fn() };
	const emailVerification = { sendVerificationEmailIfUnverified: vi.fn() };
	const config = { clientApps: { merchantUrl: "https://merchant.example.com" }, runtime: { isProduction: false } };

	beforeEach(async () => {
		vi.clearAllMocks();
		tx = createTx();
		systemOperations = [];
		tenantTx.withSystemOperation.mockImplementation(async (context: { operation: string }, work: (client: ReturnType<typeof createTx>) => Promise<object>) => {
			systemOperations.push(context.operation);
			return work(tx);
		});
		tenantTx.withTenantTransaction.mockImplementation(async (_context: object, work: (client: ReturnType<typeof createTx>) => Promise<object>) => work(tx));
		auth.requireMembershipCapability.mockResolvedValue(undefined);
		cedar.getActivePolicyVersion.mockResolvedValue(ORG_POLICY_VERSION);
		emailSender.send.mockResolvedValue({ ok: true });
		crypto.hash.mockResolvedValue("password-hash");

		const moduleRef = await Test.createTestingModule({
			providers: [
				OrganizationMembershipService,
				OrganizationAuditService,
				OrganizationInviteRepository,
				{ provide: PrismaService, useValue: {} },
				{ provide: TenantTransactionService, useValue: tenantTx },
				{ provide: OrganizationRewardAuthService, useValue: auth },
				{ provide: CedarPolicyEvaluatorService, useValue: cedar },
				{ provide: EmailSenderService, useValue: emailSender },
				{ provide: LogService, useValue: logService },
				{ provide: CryptoService, useValue: crypto },
				{ provide: UserProvisioningService, useValue: userProvisioning },
				{ provide: EmailVerificationService, useValue: emailVerification },
				{ provide: TypedConfigService, useValue: config },
			],
		}).compile();
		service = moduleRef.get(OrganizationMembershipService);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("access-request review contract", () => {
		it("rejects granting OWNER", () => {
			expect(ReviewOrganizationAccessRequestSchema.safeParse({ approve: true, role: "OWNER", locationScopeType: "ALL_LOCATIONS", locationIds: [] }).success).toBe(false);
		});

		it("requires an explicit role and location scope on approval (no permissive defaults)", () => {
			expect(ReviewOrganizationAccessRequestSchema.safeParse({ approve: true }).success).toBe(false);
			expect(ReviewOrganizationAccessRequestSchema.safeParse({ approve: true, role: "MEMBER", locationIds: [] }).success).toBe(false);
			expect(ReviewOrganizationAccessRequestSchema.safeParse({ approve: true, locationScopeType: "ALL_LOCATIONS", locationIds: [] }).success).toBe(false);
		});

		it("rejects SELECTED without stores, ALL_LOCATIONS with stores, and duplicate stores", () => {
			expect(ReviewOrganizationAccessRequestSchema.safeParse({ approve: true, role: "MEMBER", locationScopeType: "SELECTED", locationIds: [] }).success).toBe(false);
			expect(ReviewOrganizationAccessRequestSchema.safeParse({ approve: true, role: "MEMBER", locationScopeType: "ALL_LOCATIONS", locationIds: [STORE_A] }).success).toBe(
				false,
			);
			expect(ReviewOrganizationAccessRequestSchema.safeParse({ approve: true, role: "MEMBER", locationScopeType: "SELECTED", locationIds: [STORE_A, STORE_A] }).success).toBe(
				false,
			);
		});

		it("accepts a bare rejection and a fully specified approval", () => {
			expect(ReviewOrganizationAccessRequestSchema.safeParse({ approve: false }).success).toBe(true);
			expect(ReviewOrganizationAccessRequestSchema.safeParse({ approve: true, role: "CASHIER", locationScopeType: "SELECTED", locationIds: [STORE_A] }).success).toBe(true);
		});
	});

	describe("reviewAccessRequest", () => {
		beforeEach(() => {
			tx.organizationAccessRequest.findFirst.mockResolvedValue({ id: REQUEST_ID, userId: REQUESTER_ID });
			tx.organizationAccessRequest.updateMany.mockResolvedValue({ count: 1 });
			tx.organizationMembership.create.mockResolvedValue({ id: "membership-1" });
			tx.organizationLocation.count.mockResolvedValue(1);
		});

		it("requires the manage-team capability and stops before any write when it is missing", async () => {
			auth.requireMembershipCapability.mockRejectedValueOnce(new ForbiddenException());

			await expect(service.reviewAccessRequest(OWNER_ACTOR, REQUEST_ID, { approve: false })).rejects.toBeInstanceOf(ForbiddenException);
			expect(auth.requireMembershipCapability).toHaveBeenCalledWith({ userId: ACTOR_ID, organizationId: ORG_ID, role: "OWNER" }, MERCHANT_CAPABILITY.manageTeam);
			expect(tenantTx.withSystemOperation).not.toHaveBeenCalled();
		});

		it("approves with the explicit role and scope, compare-and-sets PENDING, and audits in the same transaction with the real actor and policy version", async () => {
			await service.reviewAccessRequest(OWNER_ACTOR, REQUEST_ID, { approve: true, role: "CASHIER", locationScopeType: "SELECTED", locationIds: [STORE_A] });

			expect(tx.organizationAccessRequest.updateMany.mock.lastCall).toMatchObject([
				{
					where: { id: REQUEST_ID, organizationId: ORG_ID, status: "PENDING" },
					data: { status: "APPROVED", reviewedById: ACTOR_ID },
				},
			]);
			expect(tx.organizationMembership.create).toHaveBeenCalledWith({
				data: {
					organizationId: ORG_ID,
					userId: REQUESTER_ID,
					role: "CASHIER",
					locationScopes: { create: [{ organizationId: ORG_ID, scopeType: "SELECTED", locationId: STORE_A }] },
				},
			});
			expect(tx.organizationAuditLog.create.mock.lastCall).toMatchObject([
				{
					data: {
						organizationId: ORG_ID,
						actorUserId: ACTOR_ID,
						policyVersion: ACTOR_POLICY_VERSION,
						action: "membership.access_request_approved",
						resourceId: REQUEST_ID,
					},
				},
			]);
		});

		it("fails with 409 when another reviewer already decided the request (no membership, no audit)", async () => {
			tx.organizationAccessRequest.updateMany.mockResolvedValue({ count: 0 });

			await expect(
				service.reviewAccessRequest(OWNER_ACTOR, REQUEST_ID, { approve: true, role: "MEMBER", locationScopeType: "ALL_LOCATIONS", locationIds: [] }),
			).rejects.toMatchObject({ code: ORGANIZATION_MEMBERSHIP_ERROR_CODES.accessRequestAlreadyReviewed, httpStatus: 409 });
			expect(tx.organizationMembership.create).not.toHaveBeenCalled();
			expect(tx.organizationAuditLog.create).not.toHaveBeenCalled();
		});

		it("returns 404 for a request that is not in this organization", async () => {
			tx.organizationAccessRequest.findFirst.mockResolvedValue(null);

			await expect(service.reviewAccessRequest(OWNER_ACTOR, REQUEST_ID, { approve: false })).rejects.toBeInstanceOf(NotFoundError);
			expect(tx.organizationAccessRequest.updateMany).not.toHaveBeenCalled();
		});

		it("records a rejection with the real actor", async () => {
			await service.reviewAccessRequest(OWNER_ACTOR, REQUEST_ID, { approve: false });

			expect(tx.organizationMembership.create).not.toHaveBeenCalled();
			expect(tx.organizationAuditLog.create.mock.lastCall).toMatchObject([
				{
					data: { action: "membership.access_request_rejected", actorUserId: ACTOR_ID, policyVersion: ACTOR_POLICY_VERSION },
				},
			]);
		});

		it("forbids a store-scoped reviewer from granting ALL_LOCATIONS or a store outside their scope", async () => {
			await expect(
				service.reviewAccessRequest(STORE_SCOPED_ADMIN, REQUEST_ID, { approve: true, role: "MEMBER", locationScopeType: "ALL_LOCATIONS", locationIds: [] }),
			).rejects.toBeInstanceOf(AuthorizationError);
			await expect(
				service.reviewAccessRequest(STORE_SCOPED_ADMIN, REQUEST_ID, { approve: true, role: "MEMBER", locationScopeType: "SELECTED", locationIds: [STORE_B] }),
			).rejects.toMatchObject({ code: ORGANIZATION_MEMBERSHIP_ERROR_CODES.scopeEscalation });
			expect(tenantTx.withSystemOperation).not.toHaveBeenCalled();
		});

		it("rejects stores that are not active in the organization", async () => {
			tx.organizationLocation.count.mockResolvedValue(0);

			await expect(
				service.reviewAccessRequest(OWNER_ACTOR, REQUEST_ID, { approve: true, role: "MEMBER", locationScopeType: "SELECTED", locationIds: [STORE_B] }),
			).rejects.toMatchObject({ code: ORGANIZATION_MEMBERSHIP_ERROR_CODES.invalidLocations, httpStatus: 400 });
			expect(tx.organizationMembership.create).not.toHaveBeenCalled();
		});

		it("maps the one-live-membership unique violation to 409", async () => {
			tx.organizationMembership.create.mockRejectedValue(uniqueViolation());

			await expect(
				service.reviewAccessRequest(OWNER_ACTOR, REQUEST_ID, { approve: true, role: "MEMBER", locationScopeType: "ALL_LOCATIONS", locationIds: [] }),
			).rejects.toMatchObject({ code: ORGANIZATION_MEMBERSHIP_ERROR_CODES.alreadyMember, httpStatus: 409 });
		});
	});

	describe("createAccessRequest", () => {
		it("maps a concurrent duplicate (pending-request unique violation) to 409 and audits with the org's real policy version", async () => {
			tx.organizationAccessRequest.findFirst.mockResolvedValue(null);
			tx.organizationAccessRequest.create.mockRejectedValueOnce(uniqueViolation());

			await expect(service.createAccessRequest(REQUESTER_ID, ORG_ID, {})).rejects.toMatchObject({
				code: ORGANIZATION_MEMBERSHIP_ERROR_CODES.accessRequestPending,
				httpStatus: 409,
			});

			tx.organizationAccessRequest.create.mockResolvedValueOnce({
				id: REQUEST_ID,
				organizationId: ORG_ID,
				userId: REQUESTER_ID,
				status: "PENDING",
				message: null,
				createdAt: 0n,
			});
			await service.createAccessRequest(REQUESTER_ID, ORG_ID, {});
			expect(tx.organizationAuditLog.create.mock.lastCall).toMatchObject([{ data: { actorUserId: REQUESTER_ID, policyVersion: ORG_POLICY_VERSION } }]);
		});
	});

	describe("team invites", () => {
		const inviteInput: OrganizationMemberInviteInput = { email: "staff@example.com", role: "CASHIER", locationScopeType: "ALL_LOCATIONS", locationIds: [] };

		it("never writes the raw invite token to stdout or logs", async () => {
			const stdout = vi.spyOn(process.stdout, "write");
			emailSender.send.mockResolvedValue({ ok: false, reason: "provider_error" });
			tx.organizationInvitation.create.mockResolvedValue({ id: INVITE_ID });

			await service.inviteMember(OWNER_ACTOR, "Brew", inviteInput);

			const inviteUrl: string = JSON.stringify(emailSender.send.mock.lastCall);
			const token = /token=(?<token>[0-9a-f]+)/.exec(inviteUrl)?.groups?.token ?? "";
			expect(token).toMatch(/^[0-9a-f]{64}$/);
			const written = stdout.mock.calls.map((call) => String(call[LIST_SLOT_INDEX.first])).join("");
			expect(written).not.toContain(token);
			expect(JSON.stringify(logService.warn.mock.calls)).not.toContain(token);
		});

		it("maps a concurrent duplicate pending invite (unique violation) to 409", async () => {
			tx.organizationInvitation.create.mockRejectedValue(uniqueViolation());

			await expect(service.inviteMember(OWNER_ACTOR, "Brew", inviteInput)).rejects.toMatchObject({ code: ORGANIZATION_MEMBERSHIP_ERROR_CODES.invitePending, httpStatus: 409 });
			expect(emailSender.send).not.toHaveBeenCalled();
		});

		it("audits the invite inside the creating transaction", async () => {
			tx.organizationInvitation.create.mockResolvedValue({ id: INVITE_ID });

			await service.inviteMember(OWNER_ACTOR, "Brew", inviteInput);

			expect(tx.organizationAuditLog.create.mock.lastCall).toMatchObject([
				{
					data: { action: "membership.invite_sent", resourceId: INVITE_ID, actorUserId: ACTOR_ID, policyVersion: ACTOR_POLICY_VERSION },
				},
			]);
		});

		it("forbids a store-scoped manager from inviting with ALL_LOCATIONS", async () => {
			await expect(service.inviteMember(STORE_SCOPED_ADMIN, "Brew", inviteInput)).rejects.toBeInstanceOf(AuthorizationError);
		});

		it("revokes only a still-pending invite (compare-and-set) and audits in the same transaction", async () => {
			tx.organizationInvitation.findFirst.mockResolvedValue(teamInvite());
			tx.organizationInvitation.updateMany.mockResolvedValue({ count: 1 });

			await service.revokeInvite(OWNER_ACTOR, INVITE_ID);

			expect(tx.organizationInvitation.updateMany.mock.lastCall).toMatchObject([
				{
					where: { id: INVITE_ID, organizationId: ORG_ID, kind: "TEAM_MEMBER", status: "PENDING" },
					data: { status: "REVOKED" },
				},
			]);
			expect(tx.organizationAuditLog.create.mock.lastCall).toMatchObject([{ data: { action: "membership.invite_revoked", actorUserId: ACTOR_ID } }]);
		});

		it("fails a revoke that lost the race to an accept with 409", async () => {
			tx.organizationInvitation.findFirst.mockResolvedValue(teamInvite());
			tx.organizationInvitation.updateMany.mockResolvedValue({ count: 0 });

			await expect(service.revokeInvite(OWNER_ACTOR, INVITE_ID)).rejects.toMatchObject({ code: ORGANIZATION_MEMBERSHIP_ERROR_CODES.inviteNoLongerPending });
			expect(tx.organizationAuditLog.create).not.toHaveBeenCalled();
		});
	});

	describe("acceptTeamInvite", () => {
		beforeEach(() => {
			tx.organizationInvitation.findFirst.mockResolvedValue(teamInvite());
			tx.organizationMembership.create.mockResolvedValue({ id: "membership-1" });
		});

		it("claims the invite with a compare-and-set on PENDING + unexpired + live organization, then creates the membership and audits", async () => {
			tx.organizationInvitation.updateMany.mockResolvedValue({ count: 1 });

			await expect(service.acceptTeamInvite(REQUESTER_ID, "staff@example.com", INVITE_TOKEN)).resolves.toEqual({ organizationSlug: "brew", message: "Invitation accepted" });

			expect(tx.organizationInvitation.updateMany.mock.lastCall).toMatchObject([
				{
					where: {
						id: INVITE_ID,
						kind: "TEAM_MEMBER",
						status: "PENDING",
						organization: { is: { isDeleted: false } },
					},
					data: { status: "ACCEPTED", acceptedByUserId: REQUESTER_ID },
				},
			]);
			expect(tx.organizationInvitation.updateMany.mock.lastCall?.[LIST_SLOT_INDEX.first]).toHaveProperty("where.expiresAt.gt");
			expect(tx.organizationMembership.create.mock.lastCall).toMatchObject([
				{
					data: {
						userId: REQUESTER_ID,
						role: "CASHIER",
						locationScopes: { create: [{ organizationId: ORG_ID, scopeType: "SELECTED", locationId: STORE_A }] },
					},
				},
			]);
			expect(tx.organizationAuditLog.create.mock.lastCall).toMatchObject([
				{
					data: { action: "membership.invite_accepted", actorUserId: REQUESTER_ID, policyVersion: ORG_POLICY_VERSION },
				},
			]);
		});

		it("fails a double accept / accept after revoke with 409 and creates no membership", async () => {
			tx.organizationInvitation.updateMany.mockResolvedValue({ count: 0 });

			await expect(service.acceptTeamInvite(REQUESTER_ID, "staff@example.com", INVITE_TOKEN)).rejects.toBeInstanceOf(ConflictError);
			expect(tx.organizationMembership.create).not.toHaveBeenCalled();
			expect(tx.organizationAuditLog.create).not.toHaveBeenCalled();
		});

		it("rejects a different signed-in email", async () => {
			await expect(service.acceptTeamInvite(REQUESTER_ID, "other@example.com", INVITE_TOKEN)).rejects.toMatchObject({
				code: ORGANIZATION_MEMBERSHIP_ERROR_CODES.inviteEmailMismatch,
			});
		});
	});

	describe("registerAndAcceptTeamInvite", () => {
		const input = { token: INVITE_TOKEN, fullName: "Staff Member", password: "Str0ng!Passw0rd" };

		beforeEach(() => {
			tx.organizationInvitation.findFirst.mockResolvedValue(teamInvite());
			tx.organizationMembership.create.mockResolvedValue({ id: "membership-1" });
			userProvisioning.createConsumerAccountInTx.mockResolvedValue({ id: REQUESTER_ID });
		});

		it("creates the account and accepts the invite in ONE transaction and returns the identity (no password replay)", async () => {
			tx.organizationInvitation.updateMany.mockResolvedValue({ count: 1 });

			await expect(service.registerAndAcceptTeamInvite(input)).resolves.toEqual({
				organizationSlug: "brew",
				message: "Invitation accepted",
				userId: REQUESTER_ID,
				email: "staff@example.com",
			});

			expect(systemOperations).toContain("organization.invitation.register_and_accept");
			expect(userProvisioning.createConsumerAccountInTx).toHaveBeenCalledWith(tx, { email: "staff@example.com", passwordHash: "password-hash", fullName: "Staff Member" });
			expect(JSON.stringify(userProvisioning.createConsumerAccountInTx.mock.calls)).not.toContain(input.password);
		});

		it("does not keep the account (same transaction fails) and sends no verification email when the invite was already used", async () => {
			tx.organizationInvitation.updateMany.mockResolvedValue({ count: 0 });

			await expect(service.registerAndAcceptTeamInvite(input)).rejects.toMatchObject({ code: ORGANIZATION_MEMBERSHIP_ERROR_CODES.inviteNoLongerPending });
			expect(systemOperations.filter((operation) => operation === "organization.invitation.register_and_accept")).toHaveLength(1);
			expect(emailVerification.sendVerificationEmailIfUnverified).not.toHaveBeenCalled();
		});

		it("maps a concurrent registration for the same email to 409", async () => {
			userProvisioning.createConsumerAccountInTx.mockRejectedValue(uniqueViolation());

			await expect(service.registerAndAcceptTeamInvite(input)).rejects.toMatchObject({ code: ORGANIZATION_MEMBERSHIP_ERROR_CODES.accountExists, httpStatus: 409 });
		});
	});

	describe("roster reads", () => {
		it("run under the actor's real policy version (not 0)", async () => {
			await service.listMembers(OWNER_ACTOR);

			expect(tenantTx.withTenantTransaction.mock.lastCall?.[LIST_SLOT_INDEX.first]).toMatchObject({
				policyVersion: ACTOR_POLICY_VERSION,
				userId: ACTOR_ID,
				organizationId: ORG_ID,
			});
		});
	});
});
