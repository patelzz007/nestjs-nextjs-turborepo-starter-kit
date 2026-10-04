import { ConflictException, GoneException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { MerchantOnboardingCompleteFieldsInput } from "@workspace/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { CryptoService } from "../../auth/services/crypto.service";
import { EmailVerificationService } from "../../auth/services/email-verification.service";
import { UserProvisioningService } from "../../auth/services/user-provisioning.service";
import { FileService } from "../../files/services/file.service";
import { OrganizationInviteRepository } from "../../organization/repositories/organization-invite.repository";
import { OrganizationRepository } from "../../organization/repositories/organization.repository";
import { OrganizationLocationService } from "../../organization/services/organization-location.service";
import { OrganizationProvisioningService } from "../../organization/services/organization-provisioning.service";
import { RewardAuditLogRepository } from "../repositories/reward-audit-log.repository";
import { RewardUserRepository } from "../repositories/reward-user.repository";
import { MerchantKybDocumentService } from "./merchant-kyb-document.service";
import { MerchantOnboardingService, ONBOARDING_DOCUMENTS_WINDOW_MS } from "./merchant-onboarding.service";

const INVITE_ID = "6f0c1d2e-3a4b-4c5d-8e9f-0a1b2c3d4e5f";
const ORG_ID = "a178a4d1-6915-4eb3-bf84-6fb14e1feb6c";
const USER_ID = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";
const FILE_ID = "0b7c2a5e-6f1d-4c2e-9d3a-1f2e3d4c5b6a";
const TOKEN = "invite-token";
const NOW = 1_800_000_000_000;
const DAY_MS = 24 * 60 * 60 * 1000;

function inviteRow(
	overrides: { status?: "PENDING" | "ACCEPTED"; expiresAt?: number; acceptedByUserId?: string | null } = {},
): Awaited<ReturnType<OrganizationInviteRepository["findByTokenHash"]>> {
	return {
		id: INVITE_ID,
		organizationId: ORG_ID,
		email: "owner@brew.example",
		tokenHash: "hash",
		kind: "PLATFORM_ONBOARDING",
		intendedRole: "OWNER",
		locationScopeType: "ALL_LOCATIONS",
		status: overrides.status ?? "PENDING",
		createdByAdminId: USER_ID,
		acceptedByUserId: overrides.acceptedByUserId ?? null,
		expiresAt: BigInt(overrides.expiresAt ?? NOW + DAY_MS),
		acceptedAt: overrides.status === "ACCEPTED" ? BigInt(NOW - DAY_MS / 2) : null,
		documentsSubmittedAt: null,
		createdAt: BigInt(NOW - DAY_MS),
		updatedAt: BigInt(NOW - DAY_MS),
		organization: { id: ORG_ID, slug: "brew-bean-kl", displayName: "Brew & Bean", merchantProfile: { city: "KUALA_LUMPUR", kybStatus: "PENDING" } },
	};
}

const COMPLETE_INPUT: MerchantOnboardingCompleteFieldsInput = {
	token: TOKEN,
	password: "Str0ngPassword!",
	fullName: "Brew Owner",
	category: "cafe",
	legalName: "Brew & Bean Sdn Bhd",
	primaryLocation: { name: "Bangsar", addressText: "1 Jalan Telawi", contactPhone: "+60123456789" },
	registrationNo: "202301000001",
	taxId: "C1234567890",
	documentType: "SSM",
	additionalLocations: [],
};

describe("MerchantOnboardingService", () => {
	let service: MerchantOnboardingService;
	const tx = {};
	const invites = {
		findByTokenHash: vi.fn(),
		findOpenDocumentsWindowInvite: vi.fn(),
		claimPendingOnboardingInviteInTx: vi.fn(),
		consumeDocumentsWindowInTx: vi.fn(),
	};
	const provisioning = { ensureOwnerMembershipInTx: vi.fn(), activateAfterOnboardingInTx: vi.fn() };
	const locations = { onboardingPolicyVersion: vi.fn().mockResolvedValue(1), finalizeOnboardingLocationsInTx: vi.fn() };
	const organizations = { updateMerchantProfileSubmissionInTx: vi.fn() };
	const users = { findOnboardingByEmail: vi.fn().mockResolvedValue({ id: USER_ID, passwordHash: "hash", fullName: "Brew Owner" }), updateFullName: vi.fn() };
	const kybDocuments = { attachSubmittedFileIdsInTx: vi.fn(), describeOwnUploads: vi.fn() };
	const files = { createUploadUrl: vi.fn(), completeUpload: vi.fn(), requireFile: vi.fn() };
	const audit = { create: vi.fn() };
	const tenantTx = { withSystemOperation: vi.fn(async (_context: object, work: (client: object) => Promise<void>): Promise<void> => work(tx)) };

	beforeEach(async () => {
		vi.clearAllMocks();
		vi.spyOn(Date, "now").mockReturnValue(NOW);
		const moduleRef = await Test.createTestingModule({
			providers: [
				MerchantOnboardingService,
				{ provide: OrganizationInviteRepository, useValue: invites },
				{ provide: OrganizationRepository, useValue: organizations },
				{ provide: RewardUserRepository, useValue: users },
				{ provide: RewardAuditLogRepository, useValue: audit },
				{ provide: CryptoService, useValue: { hash: vi.fn(), compare: vi.fn().mockResolvedValue(true) } },
				{ provide: UserProvisioningService, useValue: { createConsumerAccount: vi.fn(), ensureDefaultConsumerRole: vi.fn() } },
				{ provide: EmailVerificationService, useValue: { sendVerificationEmailIfUnverified: vi.fn() } },
				{ provide: OrganizationProvisioningService, useValue: provisioning },
				{ provide: OrganizationLocationService, useValue: locations },
				{ provide: FileService, useValue: files },
				{ provide: MerchantKybDocumentService, useValue: kybDocuments },
				{ provide: TenantTransactionService, useValue: tenantTx },
			],
		}).compile();
		service = moduleRef.get(MerchantOnboardingService);
	});

	describe("completeOnboarding", () => {
		it("rejects an expired invite with 410 before touching anything", async () => {
			invites.findByTokenHash.mockResolvedValue(inviteRow({ expiresAt: NOW - 1 }));

			await expect(service.completeOnboarding(COMPLETE_INPUT)).rejects.toBeInstanceOf(GoneException);
			expect(tenantTx.withSystemOperation).not.toHaveBeenCalled();
		});

		it("claims the invite first, then runs every step in the same transaction", async () => {
			invites.findByTokenHash.mockResolvedValue(inviteRow());
			invites.claimPendingOnboardingInviteInTx.mockResolvedValue(true);

			await service.completeOnboarding(COMPLETE_INPUT);

			expect(invites.claimPendingOnboardingInviteInTx).toHaveBeenCalledWith(tx, INVITE_ID, USER_ID, NOW);
			expect(provisioning.ensureOwnerMembershipInTx).toHaveBeenCalledWith(tx, ORG_ID, USER_ID);
			expect(organizations.updateMerchantProfileSubmissionInTx.mock.lastCall?.[0]).toBe(tx);
			expect(locations.finalizeOnboardingLocationsInTx.mock.lastCall?.[0]).toBe(tx);
			expect(provisioning.activateAfterOnboardingInTx).toHaveBeenCalledWith(tx, ORG_ID, USER_ID);
			expect(audit.create.mock.lastCall?.[1]).toBe(tx);
		});

		it("a replayed or concurrent completion loses the claim: 409 and no further step runs", async () => {
			invites.findByTokenHash.mockResolvedValue(inviteRow());
			invites.claimPendingOnboardingInviteInTx.mockResolvedValue(false);

			await expect(service.completeOnboarding(COMPLETE_INPUT)).rejects.toBeInstanceOf(ConflictException);
			expect(provisioning.ensureOwnerMembershipInTx).not.toHaveBeenCalled();
			expect(provisioning.activateAfterOnboardingInTx).not.toHaveBeenCalled();
		});
	});

	describe("document window", () => {
		it("status polling answers 410 once the window is closed or the token consumed", async () => {
			invites.findOpenDocumentsWindowInvite.mockResolvedValue(null);

			await expect(service.documentStatus({ token: TOKEN, fileIds: [FILE_ID] })).rejects.toBeInstanceOf(GoneException);
			expect(kybDocuments.describeOwnUploads).not.toHaveBeenCalled();
		});

		it("status polling only ever looks at this onboarding's own KYB uploads", async () => {
			invites.findOpenDocumentsWindowInvite.mockResolvedValue(inviteRow({ status: "ACCEPTED", acceptedByUserId: USER_ID }));
			kybDocuments.describeOwnUploads.mockResolvedValue([]);

			await expect(service.documentStatus({ token: TOKEN, fileIds: [FILE_ID] })).resolves.toEqual({ documents: [] });
			expect(kybDocuments.describeOwnUploads).toHaveBeenCalledWith(ORG_ID, USER_ID, [FILE_ID]);
		});

		it("looks the token up only inside the window after acceptance", async () => {
			invites.findOpenDocumentsWindowInvite.mockResolvedValue(null);

			await expect(
				service.createDocumentUploadUrl({ token: TOKEN, fileName: "a.pdf", mimeType: "application/pdf", sizeBytes: 10, checksumSha256: "a".repeat(64) }),
			).rejects.toBeInstanceOf(GoneException);
			expect(invites.findOpenDocumentsWindowInvite).toHaveBeenCalledWith(expect.any(String), NOW - ONBOARDING_DOCUMENTS_WINDOW_MS);
			expect(files.createUploadUrl).not.toHaveBeenCalled();
		});

		it("never lets an onboarding token complete another organization's upload", async () => {
			invites.findOpenDocumentsWindowInvite.mockResolvedValue(inviteRow({ status: "ACCEPTED", acceptedByUserId: USER_ID }));
			files.requireFile.mockResolvedValue({ id: FILE_ID, category: "MERCHANT_KYB", organizationId: "c178a4d1-6915-4eb3-bf84-6fb14e1feb6d", uploadedById: USER_ID });

			await expect(service.completeDocumentUpload({ token: TOKEN, fileId: FILE_ID, checksumSha256: "a".repeat(64) })).rejects.toBeInstanceOf(NotFoundException);
			expect(files.completeUpload).not.toHaveBeenCalled();
		});

		it("consumes the token on submit; a replayed submit finds it consumed (410) and attaches nothing", async () => {
			invites.findOpenDocumentsWindowInvite.mockResolvedValue(inviteRow({ status: "ACCEPTED", acceptedByUserId: USER_ID }));
			invites.consumeDocumentsWindowInTx.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

			await expect(service.submitDocuments({ token: TOKEN, documentFileIds: [FILE_ID] })).resolves.toEqual({ success: true });
			expect(kybDocuments.attachSubmittedFileIdsInTx).toHaveBeenCalledWith(tx, ORG_ID, [FILE_ID], { closedKybStatuses: ["APPROVED", "REJECTED"] });

			await expect(service.submitDocuments({ token: TOKEN, documentFileIds: [FILE_ID] })).rejects.toBeInstanceOf(GoneException);
			expect(kybDocuments.attachSubmittedFileIdsInTx).toHaveBeenCalledTimes(1);
		});
	});
});
