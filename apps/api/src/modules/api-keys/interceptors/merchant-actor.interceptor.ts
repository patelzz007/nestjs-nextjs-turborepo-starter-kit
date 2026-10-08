import { CallHandler, ExecutionContext, Injectable, type NestInterceptor } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { Observable, from, switchMap } from "rxjs";
import { z } from "zod";

import { MerchantRequestAuthService } from "../services/merchant-request-auth.service";
import { setMerchantActorOnRequest } from "../types/api-key-auth-request";

/** The `:orgSlug` route segment, when the matched route declares one. */
const OrgSlugRouteParamsSchema = z.object({ orgSlug: z.string() });

/** Resolves a unified `MerchantActor` for merchant dashboard and API-key routes. */
@Injectable()
export class MerchantActorInterceptor implements NestInterceptor {
	public constructor(private readonly merchantRequestAuth: MerchantRequestAuthService) {}

	public intercept<T>(context: ExecutionContext, next: CallHandler<T>): Observable<T> {
		const request: FastifyRequest = context.switchToHttp().getRequest<FastifyRequest>();
		const routeParams = OrgSlugRouteParamsSchema.safeParse(request.params);
		const orgSlug: string | undefined = routeParams.success ? routeParams.data.orgSlug : undefined;

		return from(this.merchantRequestAuth.resolveFromRequest(request, orgSlug)).pipe(
			switchMap((actor) => {
				setMerchantActorOnRequest(request, actor);
				return next.handle();
			}),
		);
	}
}
