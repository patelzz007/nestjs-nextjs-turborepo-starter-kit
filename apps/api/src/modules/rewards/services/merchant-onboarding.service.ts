import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
	buildMerchantSubmittedKybFields,
	EpochMsSchema,
	PilotCitySchema,
	type MerchantOnboardingCompleteFieldsInput,
	type MerchantOnboardingCompleteResponse,
	type MerchantOnboardingDocumentsSubmitInput,
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

import { CryptoService } from "../../auth/services/crypto.service";
import { EmailVerificationService } from "../../auth/services/email-verification.service";
import { UserProvisioningService } from "../../auth/services/user-provisioning.service";
import { FileService } from "../../files/services/file.service";
import { OrganizationInviteRepository } from "../../organization/repositories/organization-invite.repository";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { OrganizationRepository } from "../../organization/repositories/organization.repository";
import { OrganizationLocationService } from "../../organization/services/organization-location.service";
import { OrganizationProvisioningService } from "../../organization/services/organization-provisioning.service";
import { RewardAuditLogRepository } from "../repositories/reward-audit-log.repository";
import { RewardUserRepository } from "../repositories/reward-user.repository";
import { MerchantKybDocumentService } from "./merchant-kyb-document.service";
import { sha256Hex } from "../utils/reward-crypto.util";

interface ResolvedMerchantInvite {
	readonly id: string;
	readonly email: string;
	readonly businessName: string;
	readonly city: PilotCity;
	readonly expiresAt: number;
	readonly acceptedAt: number | null;
	readonly acceptedByUserId: string | null;
	readonly organizationId: string;
	readonly organizationSlug: string;
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

	public async completeOnboarding(input: MerchantOnboardingCompleteFieldsInput): Promise<MerchantOnboardingCompleteResponse> {
		const invite = await this.findValidInvite(input.token);

		const existingUser = await this.rewardUserRepository.findOnboardingByEmail(invite.email);

		let userId: string;

		if (existingUser === null) {
			const passwordHash = await this.cryptoService.hash(input.password);
			const created = await this.userProvisioning.createConsumerAccount({
				email: invite.email,
				passwordHash,
				fullName: input.fullName,
			});
			userId = created.id;
			await this.emailVerificationService.sendVerificationEmailIfUnverified(invite.email, "merchant");
		} else {
			const passwordMatches = await this.cryptoService.compare(input.password, existingUser.passwordHash);
			if (!passwordMatches) {
				throw new BadRequestException("Invalid password for this email address");
			}

			await this.userProvisioning.ensureDefaultConsumerRole(existingUser.id);
			userId = existingUser.id;

			if (existingUser.fullName !== input.fullName) {
				await this.rewardUserRepository.updateFullName(userId, input.fullName);
			}

			await this.emailVerificationService.sendVerificationEmailIfUnverified(invite.email, "merchant");
		}

		await this.organizationProvisioning.ensureOwnerMembership(invite.organizationId, userId);

		await this.organizationRepository.updateMerchantProfileSubmission(invite.organizationId, {
			displayName: invite.businessName.trim(),
			category: input.category,
			legalName: input.legalName.trim(),
			addressText: input.primaryLocation.addressText.trim(),
			contactPhone: input.primaryLocation.contactPhone.trim(),
			kybFields: buildMerchantSubmittedKybFields(input),
			kybStatus: "PENDING",
		});

		await this.organizationLocationService.finalizeOnboardingLocations(
			invite.organizationId,
			userId,
			invite.city,
			{
				name: input.primaryLocation.name.trim(),
				addressText: input.primaryLocation.addressText.trim(),
				contactPhone: input.primaryLocation.contactPhone.trim(),
			},
			input.additionalLocations,
		);

		await this.organizationProvisioning.activateOrganization(invite.organizationId, userId);
		await this.tenantTx.withSystemOperation(
			{
				operation: "organization.provision",
				reason: "Mark merchant onboarding invitation accepted",
				correlationId: `merchant-onboarding-accept:${invite.id}`,
				actorUserId: userId,
			},
			async (tx) => {
				await this.organizationInviteRepository.markAcceptedInTx(tx, invite.id, userId, Date.now());
			},
		);

		await this.auditLogRepository.create({
			organizationId: invite.organizationId,
			action: "merchant.onboarding_completed",
			metadata: { inviteId: invite.id, userId },
		});

		return {
			organizationId: invite.organizationId,
			organizationSlug: invite.organizationSlug,
			businessName: invite.businessName,
			role: "OWNER",
		};
	}

	public async createDocumentUploadUrl(input: MerchantOnboardingDocumentUploadUrlInput): ReturnType<FileService["createUploadUrl"]> {
		const invite = await this.findAcceptedInvite(input.token);
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
		const invite = await this.findAcceptedInvite(input.token);
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
		const invite = await this.findAcceptedInvite(input.token);
		return this.fileService.completeUpload(invite.acceptedByUserId, input.fileId, { checksumSha256: input.checksumSha256 });
	}

	public async completeDocumentUploads(input: MerchantOnboardingDocumentBatchUploadCompleteInput): Promise<MerchantOnboardingDocumentBatchUploadCompleteResponse> {
		const invite = await this.findAcceptedInvite(input.token);
		await Promise.all(
			input.completions.map((completion: MerchantOnboardingDocumentBatchUploadCompleteItem) =>
				this.fileService.completeUpload(invite.acceptedByUserId, completion.fileId, {
					checksumSha256: completion.checksumSha256,
				}),
			),
		);
		return { fileIds: input.completions.map((completion: MerchantOnboardingDocumentBatchUploadCompleteItem) => completion.fileId) };
	}

	public async submitDocuments(input: MerchantOnboardingDocumentsSubmitInput): Promise<{ success: true }> {
		const invite = await this.findAcceptedInvite(input.token);
		await this.kybDocumentService.attachSubmittedFileIds(invite.organizationId, input.documentFileIds);
		await this.auditLogRepository.create({
			organizationId: invite.organizationId,
			action: "merchant.kyb_submitted",
			metadata: { userId: invite.acceptedByUserId, source: "onboarding" },
		});
		return { success: true };
	}

	private async findValidInvite(token: string): Promise<ResolvedMerchantInvite> {
		const tokenHash = sha256Hex(token);
		const invite = await this.organizationInviteRepository.findByTokenHash(tokenHash, ["PENDING"]);

		if (invite?.organization?.merchantProfile == null) {
			throw new NotFoundException({ message: "Invalid merchant invite", error: "MERCHANT_INVITE_NOT_FOUND" });
		}

		if (Number(invite.expiresAt) < Date.now()) {
			throw new BadRequestException("This merchant invite has expired");
		}

		if (invite.organizationId === null) {
			throw new BadRequestException({ message: "Invite is missing organization linkage", error: "MERCHANT_INVITE_INVALID" });
		}

		const city: PilotCity = PilotCitySchema.parse(invite.organization.merchantProfile.city);

		return {
			id: invite.id,
			email: invite.email,
			businessName: invite.organization.displayName,
			city,
			expiresAt: Number(invite.expiresAt),
			acceptedAt: invite.acceptedAt === null ? null : Number(invite.acceptedAt),
			acceptedByUserId: invite.acceptedByUserId,
			organizationId: invite.organizationId,
			organizationSlug: invite.organization.slug,
		};
	}

	private async findAcceptedInvite(token: string): Promise<ResolvedMerchantInvite & { readonly acceptedByUserId: string; readonly organizationId: string }> {
		const tokenHash = sha256Hex(token);
		const invite = await this.organizationInviteRepository.findByTokenHash(tokenHash, ["ACCEPTED"]);

		if (invite?.organization?.merchantProfile == null || invite.organizationId === null) {
			throw new NotFoundException({ message: "Invalid merchant invite", error: "MERCHANT_INVITE_NOT_FOUND" });
		}

		if (invite.acceptedAt === null || invite.acceptedByUserId === null) {
			throw new BadRequestException({ message: "Complete account setup before uploading documents", error: "MERCHANT_ONBOARDING_INCOMPLETE" });
		}

		const city: PilotCity = PilotCitySchema.parse(invite.organization.merchantProfile.city);

		return {
			id: invite.id,
			email: invite.email,
			businessName: invite.organization.displayName,
			city,
			expiresAt: Number(invite.expiresAt),
			acceptedAt: Number(invite.acceptedAt),
			acceptedByUserId: invite.acceptedByUserId,
			organizationId: invite.organizationId,
			organizationSlug: invite.organization.slug,
		};
	}
}
