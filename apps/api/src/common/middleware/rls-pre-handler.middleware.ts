import { Injectable, NestMiddleware } from "@nestjs/common";
import type { IncomingMessage, ServerResponse } from "node:http";

import { rlsStorage, systemRlsContext } from "../../prisma/rls-context";

/**
 * Opens the explicit `request.pre_handler` RLS scope for every request.
 *
 * Guards (authentication, authorization kernel lookups, API-key checks) run
 * before any interceptor, so they need a scope of their own. Instead of the
 * pool silently bypassing RLS when no scope exists, this middleware names the
 * phase as an allowlisted system operation. `RlsInterceptor` then narrows the
 * scope to the authenticated user for the handler itself.
 */
@Injectable()
export class RlsPreHandlerMiddleware implements NestMiddleware {
	public use(_req: IncomingMessage, _res: ServerResponse, next: () => void): void {
		rlsStorage.run(systemRlsContext("request.pre_handler"), next);
	}
}
