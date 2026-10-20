import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

import type { TillPoint as TillPointValue } from "../../../../application/ports/till-resolution.port";
import { getTillPointFromRequest, type ApiKeyAuthRequest } from "../api-keys/api-key-request";

/** The till the request comes from (tenant, store, terminal and key), as `MerchantApiKeyGuard` resolved it. */
export const TillPoint = createParamDecorator((_data: undefined, ctx: ExecutionContext): TillPointValue =>
	getTillPointFromRequest(ctx.switchToHttp().getRequest<ApiKeyAuthRequest>()),
);
