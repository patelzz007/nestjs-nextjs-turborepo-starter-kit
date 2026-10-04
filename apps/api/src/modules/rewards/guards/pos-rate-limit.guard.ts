import { CanActivate, ExecutionContext, HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { ThrottlerStorage } from "@nestjs/throttler";
import type { FastifyRequest } from "fastify";

import { MERCHANT_POS_CONTEXT_KEY, type MerchantPosContext } from "../types/merchant-pos-context";

/** Window of the per-API-key POS limit. */
export const POS_RATE_LIMIT_TTL_MS = 60_000;

/**
 * Redemption calls one API key may make per window. A till scans a few codes a
 * minute; a busy store's integration key stays far below. Counted per KEY, not
 * per IP: stores behind one NAT must not throttle each other, and a key cannot
 * escape its limit by changing (or spoofing) its source address.
 */
export const POS_RATE_LIMIT_PER_KEY = 120;

/** Name of this limiter in the shared throttler store. */
const POS_THROTTLER_NAME = "pos";

/** Exceeding the limit does not add a separate block period: the window simply has to roll over. */
const NO_BLOCK_DURATION_MS = 0;

/**
 * Per-API-key rate limit for `/redemptions/*`. Runs AFTER `MerchantApiKeyGuard`
 * (which authenticates the key and attaches the POS context) — list it second
 * in `@UseGuards`. The per-IP auth throttlers are skipped on these routes.
 */
@Injectable()
export class PosRateLimitGuard implements CanActivate {
	public constructor(@Inject(ThrottlerStorage) private readonly storage: ThrottlerStorage) {}

	public async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<FastifyRequest & { [MERCHANT_POS_CONTEXT_KEY]?: MerchantPosContext }>();
		const pos = request[MERCHANT_POS_CONTEXT_KEY];
		if (pos === undefined) {
			throw new Error("Merchant POS context missing — list MerchantApiKeyGuard before PosRateLimitGuard");
		}
		const record = await this.storage.increment(`pos:${pos.apiKeyId}`, POS_RATE_LIMIT_TTL_MS, POS_RATE_LIMIT_PER_KEY, NO_BLOCK_DURATION_MS, POS_THROTTLER_NAME);
		if (record.totalHits > POS_RATE_LIMIT_PER_KEY) {
			throw new HttpException({ message: "Too many requests from this API key — slow down and retry shortly.", error: "POS_RATE_LIMITED" }, HttpStatus.TOO_MANY_REQUESTS);
		}
		return true;
	}
}
