import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type {
	MerchantOnboardingCompleteFieldsInput,
	MerchantOnboardingCompleteResponse,
	MerchantOnboardingDocumentsSubmitInput,
	MerchantOnboardingDocumentUploadCompleteInput,
	MerchantOnboardingDocumentUploadUrlInput,
	MerchantOnboardingInvitePreview,
} from "@workspace/shared";
import { buildMerchantSubmittedKybFields, EpochMsSchema } from "@workspace/shared";

import { CryptoService } from "../../auth/services/crypto.service";
import { EmailVerificationService } from "../../auth/services/email-verification.service";
import { UserProvisioningService } from "../../auth/services/user-provisioning.service";
import { FileService } from "../../files/services/file.service";
import { OrganizationProvisioningService } from "../../organization/services/organization-provisioning.service";
import { MerchantInviteRepository } from "../repositories/merchant-invite.repository";
import { MerchantMemberRepository } from "../repositories/merchant-member.repository";
import { MerchantOrgRepository } from "../repositories/merchant-org.repository";
import { RewardAuditLogRepository } from "../repositories/reward-audit-log.repository";
import { RewardUserRepository } from "../repositories/reward-user.repository";
import { MerchantKybDocumentService } from "./merchant-kyb-document.service";
import { sha256Hex } from "../utils/reward-crypto.util";

interface ResolvedMerchantInvite {
	readonly id: string;
	readonly email: string;
	readonly businessName: string;
	readonly city: "KUALA_LUMPUR" | "MELAKA";
	readonly expiresAt: number;
	readonly acceptedAt: number | null;
	readonly acceptedByUserId: string | null;
	readonly merchantOrgId: string | null;
}

@Injectable()
export class MerchantOnboardingService {
	public constructor(
		private readonly merchantInviteRepository: MerchantInviteRepository,
		private readonly merchantOrgRepository: MerchantOrgRepository,
		private readonly merchantMemberRepository: MerchantMemberRepository,
		private readonly rewardUserRepository: RewardUserRepository,
		private readonly auditLogRepository: RewardAuditLogRepository,
		private readonly cryptoService: CryptoService,
		private readonly userProvisioning: UserProvisioningService,
		private readonly emailVerificationService: EmailVerificationService,
		private readonly organizationProvisioning: OrganizationProvisioningService,
		private readonly fileService: FileService,
		private readonly kybDocumentService: MerchantKybDocumentService,
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

		const existingMembership = await this.merchantMemberRepository.findMembershipForOnboarding(userId, invite.businessName, invite.city);

		if (existingMembership !== null) {
			const organizationLink = await this.merchantOrgRepository.findOrganizationLink(existingMembership.merchantOrgId);
			if (organizationLink === null) {
				throw new BadRequestException("Merchant organization is missing canonical organization linkage — contact support");
			}

			await this.merchantOrgRepository.updateMerchantKybSubmission(existingMembership.merchantOrgId, {
				businessName: invite.businessName.trim(),
				legalName: input.legalName.trim(),
				addressText: input.addressText.trim(),
				contactPhone: input.contactPhone.trim(),
				kybFields: buildMerchantSubmittedKybFields(input),
				kybStatus: "PENDING",
			});
			await this.markInviteAccepted(invite.id, userId, existingMembership.merchantOrgId);
			return {
				merchantOrgId: existingMembership.merchantOrgId,
				organizationId: organizationLink.organizationId,
				organizationSlug: organizationLink.organizationSlug,
				businessName: invite.businessName,
				role: existingMembership.role,
			};
		}

		const provisioned = await this.organizationProvisioning.provisionFromMerchantOnboarding({
			userId,
			businessName: invite.businessName,
			category: input.category,
			city: invite.city,
			contactEmail: invite.email,
		});

		const merchantOrg = await this.merchantOrgRepository.createWithOwner({
			businessName: invite.businessName,
			city: invite.city,
			contactEmail: invite.email,
			userId,
			legalName: input.legalName.trim(),
			addressText: input.addressText.trim(),
			contactPhone: input.contactPhone.trim(),
			kybFields: buildMerchantSubmittedKybFields(input),
			category: input.category,
			organizationId: provisioned.organizationId,
			locationId: provisioned.locationId,
		});

		await this.markInviteAccepted(invite.id, userId, merchantOrg.id);

		await this.auditLogRepository.create({
			merchantOrgId: merchantOrg.id,
			action: "merchant.onboarding_completed",
			metadata: { inviteId: invite.id, userId, organizationId: provisioned.organizationId },
		});

		return {
			merchantOrgId: merchantOrg.id,
			organizationId: provisioned.organizationId,
			organizationSlug: provisioned.slug,
			businessName: merchantOrg.businessName,
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
			merchantOrgId: invite.merchantOrgId,
		});
	}

	public async completeDocumentUpload(input: MerchantOnboardingDocumentUploadCompleteInput): ReturnType<FileService["completeUpload"]> {
		const invite = await this.findAcceptedInvite(input.token);
		return this.fileService.completeUpload(invite.acceptedByUserId, input.fileId, { checksumSha256: input.checksumSha256 });
	}

	public async submitDocuments(input: MerchantOnboardingDocumentsSubmitInput): Promise<{ success: true }> {
		const invite = await this.findAcceptedInvite(input.token);
		await this.kybDocumentService.attachSubmittedFileIds(invite.merchantOrgId, input.documentFileIds);
		await this.auditLogRepository.create({
			merchantOrgId: invite.merchantOrgId,
			action: "merchant.kyb_submitted",
			metadata: { userId: invite.acceptedByUserId, source: "onboarding" },
		});
		return { success: true };
	}

	private async findValidInvite(token: string): Promise<ResolvedMerchantInvite> {
		const tokenHash = sha256Hex(token);
		const invite = await this.merchantInviteRepository.findByTokenHash(tokenHash);

		if (invite === null) {
			throw new NotFoundException({ message: "Invalid merchant invite", error: "MERCHANT_INVITE_NOT_FOUND" });
		}

		if (Number(invite.expiresAt) < Date.now()) {
			throw new BadRequestException("This merchant invite has expired");
		}

		return {
			id: invite.id,
			email: invite.email,
			businessName: invite.businessName,
			city: invite.city,
			expiresAt: Number(invite.expiresAt),
			acceptedAt: invite.acceptedAt === null ? null : Number(invite.acceptedAt),
			acceptedByUserId: invite.acceptedByUserId,
			merchantOrgId: invite.merchantOrgId,
		};
	}

	private async findAcceptedInvite(token: string): Promise<ResolvedMerchantInvite & { readonly acceptedByUserId: string; readonly merchantOrgId: string }> {
		const invite = await this.findValidInvite(token);
		if (invite.acceptedAt === null || invite.acceptedByUserId === null || invite.merchantOrgId === null) {
			throw new BadRequestException({ message: "Complete account setup before uploading documents", error: "MERCHANT_ONBOARDING_INCOMPLETE" });
		}
		return { ...invite, acceptedByUserId: invite.acceptedByUserId, merchantOrgId: invite.merchantOrgId };
	}

	private async markInviteAccepted(inviteId: string, userId: string, merchantOrgId: string): Promise<void> {
		await this.merchantInviteRepository.markAccepted(inviteId, userId, merchantOrgId, Date.now());
	}
}
