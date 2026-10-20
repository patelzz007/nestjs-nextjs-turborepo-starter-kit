import { createParamDecorator, type ExecutionContext, UnauthorizedException } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import { getMerchantActorFromRequest } from "../api-keys/api-key-request";
import type { MerchantActor } from "../api-keys/merchant-actor";

/** Extract the resolved merchant actor from the request (set by `MerchantActorInterceptor`). */
export const GetMerchantActor = createParamDecorator((_data: undefined, ctx: ExecutionContext): MerchantActor => {
	const request: FastifyRequest = ctx.switchToHttp().getRequest<FastifyRequest>();
	const actor = getMerchantActorFromRequest(request);

	if (actor === undefined) {
		throw new UnauthorizedException({
			message: "Merchant authentication required",
			error: "MERCHANT_AUTH_REQUIRED",
		});
	}

	return actor;
});
