import { Injectable, InternalServerErrorException } from "@nestjs/common";
import type { User } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { RoleService } from "../../authorization/services/role.service";

/** Platform role granted to every consumer-facing account (signup, merchant staff, cashiers). */
export const DEFAULT_CONSUMER_ROLE_NAME = "User";

export interface CreateConsumerAccountInput {
	readonly email: string;
	readonly passwordHash: string;
	readonly fullName: string;
	readonly emailVerifiedAt?: number | null;
}

/**
 * Creates consumer accounts and assigns the default platform `User` role.
 *
 * Used by signup, merchant onboarding, and merchant staff provisioning so RBAC
 * stays consistent (audit log, token version bump, cache invalidation).
 */
@Injectable()
export class UserProvisioningService {
	public constructor(
		private readonly prisma: PrismaService,
		private readonly roleService: RoleService,
	) {}

	public async assignDefaultConsumerRole(userId: string, actorId = "system"): Promise<void> {
		const role = await this.roleService.findByName(DEFAULT_CONSUMER_ROLE_NAME);
		if (role === null) {
			throw new InternalServerErrorException(`Platform role "${DEFAULT_CONSUMER_ROLE_NAME}" is not configured`);
		}

		await this.roleService.assignToUser(userId, role.id, actorId);
	}

	/** Idempotent — skips when the user already holds the default consumer role. */
	public async ensureDefaultConsumerRole(userId: string, actorId = "system"): Promise<void> {
		const role = await this.roleService.findByName(DEFAULT_CONSUMER_ROLE_NAME);
		if (role === null) {
			throw new InternalServerErrorException(`Platform role "${DEFAULT_CONSUMER_ROLE_NAME}" is not configured`);
		}

		const existing = await this.prisma.userRole.findFirst({
			where: { userId, roleId: role.id, isDeleted: false },
			select: { id: true },
		});

		if (existing !== null) {
			return;
		}

		await this.roleService.assignToUser(userId, role.id, actorId);
	}

	public async createConsumerAccount(input: CreateConsumerAccountInput): Promise<User> {
		const user = await this.prisma.user.create({
			data: {
				email: input.email,
				passwordHash: input.passwordHash,
				fullName: input.fullName,
				emailVerifiedAt: input.emailVerifiedAt ?? null,
			},
		});

		await this.assignDefaultConsumerRole(user.id);
		return user;
	}
}
