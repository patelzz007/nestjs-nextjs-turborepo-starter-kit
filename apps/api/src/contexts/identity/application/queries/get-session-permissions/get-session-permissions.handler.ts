import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { SessionPermissionsResponse } from "@workspace/shared";

import { USER_GRANTS_READ, type UserGrantsReadPort } from "../../../../../platform/application/ports/authorization.port";
import { AccountNotFoundError } from "../../../domain/errors/identity.errors";
import type { AccountView, IdentityReadPort } from "../../ports/identity-read.port";
import { IDENTITY_READ, USER_SESSION_CACHE } from "../../ports/identity.tokens";
import type { UserSessionCachePort } from "../../ports/user-session-cache.port";
import { buildSessionPermissions } from "../../services/session-permissions";
import { GetSessionPermissionsQuery } from "./get-session-permissions.query";

/** `/auth/permissions`: the cached base payload, overlaid with what the current access token says about its session. */
@QueryHandler(GetSessionPermissionsQuery)
export class GetSessionPermissionsHandler implements IQueryHandler<GetSessionPermissionsQuery, SessionPermissionsResponse> {
	public constructor(
		@Inject(IDENTITY_READ) private readonly reads: IdentityReadPort,
		@Inject(USER_GRANTS_READ) private readonly grants: UserGrantsReadPort,
		@Inject(USER_SESSION_CACHE) private readonly cache: UserSessionCachePort,
	) {}

	public async execute(query: GetSessionPermissionsQuery): Promise<SessionPermissionsResponse> {
		const { userId, accessPayload } = query.input;
		const base: SessionPermissionsResponse = (await this.cache.getPermissions(userId)) ?? (await this.buildAndCache(query));
		const sessionScope = accessPayload?.sessionScope ?? "full";
		const enrollmentReason = sessionScope === "restricted" ? (accessPayload?.isEmailVerified === false ? "email_verification" : "mfa_enrollment") : undefined;
		return {
			roles: base.roles,
			permissions: base.permissions,
			capabilities: base.capabilities,
			tokenVersion: base.tokenVersion,
			hasAdminAccess: base.hasAdminAccess,
			isImpersonating: accessPayload?.isImpersonating,
			originalUserId: accessPayload?.originalUserId,
			sessionScope,
			enrollmentReason,
		};
	}

	private async buildAndCache(query: GetSessionPermissionsQuery): Promise<SessionPermissionsResponse> {
		const account: AccountView | null = await this.reads.findAccount(query.actor, query.input.userId);
		if (account === null) {
			throw new AccountNotFoundError();
		}
		const [permissions, capabilities] = await Promise.all([this.grants.getUserPermissionDetails(account.id), this.grants.getUserCapabilitySlugs(account.id)]);
		const response: SessionPermissionsResponse = buildSessionPermissions(account, permissions, capabilities);
		await this.cache.setPermissions(account.id, response);
		return response;
	}
}
