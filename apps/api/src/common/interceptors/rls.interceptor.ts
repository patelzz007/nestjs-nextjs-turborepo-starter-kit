import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";
import { Observable } from "rxjs";

import { RLS_BYPASS_KEY } from "../../modules/auth/decorators/rls-bypass.decorator";
import { rlsStorage, type RlsContext } from "../../prisma/rls-context";

/**
 * Opens the RLS AsyncLocalStorage scope around the rest of the interceptor
 * chain + controller. Register this APP_INTERCEPTOR first so it is outermost.
 *
 * Bypass (`app.rls_bypass = true`) applies when:
 * - the handler is decorated with `@RlsBypass()` (explicit public DB work), or
 * - there is no `request.user` (Telescope token path, pre-auth probes), or
 * - the JWT carries `hasAdminAccess` / `isSuperAdmin`.
 *
 * `@Public()` alone does **not** bypass — only skips `AuthGuard`.
 */
@Injectable()
export class RlsInterceptor implements NestInterceptor {
	public constructor(private readonly reflector: Reflector) {}

	public intercept<T>(context: ExecutionContext, next: CallHandler<T>): Observable<T> {
		const rls: RlsContext = this.contextFromRequest(context);
		return new Observable<T>((subscriber) => {
			return rlsStorage.run(rls, () => next.handle().subscribe(subscriber));
		});
	}

	private contextFromRequest(context: ExecutionContext): RlsContext {
		if (this.reflector.getAllAndOverride<boolean>(RLS_BYPASS_KEY, [context.getHandler(), context.getClass()])) {
			return { userId: "", bypass: true };
		}

		const request: FastifyRequest = context.switchToHttp().getRequest<FastifyRequest>();
		const user = request.user;
		if (user === undefined) {
			return { userId: "", bypass: true };
		}

		const hasAdminAccess: boolean = "hasAdminAccess" in user && user.hasAdminAccess;
		const isSuperAdmin: boolean = "isSuperAdmin" in user && user.isSuperAdmin;
		if (hasAdminAccess || isSuperAdmin) {
			return { userId: user.sub, bypass: true };
		}

		return { userId: user.sub, bypass: false };
	}
}
