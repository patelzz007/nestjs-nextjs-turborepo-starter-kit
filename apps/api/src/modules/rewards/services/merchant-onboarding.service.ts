import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { JsonObject, MerchantOnboardingCompleteInput, MerchantOnboardingCompleteResponse, MerchantOnboardingInvitePreview } from "@workspace/shared";
import { EpochMsSchema, JsonObjectSchema, nowEpochMs } from "@workspace/shared";

import { CryptoService } from "../../auth/services/crypto.service";
import { EmailVerificationService } from "../../auth/services/email-verification.service";
import { UserProvisioningService } from "../../auth/services/user-provisioning.service";
import { MerchantInviteRepository } from "../repositories/merchant-invite.repository";
import { MerchantMemberRepository } from "../repositories/merchant-member.repository";
import { MerchantOrgRepository } from "../repositories/merchant-org.repository";
import { RewardAuditLogRepository } from "../repositories/reward-audit-log.repository";
import { RewardUserRepository } from "../repositories/reward-user.repository";
import { sha256Hex } from "../utils/reward-crypto.util";

interface ResolvedMerchantInvite {
	readonly id: string;
	readonly email: string;
	readonly businessName: string;
	readonly city: "KUALA_LUMPUR" | "MELAKA";
	readonly expiresAt: number;
	readonly acceptedAt: number | null;
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

	public async completeOnboarding(input: MerchantOnboardingCompleteInput): Promise<MerchantOnboardingCompleteResponse> {
		const invite = await this.findValidInvite(input.token);

		if (invite.acceptedAt !== null) {
			throw new BadRequestException("This merchant invite has already been accepted");
		}

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
			await this.markInviteAccepted(invite.id, userId, existingMembership.merchantOrgId);
			return {
				merchantOrgId: existingMembership.merchantOrgId,
				businessName: invite.businessName,
				role: existingMembership.role,
			};
		}

		const submittedAt = nowEpochMs();
		const kybFields: JsonObject = JsonObjectSchema.parse({
			registrationNo: input.registrationNo.trim(),
			taxId: input.taxId.trim(),
			documentType: input.documentType.trim(),
			submittedAt,
			documents: input.documents.map((document) => ({
				fileName: document.fileName.trim(),
				mimeType: document.mimeType,
				sizeBytes: document.sizeBytes,
				contentBase64: document.contentBase64,
				uploadedAt: submittedAt,
			})),
		});
		const merchantOrg = await this.merchantOrgRepository.createWithOwner({
			businessName: invite.businessName,
			city: invite.city,
			contactEmail: invite.email,
			userId,
			legalName: input.legalName.trim(),
			addressText: input.addressText.trim(),
			contactPhone: input.contactPhone.trim(),
			kybFields,
		});

		await this.markInviteAccepted(invite.id, userId, merchantOrg.id);

		await this.auditLogRepository.create({
			merchantOrgId: merchantOrg.id,
			action: "merchant.onboarding_completed",
			metadata: { inviteId: invite.id, userId },
		});

		return {
			merchantOrgId: merchantOrg.id,
			businessName: merchantOrg.businessName,
			role: "OWNER",
		};
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
			merchantOrgId: invite.merchantOrgId,
		};
	}

	private async markInviteAccepted(inviteId: string, userId: string, merchantOrgId: string): Promise<void> {
		await this.merchantInviteRepository.markAccepted(inviteId, userId, merchantOrgId, Date.now());
	}
}
