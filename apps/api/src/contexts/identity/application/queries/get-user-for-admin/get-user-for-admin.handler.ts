import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { AdminUserDetail } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import { USER_GRANTS_READ, type UserGrantsReadPort } from "../../../../../platform/application/ports/authorization.port";
import { SIGNUP_REFERRALS, type SignupReferralPort } from "../../../../referrals/public-api";
import { AccountNotFoundError } from "../../../domain/errors/identity.errors";
import type { AdminAccountView, IdentityReadPort } from "../../ports/identity-read.port";
import { IDENTITY_READ } from "../../ports/identity.tokens";
import { buildUserResponse } from "../../services/user-response.assembler";
import { GetUserForAdminQuery } from "./get-user-for-admin.query";

@QueryHandler(GetUserForAdminQuery)
export class GetUserForAdminHandler implements IQueryHandler<GetUserForAdminQuery, AdminUserDetail> {
	public constructor(
		@Inject(IDENTITY_READ) private readonly reads: IdentityReadPort,
		@Inject(USER_GRANTS_READ) private readonly grants: UserGrantsReadPort,
		@Inject(SIGNUP_REFERRALS) private readonly signupReferrals: SignupReferralPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(query: GetUserForAdminQuery): Promise<AdminUserDetail> {
		const account: AdminAccountView | null = await this.reads.findAdminAccount(query.actor, query.input.userId);
		if (account === null) {
			throw new AccountNotFoundError();
		}
		const [permissions, directPermissionIds, referral] = await Promise.all([
			this.grants.getUserPermissionDetails(account.id),
			this.grants.getUserDirectPermissionIds(account.id),
			this.signupReferrals.summaryForReferee(account.id),
		]);
		return {
			...buildUserResponse(account, permissions, this.clock.now()),
			permissions: permissions.permissions,
			failedLoginAttempts: account.failedLoginAttempts,
			lockedUntil: account.lockedUntil,
			directPermissionIds: [...directPermissionIds],
			signupReferrer: referral?.referrer ?? null,
			signupReferralStatus: referral?.status ?? null,
		};
	}
}
