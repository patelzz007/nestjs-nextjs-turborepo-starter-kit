import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";
import { Observable } from "rxjs";

import { IS_PUBLIC_KEY } from "../../modules/auth/decorators/public.decorator";
import { rlsStorage, type RlsContext } from "../../prisma/rls-context";

/**
 * Opens the RLS AsyncLocalStorage scope around the rest of the interceptor
 * chain + controller. Register this APP_INTERCEPTOR first so it is outermost.
 *
 * Public routes, telescope-token calls (no `request.user`), and admin JWTs
 * bypass policies. Everyone else is scoped to `sub`.
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
		if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) {
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
