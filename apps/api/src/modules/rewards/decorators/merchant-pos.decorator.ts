import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import { MERCHANT_POS_CONTEXT_KEY, type MerchantPosContext } from "../types/merchant-pos-context";

export const MerchantPos = createParamDecorator((_data: unknown, ctx: ExecutionContext): MerchantPosContext => {
	const request = ctx.switchToHttp().getRequest<FastifyRequest & { [MERCHANT_POS_CONTEXT_KEY]?: MerchantPosContext }>();
	const context = request[MERCHANT_POS_CONTEXT_KEY];

	if (context === undefined) {
		throw new Error("Merchant POS context missing — apply MerchantApiKeyGuard");
	}

	return context;
});
