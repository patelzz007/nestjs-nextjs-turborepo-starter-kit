import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { UserResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import { USER_GRANTS_READ, type UserGrantsReadPort } from "../../../../../platform/application/ports/authorization.port";
import { AccountNotFoundError } from "../../../domain/errors/identity.errors";
import type { AccountView, IdentityReadPort } from "../../ports/identity-read.port";
import { IDENTITY_READ, USER_SESSION_CACHE } from "../../ports/identity.tokens";
import type { UserSessionCachePort } from "../../ports/user-session-cache.port";
import { buildUserResponse } from "../../services/user-response.assembler";
import { GetMeQuery } from "./get-me.query";

/** `/auth/me`: the cached payload, or built from the account and its grants and cached. */
@QueryHandler(GetMeQuery)
export class GetMeHandler implements IQueryHandler<GetMeQuery, UserResponse> {
	public constructor(
		@Inject(IDENTITY_READ) private readonly reads: IdentityReadPort,
		@Inject(USER_GRANTS_READ) private readonly grants: UserGrantsReadPort,
		@Inject(USER_SESSION_CACHE) private readonly cache: UserSessionCachePort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(query: GetMeQuery): Promise<UserResponse> {
		const cached: UserResponse | null = await this.cache.getMe(query.input.userId);
		if (cached !== null) {
			return cached;
		}
		const account: AccountView | null = await this.reads.findAccount(query.actor, query.input.userId);
		if (account === null) {
			throw new AccountNotFoundError();
		}
		const response: UserResponse = buildUserResponse(account, await this.grants.getUserPermissionDetails(account.id), this.clock.now());
		await this.cache.setMe(account.id, response);
		return response;
	}
}
