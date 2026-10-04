import { Injectable } from "@nestjs/common";
import type { Prisma, User } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { DEFAULT_CONSUMER_ROLE_NAME } from "../../authorization/constants/authorization.constants";
import { RoleService } from "../../authorization/services/role.service";

/** Platform role granted to every consumer-facing account (signup, merchant staff, cashiers). */
export { DEFAULT_CONSUMER_ROLE_NAME } from "../../authorization/constants/authorization.constants";

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

	/**
	 * Attach the default consumer role. The account is self-provisioned, so it
	 * is the audited actor (no placeholder actor); the RBAC write, session
	 * revocation and audit row commit together inside `RoleService`.
	 */
	public async assignDefaultConsumerRole(userId: string): Promise<void> {
		await this.roleService.assignDefaultConsumerRole(userId);
	}

	/** Idempotent — `RoleService.assignDefaultConsumerRole` leaves an account that already holds the role untouched. */
	public async ensureDefaultConsumerRole(userId: string): Promise<void> {
		await this.roleService.assignDefaultConsumerRole(userId);
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

	/**
	 * Create the account and its default consumer role on the CALLER's
	 * transaction `tx`, so a flow that provisions an account as one step of a
	 * larger unit (register-and-accept a team invite) commits or rolls back the
	 * account together with everything else. The account is self-provisioned,
	 * so it is the audited actor of the role assignment.
	 */
	public async createConsumerAccountInTx(tx: Prisma.TransactionClient, input: CreateConsumerAccountInput): Promise<User> {
		const role = await this.roleService.findByName(DEFAULT_CONSUMER_ROLE_NAME);
		if (role === null) {
			// Deployment misconfiguration (seed/migration missing), not a client error → 500.
			throw new Error(`Platform role "${DEFAULT_CONSUMER_ROLE_NAME}" is not configured`);
		}

		const user = await tx.user.create({
			data: {
				email: input.email,
				passwordHash: input.passwordHash,
				fullName: input.fullName,
				emailVerifiedAt: input.emailVerifiedAt ?? null,
			},
		});
		await this.roleService.assignToUserAtProvisioningInTx(user.id, role.id, user.id, tx);
		return user;
	}
}
