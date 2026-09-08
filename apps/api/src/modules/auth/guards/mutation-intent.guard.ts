import { CanActivate, type ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { MUTATION_INTENT_HEADER, MUTATION_INTENT_VALUE } from "@workspace/shared";
import type { FastifyRequest } from "fastify";

import { TypedConfigService } from "../../../config/typed-config.service";
import { readFirstHeader } from "../../../common/utils/http-headers";
import { SKIP_MUTATION_INTENT_KEY } from "../decorators/skip-mutation-intent.decorator";

const UNSAFE_METHODS: readonly string[] = ["POST", "PUT", "PATCH", "DELETE"];

/**
 * Enforces same-origin mutation intent for cookie-authenticated unsafe requests.
 *
 * Validates `Origin` or `Referer` against the configured CORS allowlist and
 * requires the fixed `X-Mutation-Intent: same-origin` header from first-party clients.
 */
@Injectable()
export class MutationIntentGuard implements CanActivate {
	public constructor(
		private readonly reflector: Reflector,
		private readonly config: TypedConfigService,
	) {}

	public canActivate(context: ExecutionContext): boolean {
		const skip: boolean = this.reflector.getAllAndOverride<boolean>(SKIP_MUTATION_INTENT_KEY, [context.getHandler(), context.getClass()]);
		if (skip) {
			return true;
		}

		const request: FastifyRequest = context.switchToHttp().getRequest<FastifyRequest>();
		const method: string = request.method.toUpperCase();

		if (!UNSAFE_METHODS.some((unsafe) => unsafe === method)) {
			return true;
		}

		const authorization: string | undefined = readFirstHeader(request.headers.authorization);
		if (authorization?.toLowerCase().startsWith("bearer ")) {
			return true;
		}

		const intent: string | undefined = readFirstHeader(request.headers[MUTATION_INTENT_HEADER.toLowerCase()]);
		if (intent !== MUTATION_INTENT_VALUE) {
			throw new ForbiddenException({
				message: "Mutation intent header required",
				error: "MUTATION_INTENT_REQUIRED",
			});
		}

		const origin: string | undefined = this.resolveRequestOrigin(request);
		if (origin === undefined || !this.isAllowedOrigin(origin)) {
			throw new ForbiddenException({
				message: "Cross-origin mutation rejected",
				error: "MUTATION_ORIGIN_REJECTED",
			});
		}

		return true;
	}

	private resolveRequestOrigin(request: FastifyRequest): string | undefined {
		const origin: string | undefined = readFirstHeader(request.headers.origin);
		if (origin !== undefined) {
			return origin;
		}

		const referer: string | undefined = readFirstHeader(request.headers.referer);
		if (referer === undefined) {
			return undefined;
		}

		try {
			return new URL(referer).origin;
		} catch {
			return undefined;
		}
	}

	private isAllowedOrigin(origin: string): boolean {
		return this.config.corsOrigins.some((allowed) => allowed === origin);
	}
}
