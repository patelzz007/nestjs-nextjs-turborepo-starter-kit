// ============================================
// common/api-docs-access.gate.ts — who may read the Swagger docs
// ============================================
// The docs routes (UI, JSON/YAML document, assets) are mounted by
// `@nestjs/swagger` as plain Fastify routes, outside Nest's guard pipeline, so
// the gate is a Fastify `onRequest` hook. It runs only when the docs policy
// says `platform_admin` (production): the caller must present a valid admin
// access token (the admin panel's `adminAccessToken` cookie, or a Bearer
// token) of a platform SuperAdmin whose session is still valid.

import type { FastifyReply, FastifyRequest } from "fastify";
import { ApiErrorCodes, apiDocsPath } from "@workspace/shared";

import { readBearerToken } from "../modules/auth/guards/auth.guard";
import type { AccessTokenStateService } from "../modules/auth/services/access-token-state.service";
import type { TokenService } from "../modules/auth/services/token.service";
import { correlationIdFor } from "./context/correlation-id";
import { AuthenticationError, AuthorizationError, type AppError } from "./errors/app-error";
import { GlobalExceptionFilter } from "./errors/global-exception.filter";
import { mapException } from "./errors/exception-mapper";

/** The admin panel's session cookie (the docs' audience is platform operators). */
const ADMIN_ACCESS_TOKEN_COOKIE = "adminAccessToken";

/** Legacy docs entry point that redirects to the versioned path. */
const LEGACY_DOCS_PATH = "/docs";

/** True for every URL the Swagger mount serves (UI, document, assets, legacy redirect). */
export function isApiDocsRequest(url: string): boolean {
	const [path = url] = url.split("?");
	const docsPath: string = apiDocsPath();
	return [docsPath, LEGACY_DOCS_PATH].some((prefix: string): boolean => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}-`));
}

/** The token checks the gate needs (narrowed so it can be tested without the auth module graph). */
export interface ApiDocsViewerVerifier {
	readonly tokens: Pick<TokenService, "verifyAccessToken">;
	readonly tokenState: Pick<AccessTokenStateService, "assertTokenValid">;
}

/** Restricts the docs to authenticated platform SuperAdmins. */
export class ApiDocsAccessGate {
	public constructor(private readonly verifier: ApiDocsViewerVerifier) {}

	/** Fastify `onRequest` hook: non-docs requests pass straight through. */
	public readonly onRequest = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
		if (!isApiDocsRequest(request.url)) {
			return;
		}
		const denial: AppError | null = await this.check(request);
		if (denial === null) {
			return;
		}
		const mapped = mapException(denial, { exposeInternalErrors: false });
		await reply.code(mapped.httpStatus).send(GlobalExceptionFilter.buildEnvelope(mapped, correlationIdFor(request.raw)));
	};

	/** `null` when the caller is an authenticated SuperAdmin, otherwise the 401/403 to answer with. */
	public async check(request: FastifyRequest): Promise<AppError | null> {
		const token: string | undefined = readBearerToken(request.headers.authorization) ?? request.cookies[ADMIN_ACCESS_TOKEN_COOKIE];
		if (token === undefined || token.length === 0) {
			return new AuthenticationError({ message: "Sign in to the admin panel to read the API documentation." });
		}
		try {
			const payload = await this.verifier.tokens.verifyAccessToken(token);
			await this.verifier.tokenState.assertTokenValid(payload.sub, payload.tokenVersion, payload.sid);
			return payload.isSuperAdmin ? null : new AuthorizationError({ message: "The API documentation is restricted to platform administrators." });
		} catch {
			// An invalid, expired or revoked token is an authentication failure — the cause is not disclosed.
			return new AuthenticationError({ code: ApiErrorCodes.UNAUTHORIZED, message: "Invalid or expired admin session." });
		}
	}
}
