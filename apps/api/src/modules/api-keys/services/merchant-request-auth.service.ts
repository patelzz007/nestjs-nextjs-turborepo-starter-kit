import { Injectable, UnauthorizedException } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import { isAuthenticatedUser } from "../../../types/authenticated-user";
import { MerchantContextService } from "../../rewards/services/merchant-context.service";
import { getApiKeyAuthFromRequest } from "../types/api-key-auth-request";
import type { MerchantActor } from "../types/merchant-actor.types";

@Injectable()
export class MerchantRequestAuthService {
	public constructor(private readonly merchantContext: MerchantContextService) {}

	public async resolveFromRequest(request: FastifyRequest, requestedOrgId: string | undefined): Promise<MerchantActor> {
		const apiKeyAuth = getApiKeyAuthFromRequest(request);

		if (apiKeyAuth !== undefined) {
			const merchantOrgId = this.merchantContext.resolveOrgIdFromApiKey(apiKeyAuth, requestedOrgId);
			return {
				kind: "api_key",
				userId: null,
				merchantOrgId,
				apiKeyId: apiKeyAuth.apiKeyId,
			};
		}

		const user = request.user;
		if (!isAuthenticatedUser(user)) {
			throw new UnauthorizedException({
				message: "Merchant authentication required",
				error: "MERCHANT_AUTH_REQUIRED",
			});
		}

		const merchantOrgId = await this.merchantContext.resolveOrgIdForUser(user.sub, requestedOrgId);

		return {
			kind: "user",
			userId: user.sub,
			merchantOrgId,
			apiKeyId: null,
		};
	}
}
