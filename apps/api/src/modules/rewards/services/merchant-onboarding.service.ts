import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import type { MerchantOnboardingCompleteInput, MerchantOnboardingCompleteResponse, MerchantOnboardingInvitePreview } from "@workspace/shared";
import { EpochMsSchema } from "@workspace/shared";

import { CryptoService } from "../../auth/services/crypto.service";
import { EmailVerificationService } from "../../auth/services/email-verification.service";
import { UserProvisioningService } from "../../auth/services/user-provisioning.service";
import { PrismaService } from "../../../prisma/prisma.service";
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
		private readonly prisma: PrismaService,
		private readonly cryptoService: CryptoService,
		private readonly userProvisioning: UserProvisioningService,
		private readonly emailVerificationService: EmailVerificationService,
	) {}

	public async validateInviteToken(token: string): Promise<MerchantOnboardingInvitePreview> {
		const invite = await this.findValidInvite(token);
		return {
			email: invite.email,
			businessName: invite.businessName,
			city: invite.city,
			expiresAt: EpochMsSchema.parse(invite.expiresAt),
		};
	}

	public async completeOnboarding(input: MerchantOnboardingCompleteInput): Promise<MerchantOnboardingCompleteResponse> {
		const invite = await this.findValidInvite(input.token);

		if (invite.acceptedAt !== null) {
			throw new BadRequestException("This merchant invite has already been accepted");
		}

		const existingUser = await this.prisma.user.findFirst({
			where: { email: invite.email, isDeleted: false },
			select: { id: true, passwordHash: true, fullName: true },
		});

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
				throw new UnauthorizedException("Invalid password for this email address");
			}

			await this.userProvisioning.ensureDefaultConsumerRole(existingUser.id);
			userId = existingUser.id;

			if (existingUser.fullName !== input.fullName) {
				await this.prisma.user.update({
					where: { id: userId },
					data: { fullName: input.fullName, updatedAt: Date.now() },
				});
			}

			await this.emailVerificationService.sendVerificationEmailIfUnverified(invite.email, "merchant");
		}

		const existingMembership = await this.prisma.merchantMember.findFirst({
			where: { userId, isDeleted: false, merchantOrg: { businessName: invite.businessName, city: invite.city, isDeleted: false } },
			select: { merchantOrgId: true, role: true },
		});

		if (existingMembership !== null) {
			await this.markInviteAccepted(invite.id, userId, existingMembership.merchantOrgId);
			return {
				merchantOrgId: existingMembership.merchantOrgId,
				businessName: invite.businessName,
				role: existingMembership.role,
			};
		}

		const merchantOrg = await this.prisma.$transaction(async (tx) => {
			const org = await tx.merchantOrg.create({
				data: {
					businessName: invite.businessName,
					category: "general",
					city: invite.city,
					status: "ONBOARDING",
					contactEmail: invite.email,
				},
			});

			await tx.merchantMember.create({
				data: {
					userId,
					merchantOrgId: org.id,
					role: "OWNER",
				},
			});

			return org;
		});

		await this.markInviteAccepted(invite.id, userId, merchantOrg.id);

		await this.prisma.rewardAuditLog.create({
			data: {
				merchantOrgId: merchantOrg.id,
				action: "merchant.onboarding_completed",
				metadata: { inviteId: invite.id, userId },
			},
		});

		return {
			merchantOrgId: merchantOrg.id,
			businessName: merchantOrg.businessName,
			role: "OWNER",
		};
	}

	private async findValidInvite(token: string): Promise<ResolvedMerchantInvite> {
		const tokenHash = sha256Hex(token);
		const invite = await this.prisma.merchantInvite.findFirst({
			where: { tokenHash, isDeleted: false },
			select: {
				id: true,
				email: true,
				businessName: true,
				city: true,
				expiresAt: true,
				acceptedAt: true,
				merchantOrgId: true,
			},
		});

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
		await this.prisma.merchantInvite.update({
			where: { id: inviteId },
			data: {
				acceptedAt: Date.now(),
				acceptedByUserId: userId,
				merchantOrgId,
				updatedAt: Date.now(),
			},
		});
	}
}
