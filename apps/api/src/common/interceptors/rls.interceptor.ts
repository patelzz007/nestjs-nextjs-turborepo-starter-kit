import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";
import { Observable } from "rxjs";

import { TenancyConfigService } from "../../config/tenancy.config";
import { readFirstHeader } from "../utils/http-headers";
import type { AuthenticatedUser } from "../../types/authenticated-user";
import { isAuthenticatedUser } from "../../types/authenticated-user";
import { RLS_BYPASS_KEY } from "../../modules/auth/decorators/rls-bypass.decorator";
import { rlsStorage, type RlsContext } from "../../prisma/rls-context";

/**
 * Opens the RLS AsyncLocalStorage scope around the rest of the interceptor
 * chain + controller. Register this APP_INTERCEPTOR first so it is outermost.
 *
 * Bypass (`app.rls_bypass = true`) applies when:
 * - the handler is decorated with `@RlsBypass()` (explicit public DB work), or
 * - there is no `request.user` (pre-auth probes), or
 * - the JWT carries `isSuperAdmin`, or
 * - **single-tenant mode** and the JWT carries `hasAdminAccess`.
 *
 * In **multi-tenant mode** (`TENANCY_ENABLED=true`), staff with admin access
 * do **not** bypass RLS — they operate within organization scope only.
 *
 * `@Public()` alone does **not** bypass — only skips `AuthGuard`.
 */
@Injectable()
export class RlsInterceptor implements NestInterceptor {
	public constructor(
		private readonly reflector: Reflector,
		private readonly tenancy: TenancyConfigService,
	) {}

	public intercept<T>(context: ExecutionContext, next: CallHandler<T>): Observable<T> {
		const rls: RlsContext = this.contextFromRequest(context);
		return new Observable<T>((subscriber) => {
			return rlsStorage.run(rls, () => next.handle().subscribe(subscriber));
		});
	}

	private contextFromRequest(context: ExecutionContext): RlsContext {
		const organizationId: string = this.resolveOrganizationId(context);

		if (this.reflector.getAllAndOverride<boolean>(RLS_BYPASS_KEY, [context.getHandler(), context.getClass()])) {
			return { userId: "", bypass: true, organizationId };
		}

		const request: FastifyRequest = context.switchToHttp().getRequest<FastifyRequest>();

		if (!isAuthenticatedUser(request.user)) {
			return { userId: "", bypass: true, organizationId };
		}

		const user: AuthenticatedUser = request.user;

		if (user.isSuperAdmin) {
			return { userId: user.sub, bypass: true, organizationId };
		}

		if (this.tenancy.staffBypassesRls && user.hasAdminAccess) {
			return { userId: user.sub, bypass: true, organizationId };
		}

		return { userId: user.sub, bypass: false, organizationId };
	}

	private resolveOrganizationId(context: ExecutionContext): string {
		if (!this.tenancy.enabled) {
			return this.tenancy.defaultOrganizationId;
		}

		const request: FastifyRequest = context.switchToHttp().getRequest<FastifyRequest>();
		const headerValue: string | undefined = readFirstHeader(request.headers["x-organization-id"]);
		if (headerValue !== undefined && headerValue.length > 0) {
			return headerValue;
		}

		return this.tenancy.defaultOrganizationId;
	}
}
