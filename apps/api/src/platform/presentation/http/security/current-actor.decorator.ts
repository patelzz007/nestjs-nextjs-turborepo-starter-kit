import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

import type { ActorContext } from "../../../application/actor-context";
import { currentRequestContext } from "../../../infrastructure/context/request-context";
import { actorFromResolution, type ActorContextFromHttpOptions } from "./actor-context.factory";

/**
 * Resolves the explicit {@link ActorContext} for the current HTTP request: the
 * actor `RlsInterceptor` bound to the request context, from the same decision
 * that scoped the database (no process-wide factory binding). Controllers must
 * not assemble actors manually — use this decorator or a system actor for jobs.
 */
export const CurrentActor = createParamDecorator((options: ActorContextFromHttpOptions | undefined, _context: ExecutionContext): ActorContext =>
	actorFromResolution(currentRequestContext()?.actor, options ?? {}),
);
