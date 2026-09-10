import { CallHandler, ExecutionContext, Injectable, type NestInterceptor } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { Observable, from, switchMap } from "rxjs";

import { readFirstHeader } from "../../../common/utils/http-headers";
import { MerchantRequestAuthService } from "../services/merchant-request-auth.service";
import { setMerchantActorOnRequest } from "../types/api-key-auth-request";

/** Resolves a unified `MerchantActor` for merchant dashboard and API-key routes. */
@Injectable()
export class MerchantActorInterceptor implements NestInterceptor {
	public constructor(private readonly merchantRequestAuth: MerchantRequestAuthService) {}

	public intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		const request: FastifyRequest = context.switchToHttp().getRequest<FastifyRequest>();
		const requestedOrgId = readFirstHeader(request.headers["x-merchant-org-id"]);

		return from(this.merchantRequestAuth.resolveFromRequest(request, requestedOrgId)).pipe(
			switchMap((actor) => {
				setMerchantActorOnRequest(request, actor);
				return next.handle();
			}),
		);
	}
}
