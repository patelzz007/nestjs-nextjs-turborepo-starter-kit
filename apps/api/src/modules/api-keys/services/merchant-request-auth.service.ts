import { Injectable, UnauthorizedException } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import { isAuthenticatedUser } from "../../../types/authenticated-user";
import { MerchantContextService } from "../../rewards/services/merchant-context.service";
import { getApiKeyAuthFromRequest } from "../types/api-key-auth-request";
import type { MerchantActor } from "../types/merchant-actor.types";

@Injectable()
export class MerchantRequestAuthService {
	public constructor(private readonly merchantContext: MerchantContextService) {}

	public async resolveFromRequest(request: FastifyRequest, orgSlug: string | undefined): Promise<MerchantActor> {
		const apiKeyAuth = getApiKeyAuthFromRequest(request);

		if (apiKeyAuth !== undefined) {
			const organizationId = this.merchantContext.resolveOrgIdFromApiKey(apiKeyAuth, undefined);
			return {
				kind: "api_key",
				userId: null,
				organizationId,
				orgSlug: orgSlug ?? null,
				apiKeyId: apiKeyAuth.apiKeyId,
			};
		}

		const user = request.user;
		if (!isAuthenticatedUser(user)) {
			throw new UnauthorizedException({
				message: "Organization authentication required",
				error: "ORGANIZATION_AUTH_REQUIRED",
			});
		}

		if (orgSlug === undefined || orgSlug.length === 0) {
			throw new UnauthorizedException({
				message: "Organization slug required",
				error: "ORGANIZATION_SLUG_REQUIRED",
			});
		}

		const organizationId = await this.merchantContext.resolveOrgIdForUser(user.sub, orgSlug);

		return {
			kind: "user",
			userId: user.sub,
			organizationId,
			orgSlug,
			apiKeyId: null,
		};
	}
}
