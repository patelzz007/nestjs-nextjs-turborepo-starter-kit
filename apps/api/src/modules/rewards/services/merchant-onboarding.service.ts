import { BadRequestException, ConflictException, GoneException, Injectable, NotFoundException } from "@nestjs/common";
import {
	buildMerchantSubmittedKybFields,
	EpochMsSchema,
	PilotCitySchema,
	type MerchantOnboardingCompleteFieldsInput,
	type MerchantOnboardingCompleteResponse,
	type MerchantOnboardingDocumentsSubmitInput,
	type MerchantOnboardingDocumentStatusInput,
	type MerchantOnboardingDocumentStatusResponse,
	type MerchantOnboardingDocumentBatchUploadCompleteInput,
	type MerchantOnboardingDocumentBatchUploadCompleteItem,
	type MerchantOnboardingDocumentBatchUploadCompleteResponse,
	type MerchantOnboardingDocumentBatchUploadUrlInput,
	type MerchantOnboardingDocumentBatchUploadUrlResponse,
	type MerchantOnboardingDocumentUploadCompleteInput,
	type MerchantOnboardingDocumentUploadItem,
	type MerchantOnboardingDocumentUploadUrlInput,
	type MerchantOnboardingInvitePreview,
	type PilotCity,
} from "@workspace/shared";

import { sha256Hex } from "../../../common/crypto/sha256";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { CryptoService } from "../../auth/services/crypto.service";
import { EmailVerificationService } from "../../auth/services/email-verification.service";
import { UserProvisioningService } from "../../auth/services/user-provisioning.service";
import { FileService } from "../../files/services/file.service";
import { OrganizationInviteRepository, type OnboardingInviteRow } from "../../organization/repositories/organization-invite.repository";
import { OrganizationRepository } from "../../organization/repositories/organization.repository";
import { OrganizationLocationService } from "../../organization/services/organization-location.service";
import { OrganizationProvisioningService } from "../../organization/services/organization-provisioning.service";
import { isUniqueConstraintViolation } from "../../organization/utils/unique-violation.util";
import { RewardAuditLogRepository } from "../repositories/reward-audit-log.repository";
import { RewardUserRepository } from "../repositories/reward-user.repository";
import { MerchantKybDocumentService } from "./merchant-kyb-document.service";

/**
 * How long after accepting the invite the onboarding token may still be used
 * for KYB documents (upload tickets, completions, one submission). After that,
 * or after the submission consumed it, the merchant uses the signed-in KYB
 * flow (`merchant:manage_verification`).
 */
export const ONBOARDING_DOCUMENTS_WINDOW_MS = 24 * 60 * 60 * 1000;

interface ResolvedMerchantInvite {
	readonly id: string;
	readonly email: string;
	readonly businessName: string;
	readonly city: PilotCity;
	readonly expiresAt: number;
	readonly organizationId: string;
	readonly organizationSlug: string;
}

interface DocumentsWindowInvite extends ResolvedMerchantInvite {
	readonly acceptedByUserId: string;
}

@Injectable()
export class MerchantOnboardingService {
	public constructor(
		private readonly organizationInviteRepository: OrganizationInviteRepository,
		private readonly organizationRepository: OrganizationRepository,
		private readonly rewardUserRepository: RewardUserRepository,
		private readonly auditLogRepository: RewardAuditLogRepository,
		private readonly cryptoService: CryptoService,
		private readonly userProvisioning: UserProvisioningService,
		private readonly emailVerificationService: EmailVerificationService,
		private readonly organizationProvisioning: OrganizationProvisioningService,
		private readonly organizationLocationService: OrganizationLocationService,
		private readonly fileService: FileService,
		private readonly kybDocumentService: MerchantKybDocumentService,
		private readonly tenantTx: TenantTransactionService,
	) {}

	public async validateInviteToken(token: string): Promise<MerchantOnboardingInvitePreview> {
		const invite = await this.findValidInvite(token);
		const existingUser = await this.rewardUserRepository.findOnboardingByEmail(invite.email);
		return {
			email: invite.email,
			businessName: invite.businessName,
			city: invite.city,
			expiresAt: EpochMsSchema.parse(invite.expiresAt),
			hasExistingAccount: existingUser !== null,
		};
	}

	/**
	 * Completes onboarding as a two-phase saga:
	 *
	 * 1. Account (idempotent, outside the transaction): create the invitee's
	 *    account or verify the password of the existing one. Re-running it —
	 *    a retry, or a concurrent request — finds the same account.
	 * 2. One transaction: claim the invite (PENDING + unexpired → ACCEPTED,
	 *    compare-and-set, so exactly one concurrent request wins), owner
	 *    membership, merchant profile, locations, activation and the audit row.
	 *    Any failure rolls all of it back and leaves the invite PENDING for a retry.
	 */
	public async completeOnboarding(input: MerchantOnboardingCompleteFieldsInput): Promise<MerchantOnboardingCompleteResponse> {
		const invite = await this.findValidInvite(input.token);
		const userId = await this.resolveOnboardingAccount(invite.email, input);
		await this.emailVerificationService.sendVerificationEmailIfUnverified(invite.email, "merchant");
		const policyVersion = await this.organizationLocationService.onboardingPolicyVersion(invite.organizationId);

		await this.tenantTx.withSystemOperation(
			{
				operation: "organization.invitation.accept_merchant_onboarding",
				reason: "Complete merchant onboarding (claim invite, owner membership, profile, locations, activation)",
				actorUserId: userId,
			},
			async (tx) => {
				const claimed = await this.organizationInviteRepository.claimPendingOnboardingInviteInTx(tx, invite.id, userId, Date.now());
				if (!claimed) {
					throw new ConflictException({ message: "This merchant invite has already been used or has expired", error: "MERCHANT_INVITE_UNAVAILABLE" });
				}
				await this.organizationProvisioning.ensureOwnerMembershipInTx(tx, invite.organizationId, userId);
				await this.organizationRepository.updateMerchantProfileSubmissionInTx(tx, invite.organizationId, {
					displayName: invite.businessName.trim(),
					category: input.category,
					legalName: input.legalName.trim(),
					addressText: input.primaryLocation.addressText.trim(),
					contactPhone: input.primaryLocation.contactPhone.trim(),
					kybFields: buildMerchantSubmittedKybFields(input),
					kybStatus: "PENDING",
				});
				await this.organizationLocationService.finalizeOnboardingLocationsInTx(tx, {
					organizationId: invite.organizationId,
					userId,
					policyVersion,
					city: invite.city,
					primary: {
						name: input.primaryLocation.name.trim(),
						addressText: input.primaryLocation.addressText.trim(),
						contactPhone: input.primaryLocation.contactPhone.trim(),
					},
					additionalLocations: input.additionalLocations,
				});
				await this.organizationProvisioning.activateAfterOnboardingInTx(tx, invite.organizationId, userId);
				await this.auditLogRepository.create(
					{
						organizationId: invite.organizationId,
						action: "merchant.onboarding_completed",
						metadata: { inviteId: invite.id, userId },
					},
					tx,
				);
			},
		);

		return {
			organizationId: invite.organizationId,
			organizationSlug: invite.organizationSlug,
			businessName: invite.businessName,
			role: "OWNER",
		};
	}

	public async createDocumentUploadUrl(input: MerchantOnboardingDocumentUploadUrlInput): ReturnType<FileService["createUploadUrl"]> {
		const invite = await this.findDocumentsWindowInvite(input.token);
		return this.fileService.createUploadUrl(invite.acceptedByUserId, {
			category: "MERCHANT_KYB",
			fileName: input.fileName,
			mimeType: input.mimeType,
			sizeBytes: input.sizeBytes,
			checksumSha256: input.checksumSha256,
			organizationId: invite.organizationId,
		});
	}

	public async createDocumentUploadUrls(input: MerchantOnboardingDocumentBatchUploadUrlInput): Promise<MerchantOnboardingDocumentBatchUploadUrlResponse> {
		const invite = await this.findDocumentsWindowInvite(input.token);
		const uploads = await Promise.all(
			input.files.map((file: MerchantOnboardingDocumentUploadItem) =>
				this.fileService.createUploadUrl(invite.acceptedByUserId, {
					category: "MERCHANT_KYB",
					fileName: file.fileName,
					mimeType: file.mimeType,
					sizeBytes: file.sizeBytes,
					checksumSha256: file.checksumSha256,
					organizationId: invite.organizationId,
				}),
			),
		);
		return { uploads };
	}

	public async completeDocumentUpload(input: MerchantOnboardingDocumentUploadCompleteInput): ReturnType<FileService["completeUpload"]> {
		const invite = await this.findDocumentsWindowInvite(input.token);
		await this.assertOnboardingKybFile(invite, input.fileId);
		return this.fileService.completeUpload(invite.acceptedByUserId, input.fileId, { checksumSha256: input.checksumSha256 });
	}

	public async completeDocumentUploads(input: MerchantOnboardingDocumentBatchUploadCompleteInput): Promise<MerchantOnboardingDocumentBatchUploadCompleteResponse> {
		const invite = await this.findDocumentsWindowInvite(input.token);
		for (const completion of input.completions) {
			await this.assertOnboardingKybFile(invite, completion.fileId);
		}
		await Promise.all(
			input.completions.map((completion: MerchantOnboardingDocumentBatchUploadCompleteItem) =>
				this.fileService.completeUpload(invite.acceptedByUserId, completion.fileId, {
					checksumSha256: completion.checksumSha256,
				}),
			),
		);
		return { fileIds: input.completions.map((completion: MerchantOnboardingDocumentBatchUploadCompleteItem) => completion.fileId) };
	}

	/**
	 * Attaches the KYB evidence and consumes the onboarding token's document
	 * window, in one transaction: a replayed or concurrent submission finds the
	 * window already consumed. A review that is APPROVED or REJECTED is final.
	 */
	public async submitDocuments(input: MerchantOnboardingDocumentsSubmitInput): Promise<{ success: true }> {
		const invite = await this.findDocumentsWindowInvite(input.token);
		const acceptedSince = Date.now() - ONBOARDING_DOCUMENTS_WINDOW_MS;

		await this.tenantTx.withSystemOperation(
			{
				operation: "organization.invitation.submit_onboarding_documents",
				reason: "Submit onboarding KYB documents and consume the invite's document window",
				actorUserId: invite.acceptedByUserId,
			},
			async (tx) => {
				const consumed = await this.organizationInviteRepository.consumeDocumentsWindowInTx(tx, invite.id, acceptedSince, Date.now());
				if (!consumed) {
					throw this.documentsWindowClosed();
				}
				await this.kybDocumentService.attachSubmittedFileIdsInTx(tx, invite.organizationId, input.documentFileIds, { closedKybStatuses: ["APPROVED", "REJECTED"] });
				await this.auditLogRepository.create(
					{
						organizationId: invite.organizationId,
						action: "merchant.kyb_submitted",
						metadata: { userId: invite.acceptedByUserId, inviteId: invite.id, source: "onboarding" },
					},
					tx,
				);
			},
		);
		return { success: true };
	}

	/**
	 * Scan status of this onboarding's own KYB uploads, for the signed-out
	 * merchant to poll. Same window as the other document endpoints (uniform
	 * 410 once closed); ids that are not this onboarding's uploads are omitted.
	 */
	public async documentStatus(input: MerchantOnboardingDocumentStatusInput): Promise<MerchantOnboardingDocumentStatusResponse> {
		const invite = await this.findDocumentsWindowInvite(input.token);
		return { documents: await this.kybDocumentService.describeOwnUploads(invite.organizationId, invite.acceptedByUserId, input.fileIds) };
	}

	/** Existing account: the password must match. New account: created with the default consumer role. Safe to re-run. */
	private async resolveOnboardingAccount(email: string, input: MerchantOnboardingCompleteFieldsInput): Promise<string> {
		const existingUser = await this.rewardUserRepository.findOnboardingByEmail(email);
		if (existingUser === null) {
			const passwordHash = await this.cryptoService.hash(input.password);
			try {
				const created = await this.userProvisioning.createConsumerAccount({ email, passwordHash, fullName: input.fullName });
				return created.id;
			} catch (error) {
				// A concurrent completion created the account first: continue as the existing-account path.
				if (error instanceof Error && isUniqueConstraintViolation(error)) {
					return this.resolveOnboardingAccount(email, input);
				}
				throw error;
			}
		}

		const passwordMatches = await this.cryptoService.compare(input.password, existingUser.passwordHash);
		if (!passwordMatches) {
			throw new BadRequestException("Invalid password for this email address");
		}
		await this.userProvisioning.ensureDefaultConsumerRole(existingUser.id);
		if (existingUser.fullName !== input.fullName) {
			await this.rewardUserRepository.updateFullName(existingUser.id, input.fullName);
		}
		return existingUser.id;
	}

	/** Onboarding tokens may only touch this organization's KYB uploads. */
	private async assertOnboardingKybFile(invite: DocumentsWindowInvite, fileId: string): Promise<void> {
		const file = await this.fileService.requireFile(fileId);
		if (file.category !== "MERCHANT_KYB" || file.organizationId !== invite.organizationId || file.uploadedById !== invite.acceptedByUserId) {
			throw new NotFoundException({ message: "File not found", error: "FILE_NOT_FOUND" });
		}
	}

	private async findValidInvite(token: string): Promise<ResolvedMerchantInvite> {
		const invite = await this.organizationInviteRepository.findByTokenHash(sha256Hex(token), ["PENDING"]);
		if (invite === null) {
			throw new NotFoundException({ message: "Invalid merchant invite", error: "MERCHANT_INVITE_NOT_FOUND" });
		}
		if (Number(invite.expiresAt) <= Date.now()) {
			throw new GoneException({ message: "This merchant invite has expired", error: "MERCHANT_INVITE_EXPIRED" });
		}
		return this.resolveInvite(invite);
	}

	/**
	 * Post-acceptance access for KYB documents: only within
	 * {@link ONBOARDING_DOCUMENTS_WINDOW_MS} of acceptance and only until the
	 * submission consumed the token — both enforced in the lookup query.
	 */
	private async findDocumentsWindowInvite(token: string): Promise<DocumentsWindowInvite> {
		const invite = await this.organizationInviteRepository.findOpenDocumentsWindowInvite(sha256Hex(token), Date.now() - ONBOARDING_DOCUMENTS_WINDOW_MS);
		const acceptedByUserId = invite?.acceptedByUserId ?? null;
		if (acceptedByUserId === null || invite === null) {
			throw this.documentsWindowClosed();
		}
		return { ...this.resolveInvite(invite), acceptedByUserId };
	}

	private documentsWindowClosed(): GoneException {
		return new GoneException({
			message: "This onboarding link can no longer be used for documents — sign in and submit verification documents from the merchant dashboard",
			error: "MERCHANT_ONBOARDING_DOCUMENTS_CLOSED",
		});
	}

	private resolveInvite(invite: OnboardingInviteRow): ResolvedMerchantInvite {
		if (invite.organization?.merchantProfile == null || invite.organizationId === null) {
			throw new NotFoundException({ message: "Invalid merchant invite", error: "MERCHANT_INVITE_NOT_FOUND" });
		}
		return {
			id: invite.id,
			email: invite.email,
			businessName: invite.organization.displayName,
			city: PilotCitySchema.parse(invite.organization.merchantProfile.city),
			expiresAt: Number(invite.expiresAt),
			organizationId: invite.organizationId,
			organizationSlug: invite.organization.slug,
		};
	}
}
