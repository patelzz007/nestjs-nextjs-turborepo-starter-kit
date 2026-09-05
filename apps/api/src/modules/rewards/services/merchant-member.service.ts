import { ConflictException, Injectable } from "@nestjs/common";
import type { MerchantCreateMemberInput, MerchantMemberCreatedResponse } from "@workspace/shared";

import { CryptoService } from "../../auth/services/crypto.service";
import { EmailVerificationService } from "../../auth/services/email-verification.service";
import { UserProvisioningService } from "../../auth/services/user-provisioning.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { MerchantContextService } from "./merchant-context.service";

@Injectable()
export class MerchantMemberService {
	public constructor(
		private readonly prisma: PrismaService,
		private readonly cryptoService: CryptoService,
		private readonly userProvisioning: UserProvisioningService,
		private readonly merchantContext: MerchantContextService,
		private readonly emailVerificationService: EmailVerificationService,
	) {}

	/** Merchant owners create cashier (or other staff) accounts for their org. */
	public async createMember(actorUserId: string, merchantOrgId: string | undefined, input: MerchantCreateMemberInput): Promise<MerchantMemberCreatedResponse> {
		const orgId = await this.merchantContext.resolveOrgIdForUser(actorUserId, merchantOrgId);
		await this.merchantContext.requireOwnerRole(actorUserId, orgId);

		const existingUser = await this.prisma.user.findFirst({
			where: { email: input.email, isDeleted: false },
			select: { id: true, email: true, fullName: true },
		});

		let userId: string;
		let fullName: string;
		let email: string;

		if (existingUser === null) {
			const passwordHash = await this.cryptoService.hash(input.password);
			const created = await this.userProvisioning.createConsumerAccount({
				email: input.email,
				passwordHash,
				fullName: input.fullName,
			});
			userId = created.id;
			fullName = created.fullName;
			email = created.email;
			await this.emailVerificationService.sendVerificationEmailIfUnverified(email, "merchant");
		} else {
			const passwordHash = await this.cryptoService.hash(input.password);
			await this.prisma.user.update({
				where: { id: existingUser.id },
				data: {
					passwordHash,
					fullName: input.fullName,
					updatedAt: Date.now(),
				},
			});
			await this.userProvisioning.ensureDefaultConsumerRole(existingUser.id, actorUserId);
			userId = existingUser.id;
			fullName = input.fullName;
			email = existingUser.email;
		}

		const existingMembership = await this.prisma.merchantMember.findFirst({
			where: { userId, merchantOrgId: orgId, isDeleted: false },
			select: { id: true, role: true },
		});

		if (existingMembership !== null) {
			if (existingMembership.role === input.role) {
				return {
					userId,
					email,
					fullName,
					merchantOrgId: orgId,
					role: existingMembership.role,
				};
			}

			throw new ConflictException({
				message: "This user is already a member of your merchant organization",
				error: "MERCHANT_MEMBER_EXISTS",
			});
		}

		await this.prisma.merchantMember.create({
			data: {
				userId,
				merchantOrgId: orgId,
				role: input.role,
			},
		});

		await this.prisma.rewardAuditLog.create({
			data: {
				merchantOrgId: orgId,
				action: "merchant.member_created",
				metadata: { userId, role: input.role, createdByUserId: actorUserId },
			},
		});

		return {
			userId,
			email,
			fullName,
			merchantOrgId: orgId,
			role: input.role,
		};
	}
}
