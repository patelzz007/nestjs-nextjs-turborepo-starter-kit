import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { AdminUserDetail, EpochMs, PaginatedServiceResult } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import { USER_GRANTS_READ, type SlimRole, type UserGrantsReadPort } from "../../../../../platform/application/ports/authorization.port";
import { SIGNUP_REFERRALS, type SignupReferralPort } from "../../../../referrals/public-api";
import type { AdminAccountView, IdentityReadPort } from "../../ports/identity-read.port";
import { IDENTITY_READ } from "../../ports/identity.tokens";
import { isEmailVerifiedAt } from "../../services/user-response.assembler";
import { ListUsersForAdminQuery } from "./list-users-for-admin.query";

/** Roles whose holders the admin list shows as having admin access. */
const ADMIN_ACCESS_ROLE_NAMES: readonly string[] = ["SuperAdmin", "Admin", "Manager"];

/** SuperAdmin user list: one page query, then ONE batched read each for roles and referral facts (no N+1). */
@QueryHandler(ListUsersForAdminQuery)
export class ListUsersForAdminHandler implements IQueryHandler<ListUsersForAdminQuery, PaginatedServiceResult<AdminUserDetail>> {
	public constructor(
		@Inject(IDENTITY_READ) private readonly reads: IdentityReadPort,
		@Inject(USER_GRANTS_READ) private readonly grants: UserGrantsReadPort,
		@Inject(SIGNUP_REFERRALS) private readonly signupReferrals: SignupReferralPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(query: ListUsersForAdminQuery): Promise<PaginatedServiceResult<AdminUserDetail>> {
		const page: PaginatedServiceResult<AdminAccountView> = await this.reads.listAdminAccounts(query.actor, query.input.query);
		const userIds: string[] = page.items.map((account: AdminAccountView): string => account.id);
		const [rolesByUser, referralsByUser] = await Promise.all([this.grants.listRolesOfUsers(userIds), this.signupReferrals.summariesForReferees(userIds)]);
		const now: EpochMs = this.clock.now();
		return {
			...page,
			items: page.items.map((account: AdminAccountView): AdminUserDetail => {
				const roles: readonly SlimRole[] = rolesByUser.get(account.id) ?? [];
				const referral = referralsByUser.get(account.id);
				return {
					id: account.id,
					email: account.email,
					fullName: account.fullName,
					isActive: account.isActive,
					isSuperAdmin: account.isSuperAdmin,
					isEmailVerified: isEmailVerifiedAt(account, now),
					twoFactorEnabled: account.twoFactorEnabled,
					hasAdminAccess: account.isSuperAdmin || roles.some((role: SlimRole): boolean => ADMIN_ACCESS_ROLE_NAMES.includes(role.name)),
					tokenVersion: account.tokenVersion,
					roles: [...roles],
					permissions: [],
					createdAt: account.createdAt,
					updatedAt: account.updatedAt,
					isDeleted: account.isDeleted,
					deletedAt: account.deletedAt,
					failedLoginAttempts: account.failedLoginAttempts,
					lockedUntil: account.lockedUntil,
					directPermissionIds: [],
					signupReferrer: referral?.referrer ?? null,
					signupReferralStatus: referral?.status ?? null,
					ban: account.ban,
				};
			}),
		};
	}
}
