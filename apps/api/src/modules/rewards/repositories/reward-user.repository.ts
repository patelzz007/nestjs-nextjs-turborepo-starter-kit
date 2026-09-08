import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";

const USER_ATTRIBUTION_SELECT = {
	pendingAttributionToken: true,
	pendingAttributionExpiresAt: true,
} as const satisfies Prisma.UserSelect;

const USER_EMAIL_SELECT = {
	email: true,
} as const satisfies Prisma.UserSelect;

const USER_ACTIVE_BY_EMAIL_SELECT = {
	id: true,
	email: true,
	fullName: true,
} as const satisfies Prisma.UserSelect;

const USER_ONBOARDING_SELECT = {
	id: true,
	passwordHash: true,
	fullName: true,
} as const satisfies Prisma.UserSelect;

export type UserAttributionFields = Prisma.UserGetPayload<{ select: typeof USER_ATTRIBUTION_SELECT }>;
export type UserEmailFields = Prisma.UserGetPayload<{ select: typeof USER_EMAIL_SELECT }>;
export type UserActiveByEmail = Prisma.UserGetPayload<{ select: typeof USER_ACTIVE_BY_EMAIL_SELECT }>;
export type UserOnboardingFields = Prisma.UserGetPayload<{ select: typeof USER_ONBOARDING_SELECT }>;

const USER_CLAIM_CHECKOUT_SELECT = {
	phone: true,
	phoneVerifiedAt: true,
} as const satisfies Prisma.UserSelect;

export type UserClaimCheckoutFields = Prisma.UserGetPayload<{ select: typeof USER_CLAIM_CHECKOUT_SELECT }>;

@Injectable()
export class RewardUserRepository {
	public constructor(private readonly prisma: PrismaService) {}

	public async findActiveByEmail(email: string): Promise<UserActiveByEmail | null> {
		return this.prisma.user.findFirst({
			where: { email, isDeleted: false },
			select: USER_ACTIVE_BY_EMAIL_SELECT,
		});
	}

	public async findOnboardingByEmail(email: string): Promise<UserOnboardingFields | null> {
		return this.prisma.user.findFirst({
			where: { email, isDeleted: false },
			select: USER_ONBOARDING_SELECT,
		});
	}

	public async findAttributionById(userId: string): Promise<UserAttributionFields | null> {
		return this.prisma.user.findUnique({
			where: { id: userId },
			select: USER_ATTRIBUTION_SELECT,
		});
	}

	public async findEmailById(userId: string): Promise<UserEmailFields | null> {
		return this.prisma.user.findUnique({
			where: { id: userId },
			select: USER_EMAIL_SELECT,
		});
	}

	public async updateCredentials(userId: string, data: { readonly passwordHash: string; readonly fullName: string }): Promise<void> {
		await this.prisma.user.update({
			where: { id: userId },
			data: {
				passwordHash: data.passwordHash,
				fullName: data.fullName,
				updatedAt: Date.now(),
			},
		});
	}

	public async findClaimCheckoutById(userId: string): Promise<UserClaimCheckoutFields | null> {
		return this.prisma.user.findUnique({
			where: { id: userId },
			select: USER_CLAIM_CHECKOUT_SELECT,
		});
	}

	public async updateFullName(userId: string, fullName: string): Promise<void> {
		await this.prisma.user.update({
			where: { id: userId },
			data: { fullName, updatedAt: Date.now() },
		});
	}

	public async updateAfterClaim(
		userId: string,
		data: { readonly phone: string; readonly phoneVerifiedAt: number; readonly pendingAttributionToken: null; readonly pendingAttributionExpiresAt: null },
	): Promise<void> {
		await this.prisma.user.update({
			where: { id: userId },
			data,
		});
	}
}
